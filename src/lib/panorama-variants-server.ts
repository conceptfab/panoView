// oxlint-disable react-doctor/async-await-in-loop
import sharp from 'sharp';
import type { PanoramaVariant, ProjectConfig } from '@/types';
import {
  panoramaKey,
  blobExists,
  downloadBlob,
  putBlob,
} from '@/lib/storage/blob';

const PANORAMA_VARIANT_WIDTHS = [2048, 4096, 6144];

function variantsEqual(a: PanoramaVariant[], b: PanoramaVariant[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].file !== b[i].file ||
      a[i].width !== b[i].width ||
      a[i].height !== b[i].height
    ) {
      return false;
    }
  }
  return true;
}

export async function ensurePanoramaVariantsForProject(
  projectId: string,
  config: ProjectConfig
): Promise<{ changed: boolean; generatedFiles: number; config: ProjectConfig }> {
  if (!config.settings.optimizePanoramaForScreen) {
    return { changed: false, generatedFiles: 0, config };
  }

  let changed = false;
  let generatedFiles = 0;

  for (const panorama of config.panoramas) {
    const sourceKey = panoramaKey(projectId, panorama.file);
    const sourceBuffer = await downloadBlob(sourceKey);
    if (!sourceBuffer) continue;

    const metadata = await sharp(sourceBuffer).metadata();
    if (!metadata.width || !metadata.height) continue;

    const sourceWidth = metadata.width;
    const sourceHeight = metadata.height;
    const aspectRatio = sourceWidth / sourceHeight;
    const sourceBase = panorama.file.replace(/\.[^.]+$/, '');

    const nextVariants: PanoramaVariant[] = [];
    for (const width of PANORAMA_VARIANT_WIDTHS.filter((w) => w < sourceWidth)) {
      const height = Math.max(1, Math.round(width / aspectRatio));
      const variantFile = `${sourceBase}_${width}.webp`;
      const variantKey = panoramaKey(projectId, variantFile);

      if (!(await blobExists(variantKey))) {
        const variantBuffer = await sharp(sourceBuffer)
          .resize({
            width,
            height,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: width >= 6144 ? 85 : 82 })
          .toBuffer();
        await putBlob(variantKey, variantBuffer, {
          contentType: 'image/webp',
        });
        generatedFiles++;
      }

      nextVariants.push({ file: variantFile, width, height });
    }

    nextVariants.push({
      file: panorama.file,
      width: sourceWidth,
      height: sourceHeight,
    });

    const sortedNextVariants = nextVariants.toSorted((a, b) => a.width - b.width);
    const currentVariants = (panorama.variants ?? []).toSorted(
      (a, b) => a.width - b.width
    );
    if (!variantsEqual(currentVariants, sortedNextVariants)) {
      panorama.variants = sortedNextVariants;
      changed = true;
    }
  }

  return { changed, generatedFiles, config };
}
