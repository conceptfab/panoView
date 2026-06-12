import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { requireAdminOrEditor, editorCanEditProject } from '@/lib/auth/session';
import { getProjectById, updateProject } from '@/lib/db/projects';
import { getUserById } from '@/lib/db/users';
import { thumbnailKey, putBlob } from '@/lib/storage/blob';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const [session, { id: projectId }] = await Promise.all([
      requireAdminOrEditor(),
      params,
    ]);
    const [project, body] = await Promise.all([
      getProjectById(projectId),
      request.json(),
    ]);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (session.role === 'editor') {
      const user = await getUserById(session.userId);
      if (!user || !editorCanEditProject(project.groupIds, user.groupIds)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const { imageData } = body as { imageData?: string };

    if (!imageData) {
      return NextResponse.json(
        { error: 'imageData is required' },
        { status: 400 }
      );
    }

    // Decode base64 image
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Process thumbnail (800x400) and store in Blob
    const thumbBuffer = await sharp(buffer)
      .resize(800, 400, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer();

    const thumbnailPath = `/uploads/projects/${projectId}/thumbnails/thumb.webp`;
    await Promise.all([
      putBlob(thumbnailKey(projectId, 'thumb.webp'), thumbBuffer, {
        contentType: 'image/webp',
      }),
      updateProject(projectId, { thumbnailUrl: thumbnailPath }),
    ]);

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
