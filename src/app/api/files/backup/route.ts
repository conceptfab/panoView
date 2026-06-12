import { NextResponse } from 'next/server';
import archiver from 'archiver';
import path from 'path';
import { PassThrough } from 'stream';
import { Readable } from 'stream';
import { requireAdmin } from '@/lib/auth/session';
import { getProjects } from '@/lib/db/projects';
import { getDataRoot } from '@/lib/data-root';
import { existsSync } from 'fs';

export async function GET() {
  try {
    await requireAdmin();

    const root = getDataRoot();
    const uploadsDir = path.join(root, 'uploads', 'projects');
    const dataDir = path.join(root, 'data');

    const archive = archiver('zip', { zlib: { level: 9 } });
    const passThrough = new PassThrough();
    archive.pipe(passThrough);

    const projects = await getProjects();
    for (const project of projects) {
      const projectDir = path.join(uploadsDir, project.id);
      if (existsSync(projectDir)) {
        archive.directory(projectDir, `projects/${project.id}`);
      }
    }

    const projectsJson = path.join(dataDir, 'projects.json');
    if (existsSync(projectsJson)) {
      archive.file(projectsJson, { name: 'data/projects.json' });
    }
    const groupsJson = path.join(dataDir, 'groups.json');
    if (existsSync(groupsJson)) {
      archive.file(groupsJson, { name: 'data/groups.json' });
    }

    archive.finalize();

    const webStream = Readable.toWeb(passThrough) as ReadableStream;
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(webStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="pano-backup-${date}.zip"`,
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
    console.error('Backup error:', error);
    return NextResponse.json(
      { error: 'Failed to create backup' },
      { status: 500 }
    );
  }
}
