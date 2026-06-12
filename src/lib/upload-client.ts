'use client';

import { upload } from '@vercel/blob/client';

export interface UploadedReplacement {
  panoramaId: string;
  url: string;
  name: string;
  contentType: string;
}

/**
 * Wgrywa pliki zastępujące panoramy bezpośrednio do Vercel Blob
 * (client upload omija limit 4.5MB requestu na Vercel).
 */
export async function uploadReplacementFiles(
  projectId: string,
  replaceFiles: Record<string, File | null>
): Promise<UploadedReplacement[]> {
  const entries = Object.entries(replaceFiles).filter(
    (entry): entry is [string, File] => entry[1] != null
  );

  return Promise.all(
    entries.map(async ([panoramaId, file]) => {
      const blob = await upload(`tmp/uploads/${projectId}/${file.name}`, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        clientPayload: JSON.stringify({ projectId }),
      });
      return {
        panoramaId,
        url: blob.url,
        name: file.name,
        contentType: file.type,
      };
    })
  );
}
