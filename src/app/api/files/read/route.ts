// oxlint-disable react-doctor/server-hoist-static-io
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { requireAdmin } from '@/lib/auth/session';
import { getDataRoot } from '@/lib/data-root';
import {
  validateAndResolvePath,
  isEditableExtension,
  getFileExtension,
} from '@/lib/file-utils';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const root = getDataRoot();
    const rel = request.nextUrl.searchParams.get('path') ?? '';

    const { valid, resolvedPath, error } = validateAndResolvePath(root, rel);
    if (!valid) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const stat = await fs.stat(resolvedPath).catch(() => null);
    if (!stat || !stat.isFile()) {
      return NextResponse.json({ error: 'Not a file' }, { status: 400 });
    }

    if (!isEditableExtension(resolvedPath)) {
      return NextResponse.json(
        { error: 'File type not previewable' },
        { status: 400 }
      );
    }

    const content = await fs.readFile(resolvedPath, 'utf-8');
    const ext = getFileExtension(resolvedPath);
    const contentType = ext === 'json' ? 'application/json' : 'text/plain';

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Read file error:', error);
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}
