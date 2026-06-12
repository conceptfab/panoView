// oxlint-disable react-doctor/async-await-in-loop
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { requireAdminOrEditor, editorCanEditProject } from '@/lib/auth/session';
import {
  getProjectById,
  getProjectConfig,
  updateProjectConfig,
} from '@/lib/db/projects';
import { getUserById } from '@/lib/db/users';
import { getDataRoot } from '@/lib/data-root';
import { generateId } from '@/utils/helpers';
import { Panorama, PanoramaVariant } from '@/types';

const UPLOADS_DIR = path.join(getDataRoot(), 'uploads', 'projects');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ['image/webp', 'image/jpeg', 'image/png'];
const PANORAMA_VARIANT_WIDTHS = [2048, 4096, 6144];

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminOrEditor();

    const formData = await request.formData();
    const projectId = formData.get('projectId') as string;
    const files = formData.getAll('files') as File[];

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

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

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const projectDir = path.join(UPLOADS_DIR, projectId);
    const panoramasDir = path.join(projectDir, 'panoramas');
    const thumbnailsDir = path.join(projectDir, 'thumbnails');

    await Promise.all([
      mkdir(panoramasDir, { recursive: true }),
      mkdir(thumbnailsDir, { recursive: true }),
    ]);

    const config = await getProjectConfig(projectId);
    if (!config) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 });
    }

    const uploadedFiles: { name: string; panoramaId: string }[] = [];
    const allowedTypes = new Set(ALLOWED_TYPES);

    for (const file of files) {
      // Validate file
      if (!allowedTypes.has(file.type)) {
        continue; // Skip invalid types
      }

      if (file.size > MAX_FILE_SIZE) {
        continue; // Skip too large files
      }

      const buffer = Buffer.from(await file.arrayBuffer());

      // Get image metadata
      const metadata = await sharp(buffer).metadata();
      if (!metadata.width || !metadata.height) continue;

      // Check aspect ratio (should be ~2:1 for equirectangular)
      const aspectRatio = metadata.width / metadata.height;
      if (aspectRatio < 1.8 || aspectRatio > 2.2) {
        continue; // Skip non-equirectangular images
      }

      // Generate unique filename
      const panoId = generateId('pano');
      const filename = `${panoId}.webp`;
      const thumbFilename = `thumb_${panoId}.webp`;

      // Save master panorama (highest available quality for this upload)
      const masterPath = path.join(panoramasDir, filename);
      if (file.type === 'image/webp') {
        await writeFile(masterPath, buffer);
      } else {
        await sharp(buffer).webp({ quality: 85 }).toFile(masterPath);
      }

      const masterMetadata = await sharp(masterPath).metadata();
      if (!masterMetadata.width || !masterMetadata.height) {
        continue;
      }
      const masterAspectRatio = masterMetadata.width / masterMetadata.height;

      // Generate additional panorama variants (2:1 equirectangular)
      const targetWidths = Array.from(
        new Set(
          PANORAMA_VARIANT_WIDTHS.filter((w) => w < masterMetadata.width)
        )
      ).sort((a, b) => a - b);

      const variants: PanoramaVariant[] = [];
      for (const width of targetWidths) {
        const height = Math.max(1, Math.round(width / masterAspectRatio));
        const variantFilename = `${panoId}_${width}.webp`;
        const variantPath = path.join(panoramasDir, variantFilename);
        await sharp(masterPath)
          .resize({
            width,
            height,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: width >= 6144 ? 85 : 82 })
          .toFile(variantPath);
        variants.push({ file: variantFilename, width, height });
      }

      variants.push({
        file: filename,
        width: masterMetadata.width,
        height: masterMetadata.height,
      });

      // Generate thumbnail (800x400)
      const thumbnailPath = path.join(thumbnailsDir, thumbFilename);
      await sharp(buffer)
        .resize(800, 400, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(thumbnailPath);

      // Add to config
      const newPanorama: Panorama = {
        id: panoId,
        name: file.name.replace(/\.[^.]+$/, ''),
        file: filename,
        variants: variants.sort((a, b) => a.width - b.width),
        thumbnail: thumbFilename,
        initialPosition: { x: 1000, y: 0, z: 0 },
        hotspots: [],
      };

      config.panoramas.push(newPanorama);
      uploadedFiles.push({ name: file.name, panoramaId: panoId });
    }

    // Update config
    await updateProjectConfig(projectId, config);

    return NextResponse.json({
      success: true,
      uploadedFiles,
      totalPanoramas: config.panoramas.length,
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
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
