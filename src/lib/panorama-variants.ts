import { Panorama } from '@/types';

function targetVariantWidthForViewport(effectiveWidth: number): number {
  if (effectiveWidth <= 1400) return 2048;
  if (effectiveWidth <= 2200) return 4096;
  if (effectiveWidth <= 3200) return 6144;
  return Number.MAX_SAFE_INTEGER;
}

export function getEffectiveViewportWidth(): number {
  if (typeof window === 'undefined') return 1920;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const viewportWidth = Math.max(1, window.innerWidth);
  return Math.round(viewportWidth * dpr);
}

export interface ResolvedPanoramaVariant {
  file: string;
  width?: number;
  height?: number;
}

export function resolvePanoramaVariant(
  panorama: Panorama,
  optimizeForScreen: boolean,
  effectiveWidth: number
): ResolvedPanoramaVariant {
  const variants = [...(panorama.variants ?? [])]
    .filter((v) => Number.isFinite(v.width) && v.width > 0 && !!v.file)
    .sort((a, b) => a.width - b.width);

  if (variants.length === 0) {
    return { file: panorama.file };
  }

  if (!optimizeForScreen) {
    const max = variants[variants.length - 1];
    return {
      file: max?.file ?? panorama.file,
      width: max?.width,
      height: max?.height,
    };
  }

  const targetWidth = targetVariantWidthForViewport(effectiveWidth);
  const baselineSelection =
    variants.find((v) => v.width >= targetWidth) ?? variants[variants.length - 1];
  const baselineIndex = variants.findIndex(
    (v) =>
      v.file === baselineSelection.file &&
      v.width === baselineSelection.width &&
      v.height === baselineSelection.height
  );
  const selected =
    baselineIndex >= 0
      ? variants[Math.min(baselineIndex + 1, variants.length - 1)]
      : baselineSelection;

  return {
    file: selected?.file ?? panorama.file,
    width: selected?.width,
    height: selected?.height,
  };
}

export function resolvePanoramaVariantFile(
  panorama: Panorama,
  optimizeForScreen: boolean,
  effectiveWidth: number
): string {
  return resolvePanoramaVariant(panorama, optimizeForScreen, effectiveWidth).file;
}
