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

interface ViewerControlsProps {
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  onFullscreen: () => void;
  onScreenshot: () => void;
  onHome: () => void;
  isAdmin?: boolean;
  onGenerateThumbnail?: () => Promise<void>;
}

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
    <div className="absolute top-6 right-6 flex gap-2 z-40">
      <Button
        variant="secondary"
        size="icon"
        className="bg-black/50 hover:bg-black/70 text-white border-0"
        onClick={onHome}
        title="Powrót do startu"
      >
        <Home className="size-5" />
      </Button>

      <Button
        variant="secondary"
        size="icon"
        className="bg-black/50 hover:bg-black/70 text-white border-0"
        onClick={onToggleAutoRotate}
        title={autoRotate ? 'Wyłącz auto-rotację' : 'Włącz auto-rotację'}
      >
        <RotateCw
          className={`size-5 ${autoRotate ? 'animate-spin' : ''}`}
          style={{ animationDuration: '900ms' }}
        />
      </Button>

      <Button
        variant="secondary"
        size="icon"
        className="bg-black/50 hover:bg-black/70 text-white border-0"
        onClick={onScreenshot}
        title="Zrzut ekranu"
      >
        <Camera className="size-5" />
      </Button>

      {isAdmin && onGenerateThumbnail && (
        <Button
          variant="secondary"
          size="icon"
          className="bg-amber-600/80 hover:bg-amber-500/90 text-white border-0"
          onClick={handleGenerateThumbnail}
          disabled={isGeneratingThumbnail}
          title="Generuj miniaturkę z aktualnego widoku"
        >
          {isGeneratingThumbnail ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <ImagePlus className="size-5" />
          )}
        </Button>
      )}

      <Button
        variant="secondary"
        size="icon"
        className="bg-black/50 hover:bg-black/70 text-white border-0"
        onClick={onFullscreen}
        title={isFullscreen ? 'Wyjdź z pełnego ekranu' : 'Pełny ekran'}
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
