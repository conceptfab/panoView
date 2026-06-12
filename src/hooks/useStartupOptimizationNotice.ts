'use client';

import { useEffect, useRef, useState } from 'react';

/** Jednorazowy komunikat o zoptymalizowanej panoramie (pierwsza panorama, auto-hide 20s). */
export function useStartupOptimizationNotice(
  enabled: boolean,
  currentPanoramaIndex: number
): boolean {
  const shownRef = useRef(false);
  const [visible, setVisible] = useState(false);
  const prevEnabledRef = useRef(enabled);
  const prevIndexRef = useRef(currentPanoramaIndex);

  if (
    enabled !== prevEnabledRef.current ||
    currentPanoramaIndex !== prevIndexRef.current
  ) {
    prevEnabledRef.current = enabled;
    prevIndexRef.current = currentPanoramaIndex;

    if (!enabled || currentPanoramaIndex !== 0) {
      if (visible) setVisible(false);
    } else if (!shownRef.current) {
      shownRef.current = true;
      if (!visible) setVisible(true);
    } else if (visible) {
      setVisible(false);
    }
  }

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), 20000);
    return () => clearTimeout(timer);
  }, [visible]);

  return visible;
}
