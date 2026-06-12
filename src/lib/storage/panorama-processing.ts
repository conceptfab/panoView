// oxlint-disable react-doctor/async-await-in-loop
import sharp from 'sharp';
import { Panorama, PanoramaVariant } from '@/types';
import { generateId } from '@/utils/helpers';
import { panoramaKey, thumbnailKey, putBlob } from './blob';

const PANORAMA_VARIANT_WIDTHS = [2048, 4096, 6144];
export const ASPECT_RATIO_MIN = 1.8;
export const ASPECT_RATIO_MAX = 2.2;

export interface ProcessResult {
  panorama: Panorama;
}

export interface ProcessError {
  error: string;
}

/**
 * Przetwarza wgrany obraz panoramy: walidacja proporcji 2:1, master webp,
 * warianty rozdzielczości i miniatura – wszystko zapisywane w Vercel Blob.
 */
export async function processPanoramaBuffer(
  projectId: string,
  buffer: Buffer,
  originalName: string,
  options?: { isWebp?: boolean }
): Promise<ProcessResult | ProcessError> {
  const metadata = await sharp(buffer).metadata();
  if (!metadata.width || !metadata.height) {
    return { error: `Nie można odczytać rozmiaru obrazu: ${originalName}` };
  }

  const aspectRatio = metadata.width / metadata.height;
  if (aspectRatio < ASPECT_RATIO_MIN || aspectRatio > ASPECT_RATIO_MAX) {
    return {
      error: `${originalName} nie ma proporcji 2:1 (${aspectRatio.toFixed(2)})`,
    };
  }

  const panoId = generateId('pano');
  const filename = `${panoId}.webp`;
  const thumbFilename = `thumb_${panoId}.webp`;

  // Master panorama (najwyższa dostępna jakość)
  const masterBuffer = options?.isWebp
    ? buffer
    : await sharp(buffer).webp({ quality: 85 }).toBuffer();
  await putBlob(panoramaKey(projectId, filename), masterBuffer, {
    contentType: 'image/webp',
  });

  const masterMetadata = await sharp(masterBuffer).metadata();
  if (!masterMetadata.width || !masterMetadata.height) {
    return { error: `Nie można odczytać rozmiaru obrazu: ${originalName}` };
  }
  const masterAspectRatio = masterMetadata.width / masterMetadata.height;

  // Warianty rozdzielczości
  const targetWidths = PANORAMA_VARIANT_WIDTHS.filter(
    (w) => w < masterMetadata.width!
  ).sort((a, b) => a - b);

  const variants: PanoramaVariant[] = [];
  for (const width of targetWidths) {
    const height = Math.max(1, Math.round(width / masterAspectRatio));
    const variantFilename = `${panoId}_${width}.webp`;
    const variantBuffer = await sharp(masterBuffer)
      .resize({ width, height, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: width >= 6144 ? 85 : 82 })
      .toBuffer();
    await putBlob(panoramaKey(projectId, variantFilename), variantBuffer, {
      contentType: 'image/webp',
    });
    variants.push({ file: variantFilename, width, height });
  }

  variants.push({
    file: filename,
    width: masterMetadata.width,
    height: masterMetadata.height,
  });

  // Miniatura 800x400
  const thumbBuffer = await sharp(buffer)
    .resize(800, 400, { fit: 'cover' })
    .webp({ quality: 80 })
    .toBuffer();
  await putBlob(thumbnailKey(projectId, thumbFilename), thumbBuffer, {
    contentType: 'image/webp',
  });

  const panorama: Panorama = {
    id: panoId,
    name: originalName.replace(/\.[^.]+$/, ''),
    file: filename,
    variants: variants.sort((a, b) => a.width - b.width),
    thumbnail: thumbFilename,
    initialPosition: { x: 1000, y: 0, z: 0 },
    hotspots: [],
  };

  return { panorama };
}

/** Czy URL wskazuje na nasz store Vercel Blob i prefiks tymczasowych uploadów. */
export function isTrustedTmpUploadUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname.endsWith('.blob.vercel-storage.com') &&
      parsed.pathname.startsWith('/tmp/uploads/')
    );
  } catch {
    return false;
  }
}
