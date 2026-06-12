import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getShareLinkByToken } from '@/lib/db/share-links';
import { getProjectById, getProjectConfig } from '@/lib/db/projects';
import { verifyShareUnlockToken } from '@/lib/auth/share-unlock';
import { resolveShareAssetPath } from '@/lib/share-assets';
import { resolveBlobUrl } from '@/lib/storage/blob';

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

    // config.json projektu mieszka w bazie
    if (resolved.blobKey === `projects/${link.projectId}/config.json`) {
      const config = await getProjectConfig(link.projectId);
      if (!config) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }
      return NextResponse.json(config, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const url = await resolveBlobUrl(resolved.blobKey);
    if (!url) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return NextResponse.redirect(url, {
      status: 302,
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Share asset error:', error);
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 });
  }
}
