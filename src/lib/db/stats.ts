import { promises as fs } from 'fs';
import path from 'path';
import { Mutex } from 'async-mutex';
import { getDataRoot } from '@/lib/data-root';
import { ensureDir, deleteFile } from './json-store';
import type { StatsEvent, UserStatsDay } from '@/types/stats';

const DATA_DIR = path.join(getDataRoot(), 'data');
const STATS_DIR = path.join(DATA_DIR, 'stats');
const statsWriteMutex = new Mutex();

/** Bezpieczny fragment ścieżki – tylko znaki dozwolone w nazwach katalogów. */
function safeUserId(userId: string): string {
  return userId.replace(/[^a-zA-Z0-9-_]/g, '_');
}

function getUserDir(userId: string): string {
  return path.join(STATS_DIR, safeUserId(userId));
}

function getDayFilePath(userId: string, dateStr: string): string {
  // dateStr = YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error('Invalid date format, expected YYYY-MM-DD');
  }
  return path.join(getUserDir(userId), `${dateStr}.json`);
}

export function getDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isUserStatsDay(value: unknown): value is UserStatsDay {
  if (!value || typeof value !== 'object') return false;
  const day = value as Partial<UserStatsDay>;
  return (
    typeof day.date === 'string' &&
    typeof day.userId === 'string' &&
    Array.isArray(day.events)
  );
}

/**
 * Wyciąga pierwszy kompletny obiekt JSON z początku tekstu.
 * Pozwala odzyskać dane z pliku z "ogonem" po poprawnym JSON-ie.
 */
function extractFirstJsonObject(raw: string): string | null {
  const text = raw.trimStart();
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') depth--;

    if (depth === 0) {
      return text.slice(start, i + 1);
    }
  }

  return null;
}

function parseStatsDayContent(content: string): UserStatsDay | null {
  try {
    const parsed = JSON.parse(content) as unknown;
    return isUserStatsDay(parsed) ? parsed : null;
  } catch (err) {
    if (!(err instanceof SyntaxError)) throw err;
  }

  const recovered = extractFirstJsonObject(content);
  if (!recovered) return null;
  try {
    const parsed = JSON.parse(recovered) as unknown;
    return isUserStatsDay(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function writeJsonAtomic(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tempPath, content, 'utf-8');
  await fs.rename(tempPath, filePath);
}

/** Dopisuje zdarzenie do pliku dnia. Jeden dzień = jeden plik. */
export async function appendEvent(
  userId: string,
  dateStr: string,
  event: StatsEvent
): Promise<void> {
  await statsWriteMutex.runExclusive(async () => {
    const filePath = getDayFilePath(userId, dateStr);
    const userDir = path.dirname(filePath);
    await ensureDir(userDir);

    let day: UserStatsDay;
    let corruptedContent: string | null = null;

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = parseStatsDayContent(content);
      if (parsed) {
        day = parsed;
      } else {
        corruptedContent = content;
        day = { date: dateStr, userId, events: [] };
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        day = { date: dateStr, userId, events: [] };
      } else {
        throw err;
      }
    }

    // Zachowaj kopię uszkodzonego pliku do ewentualnej analizy.
    if (corruptedContent) {
      const backupPath = `${filePath}.corrupt-${Date.now()}.bak`;
      await fs.writeFile(backupPath, corruptedContent, 'utf-8').catch(() => {});
    }

    day.events.push(event);
    await writeJsonAtomic(filePath, JSON.stringify(day, null, 2));
  });
}

/** Zwraca listę dat (YYYY-MM-DD), dla których użytkownik ma pliki statystyk. */
export async function getStatsDaysForUser(userId: string): Promise<string[]> {
  const userDir = getUserDir(userId);
  try {
    const files = await fs.readdir(userDir);
    const dates = files
      .flatMap((f) =>
        f.endsWith('.json') && /^\d{4}-\d{2}-\d{2}\.json$/.test(f)
          ? [f.replace('.json', '')]
          : []
      )
      .sort();
    return dates;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

/** Pobiera zawartość jednego dnia. */
export async function getStatsDay(
  userId: string,
  dateStr: string
): Promise<UserStatsDay | null> {
  const filePath = getDayFilePath(userId, dateStr);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = parseStatsDayContent(content);
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

/** Pobiera statystyki użytkownika – wszystkie dni (tylko metadane: data + liczba zdarzeń) lub pełna zawartość. */
export async function getStatsForUser(
  userId: string,
  options?: { full?: boolean }
): Promise<{ date: string; eventCount: number; day?: UserStatsDay }[]> {
  const dates = await getStatsDaysForUser(userId);
  const days = await Promise.all(
    dates.map(async (dateStr) => ({
      dateStr,
      day: await getStatsDay(userId, dateStr),
    }))
  );

  return days.flatMap(({ dateStr, day }) => {
    if (!day) return [];
    const item: { date: string; eventCount: number; day?: UserStatsDay } = {
      date: dateStr,
      eventCount: day.events.length,
    };
    if (options?.full) {
      item.day = day;
    }
    return [item];
  });
}

/** Lista ID użytkowników (katalogów), którzy mają jakiekolwiek statystyki. */
export async function listUserIdsWithStats(): Promise<string[]> {
  try {
    await ensureDir(STATS_DIR);
    const entries = await fs.readdir(STATS_DIR, { withFileTypes: true });
    return entries.flatMap((e) => (e.isDirectory() ? [e.name] : []));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

/** Usuwa pliki dni starsze niż podana liczba dni. Jeśli podano userId – tylko ten użytkownik; inaczej wszyscy. */
export async function deleteStatsOlderThan(
  olderThanDays: number,
  userId?: string
): Promise<{ deleted: number }> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);
  const cutoffStr = getDateString(cutoff);
  let deleted = 0;

  const userIds = userId ? [safeUserId(userId)] : await listUserIdsWithStats();

  const deletedCounts = await Promise.all(
    userIds.map(async (uid) => {
      const userDir = path.join(STATS_DIR, uid);
      try {
        const files = await fs.readdir(userDir);
        const oldFiles = files.filter((f) => {
          if (!f.endsWith('.json') || !/^\d{4}-\d{2}-\d{2}\.json$/.test(f)) {
            return false;
          }
          return f.replace('.json', '') < cutoffStr;
        });
        await Promise.all(oldFiles.map((f) => deleteFile(path.join(userDir, f))));
        return oldFiles.length;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw err;
        }
        return 0;
      }
    })
  );
  deleted = deletedCounts.reduce((total, count) => total + count, 0);

  return { deleted };
}
