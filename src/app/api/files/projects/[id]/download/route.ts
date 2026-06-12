// oxlint-disable react-doctor/async-await-in-loop
import { NextRequest, NextResponse } from 'next/server';
import archiver from 'archiver';
import { PassThrough, Readable } from 'stream';
import { requireAdmin } from '@/lib/auth/session';
import { getProjectById, getProjectConfig } from '@/lib/db/projects';
import { projectPrefix, listBlobs } from '@/lib/storage/blob';

export const maxDuration = 300;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const [, { id }] = await Promise.all([requireAdmin(), params]);

    const project = await getProjectById(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const config = await getProjectConfig(id);
    const prefix = projectPrefix(id);
    const blobs = await listBlobs(prefix);

    const archive = archiver('zip', { zlib: { level: 9 } });
    const passThrough = new PassThrough();
    archive.pipe(passThrough);

    const safeName =
      project.name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') || id;

    // config.json z bazy (dawniej plik na dysku)
    if (config) {
      archive.append(JSON.stringify(config, null, 2), { name: 'config.json' });
    }

    // Pliki projektu z Blob – strumieniowane do archiwum
    void (async () => {
      try {
        for (const blob of blobs) {
          const relative = blob.pathname.slice(prefix.length + 1);
          if (!relative || relative === 'config.json') continue;
          const res = await fetch(blob.url);
          if (!res.ok || !res.body) continue;
          archive.append(Readable.fromWeb(res.body as never), {
            name: relative,
          });
        }
        await archive.finalize();
      } catch (err) {
        archive.destroy(err as Error);
      }
    })();

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
