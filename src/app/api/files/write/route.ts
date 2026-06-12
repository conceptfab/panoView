import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { requireAdmin } from '@/lib/auth/session';
import { getDataRoot } from '@/lib/data-root';
import {
  validateAndResolvePath,
  isEditableExtension,
  MAX_TEXT_FILE_SIZE,
} from '@/lib/file-utils';

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();

    const root = getDataRoot();
    const rel = request.nextUrl.searchParams.get('path') ?? '';

    const { valid, resolvedPath, error } = validateAndResolvePath(root, rel);
    if (!valid) {
      return NextResponse.json({ error }, { status: 400 });
    }

    if (!isEditableExtension(resolvedPath)) {
      return NextResponse.json(
        { error: 'Only text/JSON files can be edited' },
        { status: 400 }
      );
    }

    const content = await request.text();

    // Walidacja rozmiaru pliku
    if (Buffer.byteLength(content, 'utf-8') > MAX_TEXT_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large (max 10MB)' },
        { status: 413 }
      );
    }

    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    await fs.writeFile(resolvedPath, content, 'utf-8');

    return NextResponse.json({ ok: true });
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
    console.error('Write file error:', error);
    return NextResponse.json({ error: 'Failed to save file' }, { status: 500 });
  }
}
