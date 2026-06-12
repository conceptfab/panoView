// oxlint-disable react-doctor/async-parallel react-doctor/async-await-in-loop react-doctor/js-set-map-lookups
import sharp from 'sharp';
import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
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
import {
  panoramaKey,
  thumbnailKey,
  projectPrefix,
  putBlob,
  moveBlob,
  downloadBlobFromUrl,
} from '@/lib/storage/blob';
import {
  isTrustedTmpUploadUrl,
  ASPECT_RATIO_MIN,
  ASPECT_RATIO_MAX,
} from '@/lib/storage/panorama-processing';

export const maxDuration = 300;

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface ReplaceRequestBody {
  replacements?: {
    panoramaId?: string;
    url?: string;
    name?: string;
    contentType?: string;
  }[];
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

    const body = (await request.json()) as ReplaceRequestBody;
    const replacements = (body.replacements ?? []).filter(
      (r) => r.panoramaId && r.url
    );

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
    const pendingPrefix = `${projectPrefix(projectId)}/pending-panoramas`;

    const replaced: string[] = [];

    for (const replacement of replacements) {
      const panoramaId = replacement.panoramaId!;
      const name = replacement.name || panoramaId;

      const panorama = panoramasById.get(panoramaId);
      if (!panorama) {
        return NextResponse.json(
          { error: `Panorama ${panoramaId} nie znaleziona w konfiguracji` },
          { status: 400 }
        );
      }

      if (!isTrustedTmpUploadUrl(replacement.url!)) {
        return NextResponse.json(
          { error: `Nieprawidłowy adres pliku: ${name}` },
          { status: 400 }
        );
      }

      const buffer = await downloadBlobFromUrl(replacement.url!);
      if (!buffer) {
        return NextResponse.json(
          { error: `Nie udało się pobrać pliku: ${name}` },
          { status: 400 }
        );
      }

      const metadata = await sharp(buffer).metadata();
      if (!metadata.width || !metadata.height) {
        return NextResponse.json(
          { error: `Nie można odczytać rozmiaru obrazu: ${name}` },
          { status: 400 }
        );
      }

      const ratio = metadata.width / metadata.height;
      if (ratio < ASPECT_RATIO_MIN || ratio > ASPECT_RATIO_MAX) {
        return NextResponse.json(
          { error: `${name} nie ma proporcji 2:1 (${ratio.toFixed(2)}).` },
          { status: 400 }
        );
      }

      // Stare pliki przenosimy do "poczekalni" w Blob
      const pendingSlot = `${pendingPrefix}/${panorama.id}-${Date.now()}-${Math.round(Math.random() * 1000)}`;

      const moved = new Set<string>();
      const moveVariant = async (relative: string) => {
        if (!relative || moved.has(relative)) return;
        moved.add(relative);
        await moveBlob(
          panoramaKey(projectId, relative),
          `${pendingSlot}/panoramas/${relative}`
        );
      };

      await moveVariant(panorama.file);
      for (const variant of panorama.variants ?? []) {
        await moveVariant(variant.file);
      }

      if (panorama.thumbnail) {
        await moveBlob(
          thumbnailKey(projectId, panorama.thumbnail),
          `${pendingSlot}/thumbnails/${panorama.thumbnail}`
        );
      }

      // Nowy master pod tą samą nazwą pliku
      const masterBuffer = await sharp(buffer)
        .webp({ quality: 85 })
        .toBuffer();
      await putBlob(panoramaKey(projectId, panorama.file), masterBuffer, {
        contentType: 'image/webp',
      });

      const thumbFilename = `thumb_${panorama.id}.webp`;
      const thumbBuffer = await sharp(buffer)
        .resize(800, 400, { fit: 'cover' })
        .webp({ quality: 80 })
        .toBuffer();
      await putBlob(thumbnailKey(projectId, thumbFilename), thumbBuffer, {
        contentType: 'image/webp',
      });

      // Sprzątanie pliku tymczasowego
      await del(replacement.url!).catch(() => {});

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
      pendingDir: pendingPrefix,
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
