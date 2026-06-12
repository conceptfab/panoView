import { NextRequest, NextResponse } from 'next/server';
import archiver from 'archiver';
import path from 'path';
import { PassThrough } from 'stream';
import { Readable } from 'stream';
import { requireAdmin } from '@/lib/auth/session';
import { getProjectById } from '@/lib/db/projects';
import { getDataRoot } from '@/lib/data-root';
import { existsSync } from 'fs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const [, { id }] = await Promise.all([requireAdmin(), params]);

    const project = await getProjectById(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const root = getDataRoot();
    const projectDir = path.join(root, 'uploads', 'projects', id);
    if (!existsSync(projectDir)) {
      return NextResponse.json(
        { error: 'Project files not found' },
        { status: 404 }
      );
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    const passThrough = new PassThrough();
    archive.pipe(passThrough);

    const safeName =
      project.name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') || id;
    archive.directory(projectDir, false);

    archive.finalize();

    const webStream = Readable.toWeb(passThrough) as ReadableStream;
    return new NextResponse(webStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${safeName}-${id}.zip"`,
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
    console.error('Download project error:', error);
    return NextResponse.json(
      { error: 'Failed to download project' },
      { status: 500 }
    );
  }
}
