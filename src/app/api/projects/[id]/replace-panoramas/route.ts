// oxlint-disable react-doctor/async-parallel react-doctor/async-await-in-loop react-doctor/js-set-map-lookups
import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { NextRequest, NextResponse } from 'next/server';
import {
  getProjectById,
  getProjectConfig,
  updateProjectConfig,
} from '@/lib/db/projects';
import {
  requireAdminOrEditor,
  editorCanEditProject,
} from '@/lib/auth/session';
import { getUserById } from '@/lib/db/users';
import { ensurePanoramaVariantsForProject } from '@/lib/panorama-variants-server';
import { getDataRoot } from '@/lib/data-root';
import { ensureDir } from '@/lib/db/json-store';

const ALLOWED_TYPES = ['image/webp', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 60 * 1024 * 1024; // 60 MB
const ASPECT_RATIO_MIN = 1.8;
const ASPECT_RATIO_MAX = 2.2;

async function ensureDirSafe(dir: string) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function moveFileIfExists(
  sourceDir: string,
  relativePath: string,
  destDir: string
) {
  const src = path.join(sourceDir, relativePath);
  const dest = path.join(destDir, relativePath);
  try {
    await fs.access(src);
    await ensureDirSafe(path.dirname(dest));
    await fs.rename(src, dest);
  } catch {
    // Ignore missing files
  }
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const [{ id: projectId }, session] = await Promise.all([
      params,
      requireAdminOrEditor(),
    ]);

    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (session.role === 'editor') {
      const user = await getUserById(session.userId);
      if (!user || !editorCanEditProject(project.groupIds, user.groupIds)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const formData = await request.formData();
    const replacements: { panoramaId: string; file: File }[] = [];

    for (const [key, value] of formData.entries()) {
      if (!key.startsWith('panorama:')) continue;
      if (!(value instanceof File)) continue;
      replacements.push({ panoramaId: key.split(':')[1], file: value });
    }

    if (replacements.length === 0) {
      return NextResponse.json(
        { error: 'Brak plików do aktualizacji panoram' },
        { status: 400 }
      );
    }

    const config = await getProjectConfig(projectId);
    if (!config) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 });
    }

    const panoramasById = new Map(config.panoramas.map((p) => [p.id, p]));
    const root = getDataRoot();
    const projectDir = path.join(root, 'uploads', 'projects', projectId);
    const panoramasDir = path.join(projectDir, 'panoramas');
    const thumbnailsDir = path.join(projectDir, 'thumbnails');
    await ensureDir(panoramasDir);
    await ensureDir(thumbnailsDir);

    const pendingRoot = path.join(projectDir, 'pending-panoramas');
    await ensureDir(pendingRoot);

    const replaced: string[] = [];

    for (const { panoramaId, file } of replacements) {
      const panorama = panoramasById.get(panoramaId);
      if (!panorama) {
        return NextResponse.json(
          { error: `Panorama ${panoramaId} nie znaleziona w konfiguracji` },
          { status: 400 }
        );
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `Nieobsługiwany format: ${file.name}` },
          { status: 415 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `${file.name} przekracza limit ${MAX_FILE_SIZE / 1024 / 1024}MB` },
          { status: 413 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const metadata = await sharp(buffer).metadata();
      if (!metadata.width || !metadata.height) {
        return NextResponse.json(
          { error: `Nie można odczytać rozmiaru obrazu: ${file.name}` },
          { status: 400 }
        );
      }

      const ratio = metadata.width / metadata.height;
      if (ratio < ASPECT_RATIO_MIN || ratio > ASPECT_RATIO_MAX) {
        return NextResponse.json(
          {
            error: `${file.name} nie ma proporcji 2:1 (${ratio.toFixed(2)}).`,
          },
          { status: 400 }
        );
      }

      const pendingSlot = path.join(
        pendingRoot,
        `${panorama.id}-${Date.now()}-${Math.round(Math.random() * 1000)}`
      );
      const pendingPanoramas = path.join(pendingSlot, 'panoramas');
      const pendingThumbnails = path.join(pendingSlot, 'thumbnails');
      await ensureDir(pendingPanoramas);
      await ensureDir(pendingThumbnails);

      const moved = new Set<string>();
      const moveVariant = async (relative: string) => {
        if (!relative || moved.has(relative)) return;
        moved.add(relative);
        await moveFileIfExists(panoramasDir, relative, pendingPanoramas);
      };

      await moveVariant(panorama.file);
      for (const variant of panorama.variants ?? []) {
        await moveVariant(variant.file);
      }

      if (panorama.thumbnail) {
        await moveFileIfExists(
          thumbnailsDir,
          panorama.thumbnail,
          pendingThumbnails
        );
      }

      const masterPath = path.join(panoramasDir, panorama.file);
      await sharp(buffer).webp({ quality: 85 }).toFile(masterPath);

      const thumbFilename = `thumb_${panorama.id}.webp`;
      await sharp(buffer)
        .resize(800, 400, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(path.join(thumbnailsDir, thumbFilename));

      panorama.thumbnail = thumbFilename;
      panorama.variants = [];
      replaced.push(panorama.name || panorama.id);
    }

    const ensured = await ensurePanoramaVariantsForProject(projectId, config);
    await updateProjectConfig(projectId, ensured.config);

    return NextResponse.json({
      success: true,
      replaced: replaced.length,
      message: `Zastąpiono ${replaced.length} panoramę/panorama: ${replaced.join(
        ', '
      )}.`,
      pendingDir: pendingRoot,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Wymagane uprawnienia admin lub edytor' },
        { status: 403 }
      );
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Replace panoramas error:', error);
    return NextResponse.json(
      { error: 'Nie udało się zastąpić panoram' },
      { status: 500 }
    );
  }
}
