import { promises as fs } from 'fs';
import path from 'path';
import { Mutex } from 'async-mutex';
import { getDataRoot } from '@/lib/data-root';

const DATA_DIR = path.join(getDataRoot(), 'data');

/** Mutex dla operacji zapisu – zapobiega race condition przy równoczesnym zapisie plików JSON. */
const writeMutex = new Mutex();

export async function readJsonFile<T>(filename: string): Promise<T> {
  const filePath = path.join(DATA_DIR, filename);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`File not found: ${filename}`);
    }
    throw error;
  }
}

/**
 * Odczytuje plik JSON lub tworzy go z domyślną zawartością, jeśli nie istnieje.
 * Dzięki temu aplikacja nie wywala się przy pierwszym uruchomieniu (brak init-data).
 */
export async function readJsonFileWithDefault<T>(
  filename: string,
  defaultData: T
): Promise<T> {
  const filePath = path.join(DATA_DIR, filename);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return writeMutex.runExclusive(async () => {
        await ensureDir(DATA_DIR);
        await fs.writeFile(
          filePath,
          JSON.stringify(defaultData, null, 2),
          'utf-8'
        );
        return defaultData;
      });
    }
    throw error;
  }
}

export async function writeJsonFile<T>(
  filename: string,
  data: T
): Promise<void> {
  await writeMutex.runExclusive(async () => {
    const filePath = path.join(DATA_DIR, filename);
    const content = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, content, 'utf-8');
  });
}

export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

export async function deleteDir(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}
