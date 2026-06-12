// oxlint-disable react-doctor/server-hoist-static-io
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { promises as fs } from 'fs';
import path from 'path';
import { getShareLinkByToken } from '@/lib/db/share-links';
import { getProjectById } from '@/lib/db/projects';
import { verifyShareUnlockToken } from '@/lib/auth/share-unlock';
import { resolveShareAssetPath } from '@/lib/share-assets';

const MIME_TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.json': 'application/json',
};

interface RouteParams {
  params: Promise<{ token: string; path: string[] }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { token, path: pathSegments } = await params;

    const link = await getShareLinkByToken(token);
    if (!link || !link.isActive) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const project = await getProjectById(link.projectId);
    if (!project || !project.isPublished) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (link.pinHash !== null) {
      const cookieStore = await cookies();
      const c = cookieStore.get(`pano-share-${token}`);
      if (!c || !(await verifyShareUnlockToken(c.value, token))) {
        return NextResponse.json({ error: 'Locked' }, { status: 401 });
      }
    }

    const resolved = resolveShareAssetPath(link.projectId, pathSegments);
    if (!resolved.valid) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    let file: Buffer;
    try {
      file = await fs.readFile(resolved.filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }
      throw error;
    }

    const ext = path.extname(resolved.filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Share asset error:', error);
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 });
  }
}
