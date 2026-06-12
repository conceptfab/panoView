'use client';

import { Button } from '@/components/ui/button';
import {
  RotateCw,
  Maximize,
  Minimize,
  Camera,
  Home,
  ImagePlus,
  Loader2,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ViewerControlsProps {
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  onFullscreen: () => void;
  onScreenshot: () => void;
  onHome: () => void;
  isAdmin?: boolean;
  onGenerateThumbnail?: () => Promise<void>;
}

const controlClassName =
  'size-11 bg-black/50 hover:bg-black/70 text-white border-0';

export function ViewerControls({
  autoRotate,
  onToggleAutoRotate,
  onFullscreen,
  onScreenshot,
  onHome,
  isAdmin,
  onGenerateThumbnail,
}: ViewerControlsProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);

  const handleGenerateThumbnail = async () => {
    if (!onGenerateThumbnail || isGeneratingThumbnail) return;
    setIsGeneratingThumbnail(true);
    try {
      await onGenerateThumbnail();
    } finally {
      setIsGeneratingThumbnail(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex gap-2 z-40">
      <Button
        variant="secondary"
        size="icon"
        className={controlClassName}
        onClick={onHome}
        aria-label="Powrót do startu panoramy"
      >
        <Home className="size-5" />
      </Button>

      <Button
        variant="secondary"
        size="icon"
        className={controlClassName}
        onClick={onToggleAutoRotate}
        aria-label={
          autoRotate ? 'Wyłącz auto-rotację' : 'Włącz auto-rotację'
        }
        aria-pressed={autoRotate}
      >
        <RotateCw
          className={cn('size-5', autoRotate && 'motion-safe:animate-spin')}
          style={{ animationDuration: '900ms' }}
        />
      </Button>

      <Button
        variant="secondary"
        size="icon"
        className={controlClassName}
        onClick={onScreenshot}
        aria-label="Zrób zrzut ekranu panoramy"
      >
        <Camera className="size-5" />
      </Button>

      {isAdmin && onGenerateThumbnail && (
        <Button
          variant="secondary"
          size="icon"
          className="size-11 bg-amber-600/80 hover:bg-amber-500/90 text-white border-0"
          onClick={handleGenerateThumbnail}
          disabled={isGeneratingThumbnail}
          aria-label="Generuj miniaturkę z aktualnego widoku"
        >
          {isGeneratingThumbnail ? (
            <Loader2 className="size-5 motion-safe:animate-spin" />
          ) : (
            <ImagePlus className="size-5" />
          )}
        </Button>
      )}

      <Button
        variant="secondary"
        size="icon"
        className={controlClassName}
        onClick={onFullscreen}
        aria-label={
          isFullscreen ? 'Wyjdź z pełnego ekranu' : 'Pełny ekran'
        }
      >
        {isFullscreen ? (
          <Minimize className="size-5" />
        ) : (
          <Maximize className="size-5" />
        )}
      </Button>
    </div>
  );
}
