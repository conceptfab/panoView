// oxlint-disable react-doctor/server-hoist-static-io
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs, Stats } from 'fs';
import path from 'path';
import { requireAdmin } from '@/lib/auth/session';
import { getDataRoot } from '@/lib/data-root';
import { validateAndResolvePath } from '@/lib/file-utils';

export type BrowseEntry = {
  name: string;
  type: 'dir' | 'file';
  size?: number;
  mtime?: string;
};

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const root = getDataRoot();
    const searchParams = request.nextUrl.searchParams;
    const rel = searchParams.get('path') ?? '';

    const { valid, resolvedPath, error } = validateAndResolvePath(root, rel);
    if (!valid) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const stat = await fs.stat(resolvedPath).catch(() => null);
    if (!stat || !stat.isDirectory()) {
      return NextResponse.json({ error: 'Not a directory' }, { status: 400 });
    }

    const names = await fs.readdir(resolvedPath);

    // ZOPTYMALIZOWANE: równoległe wywołania fs.stat
    const statsResults = await Promise.all(
      names.map(async (name): Promise<{ name: string; stat: Stats } | null> => {
        const fullPath = path.join(resolvedPath, name);
        try {
          const s = await fs.stat(fullPath);
          return { name, stat: s };
        } catch {
          return null;
        }
      })
    );

    const entries: BrowseEntry[] = statsResults.flatMap((result) => {
      if (result === null) return [];
      const { name, stat: s } = result;
      return [
        {
          name,
          type: s.isDirectory() ? 'dir' : 'file',
          size: s.isDirectory() ? undefined : s.size,
          mtime: s.mtime.toISOString(),
        },
      ];
    });

    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    // Oblicz znormalizowaną ścieżkę do wyświetlenia
    const decoded = decodeURIComponent(rel).replace(/\\/g, '/');
    const normalized = path.normalize(decoded).replace(/^\//, '');

    return NextResponse.json({
      path: normalized || '.',
      entries,
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
    console.error('Browse error:', error);
    return NextResponse.json(
      { error: 'Failed to list directory' },
      { status: 500 }
    );
  }
}
