// oxlint-disable react-doctor/async-await-in-loop
import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import {
  requireAdminOrEditor,
  editorCanEditProject,
} from '@/lib/auth/session';
import {
  getProjectById,
  getProjectConfig,
  updateProjectConfig,
} from '@/lib/db/projects';
import { getUserById } from '@/lib/db/users';
import { downloadBlobFromUrl } from '@/lib/storage/blob';
import {
  processPanoramaBuffer,
  isTrustedTmpUploadUrl,
} from '@/lib/storage/panorama-processing';

export const maxDuration = 300;

interface ProcessRequestBody {
  projectId?: string;
  files?: { url?: string; name?: string; contentType?: string }[];
}

/**
 * Przetwarza pliki wgrane client-uploadem do tmp/uploads/ w panoramy projektu:
 * walidacja, master webp, warianty, miniatura, aktualizacja config w bazie.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminOrEditor();

    const body = (await request.json()) as ProcessRequestBody;
    const projectId = body.projectId ?? '';
    const files = body.files ?? [];

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (session.role === 'editor') {
      const user = await getUserById(session.userId);
      if (!user || !editorCanEditProject(project.groupIds, user.groupIds)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const config = await getProjectConfig(projectId);
    if (!config) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 });
    }

    const uploadedFiles: { name: string; panoramaId: string }[] = [];
    const skipped: { name: string; reason: string }[] = [];

    for (const file of files) {
      const name = file.name || 'panorama';
      if (!file.url || !isTrustedTmpUploadUrl(file.url)) {
        skipped.push({ name, reason: 'Nieprawidłowy adres pliku' });
        continue;
      }

      const buffer = await downloadBlobFromUrl(file.url);
      if (!buffer) {
        skipped.push({ name, reason: 'Nie udało się pobrać pliku' });
        continue;
      }

      const result = await processPanoramaBuffer(projectId, buffer, name, {
        isWebp: file.contentType === 'image/webp',
      });

      // Sprzątanie pliku tymczasowego niezależnie od wyniku
      await del(file.url).catch(() => {});

      if ('error' in result) {
        skipped.push({ name, reason: result.error });
        continue;
      }

      config.panoramas.push(result.panorama);
      uploadedFiles.push({ name, panoramaId: result.panorama.id });
    }

    if (uploadedFiles.length > 0) {
      await updateProjectConfig(projectId, config);
    }

    return NextResponse.json({
      success: true,
      uploadedFiles,
      skipped,
      totalPanoramas: config.panoramas.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Wymagane uprawnienia admin lub edytor' },
        { status: 403 }
      );
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Upload process error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
