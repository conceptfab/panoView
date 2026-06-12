import { NextResponse } from 'next/server';
import { resolveBlobUrl, contentTypeForFile } from './blob';
import { getProjectConfig } from '@/lib/db/projects';

/**
 * Wspólna obsługa ścieżek /uploads/* po migracji na Vercel Blob.
 * - projects/{id}/config.json jest serwowany z bazy (kolumna config),
 * - pozostałe pliki przekierowywane są (302) na publiczny URL Blob.
 */
export async function serveUploadsAsset(
  pathSegments: string[]
): Promise<NextResponse> {
  if (
    pathSegments.length === 0 ||
    pathSegments.some((s) => s.includes('..') || s.includes('\\') || !s)
  ) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  // Dawny układ na dysku: uploads/projects/{id}/... -> klucz Blob: projects/{id}/...
  const key = pathSegments.join('/');

  // config.json projektu mieszka teraz w bazie
  if (
    pathSegments.length === 3 &&
    pathSegments[0] === 'projects' &&
    pathSegments[2] === 'config.json'
  ) {
    const config = await getProjectConfig(pathSegments[1]);
    if (!config) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    return NextResponse.json(config, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }

  const url = await resolveBlobUrl(key);
  if (!url) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  return NextResponse.redirect(url, {
    status: 302,
    headers: {
      // Redirect może być cache'owany – pliki są niemutowalne (unikalne nazwy)
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type': contentTypeForFile(key),
    },
  });
}
