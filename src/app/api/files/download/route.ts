// oxlint-disable react-doctor/server-hoist-static-io
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { requireAdmin } from '@/lib/auth/session';
import { getDataRoot } from '@/lib/data-root';
import { validateAndResolvePath } from '@/lib/file-utils';

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
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const name = path.basename(resolvedPath);
    const buffer = await fs.readFile(resolvedPath);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(
          name
        )}"`,
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
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    );
  }
}
