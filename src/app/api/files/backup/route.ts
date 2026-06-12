// oxlint-disable react-doctor/async-await-in-loop
import { NextResponse } from 'next/server';
import archiver from 'archiver';
import { PassThrough, Readable } from 'stream';
import { requireAdmin } from '@/lib/auth/session';
import { getProjects, getProjectConfig } from '@/lib/db/projects';
import { getGroups } from '@/lib/db/groups';
import { PROJECTS_PREFIX, listBlobs } from '@/lib/storage/blob';

export const maxDuration = 300;

export async function GET() {
  try {
    await requireAdmin();

    const archive = archiver('zip', { zlib: { level: 9 } });
    const passThrough = new PassThrough();
    archive.pipe(passThrough);

    const [projects, groups] = await Promise.all([getProjects(), getGroups()]);

    // Dump metadanych z bazy (format zgodny z dawnymi plikami JSON)
    archive.append(JSON.stringify({ projects }, null, 2), {
      name: 'data/projects.json',
    });
    archive.append(JSON.stringify({ groups }, null, 2), {
      name: 'data/groups.json',
    });

    void (async () => {
      try {
        // config.json każdego projektu (z bazy)
        for (const project of projects) {
          const config = await getProjectConfig(project.id);
          if (config) {
            archive.append(JSON.stringify(config, null, 2), {
              name: `projects/${project.id}/config.json`,
            });
          }
        }

        // Wszystkie pliki projektów z Blob
        const blobs = await listBlobs(`${PROJECTS_PREFIX}/`);
        for (const blob of blobs) {
          const res = await fetch(blob.url);
          if (!res.ok || !res.body) continue;
          archive.append(Readable.fromWeb(res.body as never), {
            name: blob.pathname,
          });
        }
        await archive.finalize();
      } catch (err) {
        archive.destroy(err as Error);
      }
    })();

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
