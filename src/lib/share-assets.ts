import path from 'path';
import { getDataRoot } from '@/lib/data-root';

export type ShareAssetPathResult =
  | { valid: true; filePath: string }
  | { valid: false };

export function buildShareAssetBasePath(token: string): string {
  return `/api/p/${encodeURIComponent(token)}/assets`;
}

export function resolveShareAssetPath(
  projectId: string,
  pathSegments: string[]
): ShareAssetPathResult {
  const projectRoot = path.join(getDataRoot(), 'uploads', 'projects', projectId);
  const filePath = path.join(projectRoot, ...pathSegments);
  const resolvedPath = path.resolve(filePath);
  const resolvedProjectRoot = path.resolve(projectRoot);

  if (
    resolvedPath !== resolvedProjectRoot &&
    !resolvedPath.startsWith(resolvedProjectRoot + path.sep)
  ) {
    return { valid: false };
  }

  return { valid: true, filePath };
}
