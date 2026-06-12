import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import {
  requireAdminOrEditor,
  editorCanEditProject,
} from '@/lib/auth/session';
import { getProjectById } from '@/lib/db/projects';
import { getUserById } from '@/lib/db/users';

const MAX_FILE_SIZE = 60 * 1024 * 1024; // 60MB
const ALLOWED_TYPES = ['image/webp', 'image/jpeg', 'image/png'];

/**
 * Endpoint tokenów dla client-uploadu do Vercel Blob.
 * Pliki lądują pod tmp/uploads/{projectId}/..., a następnie
 * /api/upload/process przetwarza je w panoramy projektu.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const session = await requireAdminOrEditor();

        let payload: { projectId?: string; purpose?: string } = {};
        try {
          payload = JSON.parse(clientPayload ?? '{}');
        } catch {
          // brak payloadu
        }

        // Import projektu z ZIP (FileManager)
        if (payload.purpose === 'import') {
          if (!pathname.startsWith('tmp/uploads/import/')) {
            throw new Error('Invalid upload path');
          }
          return {
            allowedContentTypes: [
              'application/zip',
              'application/x-zip-compressed',
            ],
            maximumSizeInBytes: 500 * 1024 * 1024,
            addRandomSuffix: true,
            tokenPayload: JSON.stringify({ userId: session.userId }),
          };
        }

        const projectId = payload.projectId ?? '';
        if (!projectId) {
          throw new Error('Project ID is required');
        }
        if (!pathname.startsWith(`tmp/uploads/${projectId}/`)) {
          throw new Error('Invalid upload path');
        }

        const project = await getProjectById(projectId);
        if (!project) {
          throw new Error('Project not found');
        }
        if (session.role === 'editor') {
          const user = await getUserById(session.userId);
          if (!user || !editorCanEditProject(project.groupIds, user.groupIds)) {
            throw new Error('Forbidden: Access denied');
          }
        }

        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_FILE_SIZE,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: session.userId, projectId }),
        };
      },
      onUploadCompleted: async () => {
        // Przetwarzanie wykonuje /api/upload/process wywoływane przez klienta.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    const status = message.includes('Forbidden')
      ? 403
      : message === 'Unauthorized'
        ? 401
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
