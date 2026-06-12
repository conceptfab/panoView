// oxlint-disable react-doctor/server-hoist-static-io
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getDataRoot } from '@/lib/data-root';
import { getSession } from '@/lib/auth/session';

const UPLOADS_DIR = path.join(getDataRoot(), 'uploads');

const MIME_TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.json': 'application/json',
};

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Autoryzacja - tylko zalogowani użytkownicy
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { path: pathSegments } = await params;
    const filePath = path.join(UPLOADS_DIR, ...pathSegments);

    // Poprawiona walidacja path traversal
    const resolvedPath = path.resolve(filePath);
    const resolvedUploads = path.resolve(UPLOADS_DIR);
    if (
      !resolvedPath.startsWith(resolvedUploads + path.sep) &&
      resolvedPath !== resolvedUploads
    ) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Read file
    const file = await fs.readFile(filePath);

    // Determine content type
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    return new NextResponse(file, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Static file error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
