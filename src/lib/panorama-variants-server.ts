// oxlint-disable react-doctor/async-await-in-loop
import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import type { PanoramaVariant, ProjectConfig } from '@/types';
import { getDataRoot } from '@/lib/data-root';

const PANORAMA_VARIANT_WIDTHS = [2048, 4096, 6144];

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

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

  const panoramasDir = path.join(
    getDataRoot(),
    'uploads',
    'projects',
    projectId,
    'panoramas'
  );

  let changed = false;
  let generatedFiles = 0;

  for (const panorama of config.panoramas) {
    const sourcePath = path.join(panoramasDir, panorama.file);
    if (!(await fileExists(sourcePath))) continue;

    const metadata = await sharp(sourcePath).metadata();
    if (!metadata.width || !metadata.height) continue;

    const sourceWidth = metadata.width;
    const sourceHeight = metadata.height;
    const aspectRatio = sourceWidth / sourceHeight;
    const sourceBase = panorama.file.replace(/\.[^.]+$/, '');

    const nextVariants: PanoramaVariant[] = [];
    for (const width of PANORAMA_VARIANT_WIDTHS.filter((w) => w < sourceWidth)) {
      const height = Math.max(1, Math.round(width / aspectRatio));
      const variantFile = `${sourceBase}_${width}.webp`;
      const variantPath = path.join(panoramasDir, variantFile);

      if (!(await fileExists(variantPath))) {
        await sharp(sourcePath)
          .resize({
            width,
            height,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: width >= 6144 ? 85 : 82 })
          .toFile(variantPath);
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
