import { v4 as uuidv4 } from 'uuid';

export function generateId(prefix: string = ''): string {
  const id = uuidv4();
  return prefix ? `${prefix}-${id.slice(0, 8)}` : id;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString();
}

const POLISH_MAP: Record<string, string> = {
  'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n',
  'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
  'Ą': 'a', 'Ć': 'c', 'Ę': 'e', 'Ł': 'l', 'Ń': 'n',
  'Ó': 'o', 'Ś': 's', 'Ź': 'z', 'Ż': 'z',
};

export function slugify(text: string): string {
  return text
    .split('')
    .map(c => POLISH_MAP[c] || c)
    .join('')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Maksymalna długość slug-a projektu (URL + katalog). */
const PROJECT_SLUG_MAX_LENGTH = 50;

/**
 * Generuje slug projektu z nazwy lub opisu (naturalny, czytelny w URL i nazwie katalogu).
 * Jeśli wynik jest pusty, zwraca '' – wtedy createProject użyje fallback (np. proj-xxx).
 */
export function projectSlugFromName(name: string, description: string): string {
  const raw = slugify(name.trim() || description.trim());
  if (!raw) return '';
  return raw.slice(0, PROJECT_SLUG_MAX_LENGTH).replace(/-+$/, '');
}

export function matchEmailPattern(email: string, pattern: string): boolean {
  if (pattern === '*') return true;

  if (pattern.startsWith('*@')) {
    const domain = pattern.slice(2);
    return email.toLowerCase().endsWith(`@${domain.toLowerCase()}`);
  }

  if (pattern.includes('*')) {
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
      'i'
    );
    return regex.test(email);
  }

  return email.toLowerCase() === pattern.toLowerCase();
}

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

export function isValidImageFormat(filename: string): boolean {
  const ext = getFileExtension(filename);
  return ['webp', 'jpg', 'jpeg', 'png'].includes(ext);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
