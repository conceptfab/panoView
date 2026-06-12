export type ShareAssetPathResult =
  | { valid: true; blobKey: string }
  | { valid: false };

export function buildShareAssetBasePath(token: string): string {
  return `/api/p/${encodeURIComponent(token)}/assets`;
}

/**
 * Mapuje segmenty ścieżki assetu share linku na klucz w Vercel Blob
 * (projects/{projectId}/...). Odrzuca path traversal i puste segmenty.
 */
export function resolveShareAssetPath(
  projectId: string,
  pathSegments: string[]
): ShareAssetPathResult {
  if (pathSegments.length === 0) return { valid: false };
  for (const segment of pathSegments) {
    if (
      !segment ||
      segment === '.' ||
      segment === '..' ||
      segment.includes('/') ||
      segment.includes('\\')
    ) {
      return { valid: false };
    }
  }
  return {
    valid: true,
    blobKey: `projects/${projectId}/${pathSegments.join('/')}`,
  };
}
