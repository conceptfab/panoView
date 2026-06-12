import { NextRequest, NextResponse } from 'next/server';
import { mkdir } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { requireAdminOrEditor, editorCanEditProject } from '@/lib/auth/session';
import { getProjectById, updateProject } from '@/lib/db/projects';
import { getUserById } from '@/lib/db/users';
import { getDataRoot } from '@/lib/data-root';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const [session, { id: projectId }] = await Promise.all([
      requireAdminOrEditor(),
      params,
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

    const body = await request.json();
    const { imageData } = body;

    if (!imageData) {
      return NextResponse.json(
        { error: 'imageData is required' },
        { status: 400 }
      );
    }

    // Decode base64 image
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Setup directories
    const projectDir = path.join(
      getDataRoot(),
      'uploads',
      'projects',
      projectId
    );
    const thumbnailsDir = path.join(projectDir, 'thumbnails');
    await mkdir(thumbnailsDir, { recursive: true });

    // Save as single project thumbnail
    const thumbnailPath = path.join(thumbnailsDir, 'thumb.webp');

    // Process and save thumbnail (800x400)
    await sharp(buffer)
      .resize(800, 400, { fit: 'cover' })
      .webp({ quality: 85 })
      .toFile(thumbnailPath);

    // Update project thumbnailUrl
    await updateProject(projectId, {
      thumbnailUrl: `/uploads/projects/${projectId}/thumbnails/thumb.webp`,
    });

    return NextResponse.json({ success: true });
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
    console.error('Thumbnail generation error:', error);
    return NextResponse.json(
      { error: 'Thumbnail generation failed' },
      { status: 500 }
    );
  }
}
