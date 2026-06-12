import { put, del, head, list, copy } from '@vercel/blob';

/**
 * Warstwa plików na Vercel Blob.
 * Schemat kluczy odpowiada dawnemu układowi na dysku:
 *   projects/{projectId}/panoramas/{file}
 *   projects/{projectId}/thumbnails/{file}
 *   tmp/uploads/{...} – oryginały z client-uploadu, przed przetworzeniem
 */

export const PROJECTS_PREFIX = 'projects';

export function projectPrefix(projectId: string): string {
  return `${PROJECTS_PREFIX}/${projectId}`;
}

export function panoramaKey(projectId: string, file: string): string {
  return `${projectPrefix(projectId)}/panoramas/${file}`;
}

export function thumbnailKey(projectId: string, file: string): string {
  return `${projectPrefix(projectId)}/thumbnails/${file}`;
}

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

export function contentTypeForFile(filename: string): string {
  const dot = filename.lastIndexOf('.');
  const ext = dot === -1 ? '' : filename.slice(dot).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/** Zapis pliku pod deterministycznym kluczem (bez losowego sufiksu). */
export async function putBlob(
  pathname: string,
  body: Buffer | Blob | ReadableStream | string,
  options?: { contentType?: string }
): Promise<{ url: string; pathname: string }> {
  const result = await put(pathname, body, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: options?.contentType ?? contentTypeForFile(pathname),
    cacheControlMaxAge: 31536000,
  });
  return { url: result.url, pathname: result.pathname };
}

// Bazowy URL publicznego store'a – cache per instancja.
let cachedBaseUrl: string | null = process.env.BLOB_BASE_URL || null;

/**
 * Zwraca publiczny URL bloba lub null, gdy blob nie istnieje.
 * Po pierwszym trafieniu zapamiętuje bazowy URL i kolejne wywołania
 * nie wymagają zapytania do API (bez weryfikacji istnienia).
 */
export async function resolveBlobUrl(pathname: string): Promise<string | null> {
  if (cachedBaseUrl) {
    return `${cachedBaseUrl}/${pathname}`;
  }
  try {
    const meta = await head(pathname);
    if (meta.url.endsWith(`/${pathname}`)) {
      cachedBaseUrl = meta.url.slice(0, meta.url.length - pathname.length - 1);
    }
    return meta.url;
  } catch {
    return null;
  }
}

/** Jak resolveBlobUrl, ale zawsze weryfikuje istnienie bloba (head). */
export async function resolveBlobUrlVerified(
  pathname: string
): Promise<string | null> {
  try {
    const meta = await head(pathname);
    return meta.url;
  } catch {
    return null;
  }
}

export async function blobExists(pathname: string): Promise<boolean> {
  try {
    await head(pathname);
    return true;
  } catch {
    return false;
  }
}

/** Pobiera zawartość bloba do bufora. */
export async function downloadBlob(pathname: string): Promise<Buffer | null> {
  const url = await resolveBlobUrlVerified(pathname);
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

/** Pobiera zawartość bloba po pełnym URL. */
export async function downloadBlobFromUrl(url: string): Promise<Buffer | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

export async function deleteBlob(pathname: string): Promise<void> {
  try {
    await del(pathname);
  } catch {
    // brak pliku nie jest błędem
  }
}

export interface BlobFileInfo {
  pathname: string;
  url: string;
  size: number;
  uploadedAt: Date;
}

/** Lista wszystkich blobów pod prefiksem (z paginacją). */
export async function listBlobs(prefix: string): Promise<BlobFileInfo[]> {
  const results: BlobFileInfo[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    for (const blob of page.blobs) {
      results.push({
        pathname: blob.pathname,
        url: blob.url,
        size: blob.size,
        uploadedAt: blob.uploadedAt,
      });
    }
    cursor = page.cursor ?? undefined;
  } while (cursor);
  return results;
}

/** Usuwa wszystkie bloby pod prefiksem. Zwraca liczbę usuniętych plików. */
export async function deletePrefix(prefix: string): Promise<number> {
  const blobs = await listBlobs(prefix);
  if (blobs.length === 0) return 0;
  const BATCH = 100;
  for (let i = 0; i < blobs.length; i += BATCH) {
    await del(blobs.slice(i, i + BATCH).map((b) => b.url));
  }
  return blobs.length;
}

/**
 * Kopiuje wszystkie bloby z jednego prefiksu pod drugi
 * (np. projects/stary-id/... -> projects/nowy-id/...).
 */
export async function copyPrefix(
  fromPrefix: string,
  toPrefix: string
): Promise<number> {
  const blobs = await listBlobs(fromPrefix);
  let copied = 0;
  const CONCURRENCY = 8;
  for (let i = 0; i < blobs.length; i += CONCURRENCY) {
    await Promise.all(
      blobs.slice(i, i + CONCURRENCY).map(async (blob) => {
        const target = `${toPrefix}${blob.pathname.slice(fromPrefix.length)}`;
        await copy(blob.url, target, {
          access: 'public',
          addRandomSuffix: false,
        });
        copied++;
      })
    );
  }
  return copied;
}

/** Przenosi blob (kopia + usunięcie źródła). Brak źródła nie jest błędem. */
export async function moveBlob(
  fromPathname: string,
  toPathname: string
): Promise<boolean> {
  const url = await resolveBlobUrlVerified(fromPathname);
  if (!url) return false;
  await copy(url, toPathname, { access: 'public', addRandomSuffix: false });
  await del(url);
  return true;
}

/** Suma rozmiarów blobów pod prefiksem (w bajtach). */
export async function prefixSize(prefix: string): Promise<number> {
  const blobs = await listBlobs(prefix);
  return blobs.reduce((sum, b) => sum + b.size, 0);
}

/** Lista identyfikatorów projektów obecnych w Blob (katalogi pod projects/). */
export async function listProjectIdsInBlob(): Promise<string[]> {
  const ids = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await list({
      prefix: `${PROJECTS_PREFIX}/`,
      cursor,
      limit: 1000,
    });
    for (const blob of page.blobs) {
      const rest = blob.pathname.slice(PROJECTS_PREFIX.length + 1);
      const slash = rest.indexOf('/');
      if (slash > 0) ids.add(rest.slice(0, slash));
    }
    cursor = page.cursor ?? undefined;
  } while (cursor);
  return [...ids];
}
