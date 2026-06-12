import path from 'path';

/**
 * Rozszerzenia plików tekstowych, które można edytować/podglądać
 */
export const EDITABLE_TEXT_EXTENSIONS = new Set([
  'json',
  'txt',
  'md',
  'html',
  'css',
  'js',
  'ts',
  'tsx',
  'jsx',
  'xml',
  'yaml',
  'yml',
  'env',
  'log',
  'csv',
]);

/**
 * Maksymalny rozmiar pliku tekstowego (10MB)
 */
export const MAX_TEXT_FILE_SIZE = 10 * 1024 * 1024;

export interface PathValidationResult {
  valid: boolean;
  resolvedPath: string;
  error?: string;
}

/**
 * Waliduje i rozwiązuje ścieżkę względem katalogu root.
 * Chroni przed path traversal attacks.
 */
export function validateAndResolvePath(
  root: string,
  relativePath: string
): PathValidationResult {
  const decoded = decodeURIComponent(relativePath).replace(/\\/g, '/');
  const normalized = path.normalize(decoded).replace(/^\//, '');
  const filePath = path.join(root, normalized);

  const relativeResolved = path.relative(root, path.resolve(root, normalized));

  if (relativeResolved.startsWith('..') || path.isAbsolute(relativeResolved)) {
    return { valid: false, resolvedPath: '', error: 'Invalid path' };
  }

  return { valid: true, resolvedPath: filePath };
}

/**
 * Sprawdza czy rozszerzenie pliku jest edytowalne
 */
export function isEditableExtension(filePath: string): boolean {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return EDITABLE_TEXT_EXTENSIONS.has(ext);
}

/**
 * Pobiera rozszerzenie pliku (bez kropki, lowercase)
 */
export function getFileExtension(filePath: string): string {
  return path.extname(filePath).slice(1).toLowerCase();
}
