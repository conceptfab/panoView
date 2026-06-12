'use client';

// oxlint-disable react-doctor/no-giant-component react-doctor/prefer-useReducer react-doctor/no-cascading-set-state

import { useEffect, useRef, useState, useCallback } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import { ProjectConfig, Hotspot, Position3D } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Copy,
  Loader2,
  RotateCw,
  Camera,
  Maximize,
} from 'lucide-react';
import { toast } from 'sonner';
import { generateId } from '@/utils/helpers';
import {
  getEffectiveViewportWidth,
  resolvePanoramaVariant,
  resolvePanoramaVariantFile,
} from '@/lib/panorama-variants';

interface HotspotEditorProps {
  projectId: string;
  projectName: string;
  initialConfig: ProjectConfig;
}

export function HotspotEditor({
  projectId,
  projectName,
  initialConfig,
}: HotspotEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<unknown>(null);
  const currentPanoramaRef = useRef<unknown>(null);
  const scriptsLoadedRef = useRef(false);

  const [config, setConfig] = useState<ProjectConfig>(() => initialConfig);
  const [threeLoaded, setThreeLoaded] = useState(false);
  const [currentPanoramaIndex, setCurrentPanoramaIndex] = useState(0);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(
    null
  );
  const [clickedPosition, setClickedPosition] = useState<Position3D | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [currentOptimizedSize, setCurrentOptimizedSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [showOptimizationInfo, setShowOptimizationInfo] = useState(false);
  const shownStartupOptimizationInfoRef = useRef(false);
  const [isAddingMode, setIsAddingMode] = useState(false);
  const markerRef = useRef<unknown>(null);
  const isAddingModeRef = useRef(false);
  const configRef = useRef(initialConfig);
  const hotspotMarkersRef = useRef<unknown[]>([]);
  const existingHotspotTextureRef = useRef<unknown>(null);
  const currentPanoramaIndexRef = useRef(0);

  // Keep refs in sync with state
  useEffect(() => {
    isAddingModeRef.current = isAddingMode;
  }, [isAddingMode]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    currentPanoramaIndexRef.current = currentPanoramaIndex;
  }, [currentPanoramaIndex]);

  const currentPanorama = config.panoramas[currentPanoramaIndex];
  const selectedHotspot = currentPanorama?.hotspots.find(
    (h) => h.id === selectedHotspotId
  );
  const basePath = `/uploads/projects/${projectId}`;

  // Create marker texture for hotspot position
  const createMarkerTexture = useCallback(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Outer ring
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Inner dot
    ctx.beginPath();
    ctx.arc(32, 32, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();

    // Crosshair lines
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(32, 4);
    ctx.lineTo(32, 18);
    ctx.moveTo(32, 46);
    ctx.lineTo(32, 60);
    ctx.moveTo(4, 32);
    ctx.lineTo(18, 32);
    ctx.moveTo(46, 32);
    ctx.lineTo(60, 32);
    ctx.stroke();

    const texture = new window.THREE.CanvasTexture(canvas);
    return texture;
  }, []);

  // Tekstura znacznika istniejącego hotspota (z uwzględnieniem customowego koloru)
  const createExistingHotspotTexture = useCallback((isSelected: boolean, customColor?: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const color = customColor || (isSelected ? '#f59e0b' : '#22d3ee');
    ctx.beginPath();
    ctx.arc(32, 32, 26, 0, Math.PI * 2);
    ctx.strokeStyle = isSelected && !customColor ? '#f59e0b' : color;
    ctx.lineWidth = 4;
    ctx.stroke();

    if (isSelected && customColor) {
      ctx.beginPath();
      ctx.arc(32, 32, 30, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(32, 32, 10, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    return new window.THREE.CanvasTexture(canvas);
  }, []);

  // Etykieta hotspotu wyświetlana nad markerem w widoku sceny.
  const createHotspotLabelTexture = useCallback(
    (text: string, isLink: boolean, isSelected: boolean, customColor?: string) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      const font = '600 34px Inter, sans-serif';
      ctx.font = font;
      const textWidth = Math.ceil(ctx.measureText(text).width);
      const paddingX = 28;
      const width = Math.max(320, textWidth + paddingX * 2);
      const height = 92;
      const radius = 20;

      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);

      ctx.beginPath();
      ctx.moveTo(radius, 0);
      ctx.lineTo(width - radius, 0);
      ctx.quadraticCurveTo(width, 0, width, radius);
      ctx.lineTo(width, height - radius);
      ctx.quadraticCurveTo(width, height, width - radius, height);
      ctx.lineTo(radius, height);
      ctx.quadraticCurveTo(0, height, 0, height - radius);
      ctx.lineTo(0, radius);
      ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.closePath();
      ctx.fillStyle = isSelected ? 'rgba(217, 119, 6, 0.85)' : 'rgba(0, 0, 0, 0.70)';
      ctx.fill();
      ctx.lineWidth = 4;
      const borderColor = customColor ? customColor : (isLink ? 'rgba(34, 211, 238, 0.95)' : 'rgba(245, 158, 11, 0.95)');
      ctx.strokeStyle = isSelected
        ? 'rgba(255, 255, 255, 0.95)'
        : borderColor;
      ctx.stroke();

      ctx.font = font;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, width / 2, height / 2);

      const texture = new window.THREE.CanvasTexture(canvas);
      return { texture, aspect: width / height };
    },
    []
  );

  // Usuń znaczniki istniejących hotspotów ze sceny i zwolnij zasoby
  const clearHotspotMarkers = useCallback(
    (viewer: { scene: { remove: (o: unknown) => void } }) => {
      for (const m of hotspotMarkersRef.current) {
        viewer.scene.remove(m);
        const sprite = m as {
          material?: { map?: { dispose: () => void }; dispose: () => void };
        };
        sprite.material?.map?.dispose?.();
        sprite.material?.dispose?.();
      }
      hotspotMarkersRef.current = [];
      const tex = existingHotspotTextureRef.current;
      if (Array.isArray(tex)) {
        tex.forEach(t => t.dispose?.());
      } else if (tex && typeof tex === 'object' && 'dispose' in tex) {
        (tex as { dispose: () => void }).dispose();
      }
      existingHotspotTextureRef.current = null;
    },
    []
  );

  // Dodaj znaczniki dla istniejących hotspotów na panoramie
  const addHotspotMarkers = useCallback(
    (viewer: { scene: { add: (o: unknown) => void } }, hotspots: Hotspot[]) => {
      if (!hotspots?.length || !window.THREE) return;
      const THREE = window.THREE;

      const textures: unknown[] = [];

      const panoramas = configRef.current.panoramas;
      const panoramaNameById = new Map(
        panoramas.map((p, idx) => [p.id, `#${idx + 1} - ${p.name}`])
      );
      for (const hp of hotspots) {
        const markerX = -hp.position.x;
        const markerY = hp.position.y;
        const markerZ = hp.position.z;

        const isSelected = hp.id === selectedHotspotId;
        const texture = createExistingHotspotTexture(isSelected, hp.color);
        textures.push(texture);

        const mat = new THREE.SpriteMaterial({
          map: texture,
          depthTest: false,
          transparent: true,
          opacity: isSelected ? 1.0 : 0.8,
        });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(250, 250, 1);
        // Konwersja jak przy zapisie: config ma (-pt.x, pt.y, pt.z)
        sprite.position.set(markerX, markerY, markerZ);
        viewer.scene.add(sprite);
        hotspotMarkersRef.current.push(sprite);

        const linkTargetName =
          hp.type === 'link'
            ? panoramaNameById.get(hp.target) ?? hp.target
            : null;
        const labelText =
          hp.type === 'link'
            ? `${hp.title} -> ${linkTargetName}`
            : `${hp.title} (info)`;

        const { texture: labelTexture, aspect } = createHotspotLabelTexture(
          labelText,
          hp.type === 'link',
          isSelected,
          hp.color
        );
        textures.push(labelTexture);
        const labelMat = new THREE.SpriteMaterial({
          map: labelTexture,
          depthTest: false,
          transparent: true,
        });
        const labelSprite = new THREE.Sprite(labelMat);
        const labelHeight = 120;
        const labelWidth = Math.round(labelHeight * aspect);
        labelSprite.scale.set(labelWidth, labelHeight, 1);

        const len = Math.sqrt(
          markerX * markerX + markerY * markerY + markerZ * markerZ
        );
        const nx = len > 0 ? markerX / len : 0;
        const ny = len > 0 ? markerY / len : 0;
        const nz = len > 0 ? markerZ / len : 0;
        labelSprite.position.set(
          markerX + nx * 180,
          markerY + ny * 180 + 120,
          markerZ + nz * 180
        );

        viewer.scene.add(labelSprite);
        hotspotMarkersRef.current.push(labelSprite);
      }

      existingHotspotTextureRef.current = textures;
    },
    [createExistingHotspotTexture, createHotspotLabelTexture, selectedHotspotId]
  );

  // Load single panorama
  const loadPanorama = useCallback(
    (index: number) => {
      if (!window.PANOLENS || !window.THREE) return;

      const viewer = viewerRef.current as {
        add?: (p: unknown) => void;
        remove?: (p: unknown) => void;
        setPanorama?: (p: unknown) => void;
        tweenControlCenter?: (v: unknown, d: number) => void;
        scene?: { remove: (o: unknown) => void; add: (o: unknown) => void };
        camera?: unknown;
        panorama?: unknown;
      };
      if (!viewer?.scene) return;

      const viewerWithScene = viewer as {
        scene: { remove: (o: unknown) => void; add: (o: unknown) => void };
      };

      setIsLoading(true);

      const THREE = window.THREE;
      const PANOLENS = window.PANOLENS;

      // Usuń stare znaczniki hotspotów
      clearHotspotMarkers(viewerWithScene);

      // Remove old panorama
      if (currentPanoramaRef.current) {
        viewer.remove?.(currentPanoramaRef.current);
        (currentPanoramaRef.current as { dispose?: () => void }).dispose?.();
        currentPanoramaRef.current = null;
      }

      const panoData = configRef.current.panoramas[index];
      if (!panoData) {
        setCurrentOptimizedSize(null);
        setIsLoading(false);
        return;
      }

      const effectiveWidth = getEffectiveViewportWidth();
      const selectedVariant = resolvePanoramaVariant(
        panoData,
        configRef.current.settings.optimizePanoramaForScreen,
        effectiveWidth
      );
      if (
        configRef.current.settings.optimizePanoramaForScreen &&
        selectedVariant.width != null &&
        selectedVariant.height != null
      ) {
        setCurrentOptimizedSize({
          width: selectedVariant.width,
          height: selectedVariant.height,
        });
      } else {
        setCurrentOptimizedSize(null);
      }

      const imageFile = resolvePanoramaVariantFile(
        panoData,
        configRef.current.settings.optimizePanoramaForScreen,
        effectiveWidth
      );
      const imagePath = `${basePath}/panoramas/${imageFile}`;
      if (
        configRef.current.settings.optimizePanoramaForScreen &&
        (selectedVariant.width == null || selectedVariant.height == null)
      ) {
        const probe = new Image();
        probe.onload = () => {
          if (
            currentPanoramaIndexRef.current === index &&
            probe.naturalWidth > 0 &&
            probe.naturalHeight > 0
          ) {
            setCurrentOptimizedSize({
              width: probe.naturalWidth,
              height: probe.naturalHeight,
            });
          }
        };
        probe.src = imagePath;
      }
      const panorama = new PANOLENS.ImagePanorama(imagePath);

      panorama.addEventListener('enter-fade-start', () => {
        const pos = panoData.initialPosition;
        viewer.tweenControlCenter?.(
          new THREE.Vector3(pos.x, pos.y, pos.z),
          400
        );
        addHotspotMarkers(viewerWithScene, panoData.hotspots ?? []);
        setIsLoading(false);
      });

      currentPanoramaRef.current = panorama;
      viewer.add?.(panorama);
      viewer.setPanorama?.(panorama);
    },
    [basePath, clearHotspotMarkers, addHotspotMarkers]
  );

  const initViewer = useCallback(() => {
    if (!containerRef.current || !window.PANOLENS || !window.THREE) return;
    if (viewerRef.current) return; // Already initialized

    const THREE = window.THREE;
    const PANOLENS = window.PANOLENS;

    const viewer = new PANOLENS.Viewer({
      container: containerRef.current,
      controlBar: false,
      cameraFov: 55,
    });

    viewerRef.current = viewer;

    // Click handler for coordinate picking
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Create marker sprite
    const markerTexture = createMarkerTexture();
    const markerMaterial = new THREE.SpriteMaterial({
      map: markerTexture,
      depthTest: false,
      transparent: true,
    });
    const marker = new THREE.Sprite(markerMaterial);
    marker.scale.set(300, 300, 1);
    marker.visible = false;
    viewer.scene.add(marker);
    markerRef.current = marker;

    containerRef.current.addEventListener('click', (event: MouseEvent) => {
      if (!viewer.panorama || !isAddingModeRef.current) return;

      const rect = containerRef.current!.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, viewer.camera);
      const hits = raycaster.intersectObject(viewer.panorama, true);

      if (hits.length > 0) {
        const pt = hits[0].point;

        // Update marker position
        marker.position.set(pt.x, pt.y, pt.z);
        marker.visible = true;

        // Negate X as in original editor
        setClickedPosition({
          x: Math.round(-pt.x),
          y: Math.round(pt.y),
          z: Math.round(pt.z),
        });
      }
    });

    // Load first panorama after viewer is ready
    loadPanorama(0);
  }, [loadPanorama, createMarkerTexture]);

  // Po zmianie config (dodanie/usunięcie hotspota) odśwież znaczniki na panoramie
  useEffect(() => {
    const viewer = viewerRef.current as {
      scene?: { remove: (o: unknown) => void; add: (o: unknown) => void };
    } | null;
    if (!viewer?.scene) return;
    const viewerWithScene = viewer as {
      scene: { remove: (o: unknown) => void; add: (o: unknown) => void };
    };
    const idx = currentPanoramaIndexRef.current;
    const pano = configRef.current.panoramas[idx];
    if (!pano) return;
    clearHotspotMarkers(viewerWithScene);
    addHotspotMarkers(viewerWithScene, pano.hotspots ?? []);
  }, [config, clearHotspotMarkers, addHotspotMarkers, selectedHotspotId]);

  useEffect(() => {
    return () => {
      if (currentPanoramaRef.current) {
        (currentPanoramaRef.current as { dispose?: () => void }).dispose?.();
      }
      if (viewerRef.current) {
        (viewerRef.current as { dispose?: () => void }).dispose?.();
      }
    };
  }, []);

  const handlePanoramaChange = (index: number) => {
    setCurrentPanoramaIndex(index);
    setSelectedHotspotId(null);
    setClickedPosition(null);
    setIsAddingMode(false);
    if (markerRef.current) {
      (markerRef.current as { visible: boolean }).visible = false;
    }
    loadPanorama(index);
  };


  const handleAddHotspot = () => {
    if (!clickedPosition) {
      toast.error('Kliknij w panoramę, aby wybrać pozycję');
      return;
    }

    const nextNumber = (currentPanorama?.hotspots.length ?? 0) + 1;
    const newHotspot: Hotspot = {
      id: generateId('hs'),
      type: 'link',
      position: clickedPosition,
      target: config.panoramas[0]?.id || '',
      title: `Hotspot ${nextNumber}`,
      icon: 'arrow-up',
      scale: 1.0,
    };

    setConfig((prev) => {
      const updated = { ...prev };
      updated.panoramas = [...prev.panoramas];
      updated.panoramas[currentPanoramaIndex] = {
        ...updated.panoramas[currentPanoramaIndex],
        hotspots: [
          ...updated.panoramas[currentPanoramaIndex].hotspots,
          newHotspot,
        ],
      };
      return updated;
    });

    // Hide marker and exit adding mode
    if (markerRef.current) {
      (markerRef.current as { visible: boolean }).visible = false;
    }
    setClickedPosition(null);
    setIsAddingMode(false);
    setSelectedHotspotId(newHotspot.id);
    toast.success('Hotspot dodany');
  };

  const toggleAddingMode = () => {
    const newMode = !isAddingMode;
    setIsAddingMode(newMode);
    if (!newMode && markerRef.current) {
      (markerRef.current as { visible: boolean }).visible = false;
      setClickedPosition(null);
    }
    if (newMode) {
      toast.info('Kliknij w panoramę, aby wybrać pozycję hotspota');
    }
  };

  const handleDeleteHotspot = (hotspotId: string) => {
    setConfig((prev) => {
      const updated = { ...prev };
      updated.panoramas = [...prev.panoramas];
      updated.panoramas[currentPanoramaIndex] = {
        ...updated.panoramas[currentPanoramaIndex],
        hotspots: updated.panoramas[currentPanoramaIndex].hotspots.filter(
          (h) => h.id !== hotspotId
        ),
      };
      return updated;
    });

    if (selectedHotspotId === hotspotId) {
      setSelectedHotspotId(null);
    }
    toast.success('Hotspot usunięty');
  };

  const handleUpdateHotspot = (
    hotspotId: string,
    updates: Partial<Hotspot>
  ) => {
    setConfig((prev) => {
      const updated = { ...prev };
      updated.panoramas = [...prev.panoramas];
      updated.panoramas[currentPanoramaIndex] = {
        ...updated.panoramas[currentPanoramaIndex],
        hotspots: updated.panoramas[currentPanoramaIndex].hotspots.map((h) =>
          h.id === hotspotId ? ({ ...h, ...updates } as Hotspot) : h
        ),
      };
      return updated;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!res.ok) throw new Error('Failed to save');
      toast.success('Konfiguracja zapisana');
    } catch {
      toast.error('Nie udało się zapisać');
    } finally {
      setIsSaving(false);
    }
  };

  const copyCoordinates = () => {
    if (clickedPosition) {
      const text = `${clickedPosition.x}, ${clickedPosition.y}, ${clickedPosition.z}`;
      navigator.clipboard.writeText(text);
      toast.success('Współrzędne skopiowane');
    }
  };

  const toggleAutoRotate = () => {
    const viewer = viewerRef.current as {
      OrbitControls?: { autoRotate: boolean };
    };
    if (viewer?.OrbitControls) {
      const newValue = !autoRotate;
      viewer.OrbitControls.autoRotate = newValue;
      setAutoRotate(newValue);
      toast.success(
        newValue ? 'Auto-rotacja włączona' : 'Auto-rotacja wyłączona'
      );
    }
  };

  const takeScreenshot = () => {
    const viewer = viewerRef.current as {
      getRenderer?: () => { domElement: HTMLCanvasElement };
    };
    if (viewer?.getRenderer) {
      const canvas = viewer.getRenderer().domElement;
      const link = document.createElement('a');
      link.download = `panorama-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Screenshot zapisany');
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const optimizationInfoText =
    config.settings.optimizePanoramaForScreen && currentOptimizedSize
      ? `Załadowano zoptymalizowaną panoramę: ${currentOptimizedSize.width} x ${currentOptimizedSize.height}`
      : null;

  useEffect(() => {
    if (!optimizationInfoText || currentPanoramaIndex !== 0) {
      setShowOptimizationInfo(false);
      return;
    }
    if (shownStartupOptimizationInfoRef.current) {
      setShowOptimizationInfo(false);
      return;
    }
    shownStartupOptimizationInfoRef.current = true;
    setShowOptimizationInfo(true);
    const timer = setTimeout(() => {
      setShowOptimizationInfo(false);
    }, 20000);
    return () => clearTimeout(timer);
  }, [optimizationInfoText, currentPanoramaIndex]);

  return (
    <>
      <Script
        src="/panolens/three.min.js"
        strategy="afterInteractive"
        onLoad={() => {
          window.process = window.process || { env: {} };
          setThreeLoaded(true);
        }}
      />
      {threeLoaded && (
        <Script
          src="/panolens/panolens.min.js"
          strategy="afterInteractive"
          onLoad={() => {
            scriptsLoadedRef.current = true;
            setTimeout(initViewer, 100);
          }}
        />
      )}

      <div className="fixed inset-0 flex bg-zinc-900">
        {/* Viewer */}
        <div className="flex-1 relative">
          <div
            ref={containerRef}
            className={`w-full h-full ${isAddingMode ? 'cursor-crosshair' : ''
              }`}
          />

          {/* Loading indicator */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
              <div className="flex items-center gap-3 bg-black/70 text-white px-4 py-2 rounded-lg">
                <Loader2 className="size-5 animate-spin" />
                <span>Ładowanie panoramy…</span>
              </div>
            </div>
          )}

          {/* Top bar */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href={`/admin/projects/${projectId}`}>
                <Button variant="secondary" size="xs" className="h-7 text-[10px] px-2">
                  <ArrowLeft className="size-3 mr-1" />
                  Powrót
                </Button>
              </Link>
              <span className="text-white font-medium text-xs">{projectName}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="icon-xs"
                className={`size-7 ${autoRotate
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : ''
                  }`}
                onClick={toggleAutoRotate}
                title="Auto-rotacja"
              >
                <RotateCw className="size-3.5" />
              </Button>
              <Button
                variant="secondary"
                size="icon-xs"
                className="size-7"
                onClick={takeScreenshot}
                title="Screenshot"
              >
                <Camera className="size-3.5" />
              </Button>
              <Button
                variant="secondary"
                size="icon-xs"
                className="size-7"
                onClick={toggleFullscreen}
                title="Pełny ekran"
              >
                <Maximize className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Coordinates display */}
          {isAddingMode && clickedPosition && (
            <div className="absolute bottom-3 left-3 bg-black/70 text-white px-2.5 py-1.5 rounded-md flex items-center gap-2">
              <span className="font-mono text-[10px]">
                {clickedPosition.x}, {clickedPosition.y}, {clickedPosition.z}
              </span>
              <Button variant="ghost" size="icon-xs" className="size-5" onClick={copyCoordinates}>
                <Copy className="size-3" />
              </Button>
            </div>
          )}

          {/* Adding mode indicator */}
          {isAddingMode && (
            <div className="absolute bottom-3 right-3 bg-primary text-primary-foreground px-3 py-1 rounded-md text-[10px] font-medium">
              Tryb dodawania
            </div>
          )}

          {optimizationInfoText &&
            showOptimizationInfo &&
            !isLoading && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none z-30">
                <div className="bg-black/55 text-white text-xs sm:text-sm px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/20 whitespace-nowrap">
                  {optimizationInfoText}
                </div>
              </div>
            )}
        </div>

        {/* Side panel */}
        <div className="w-72 bg-white dark:bg-zinc-950 border-l flex flex-col">
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 scrollbar-hide">
            {/* Panorama selector */}
            <Card>
              <CardHeader className="p-3.5 pb-2">
                <CardTitle className="text-xs font-semibold">Panorama</CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-0">
                <Select
                  value={String(currentPanoramaIndex)}
                  onValueChange={(v) => handlePanoramaChange(Number(v))}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {config.panoramas.map((p, i) => (
                      <SelectItem key={p.id} value={String(i)} className="text-xs">
                        #{i + 1} - {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>


            {/* Add hotspot */}
            <Card className={isAddingMode ? 'ring-2 ring-primary' : ''}>
              <CardHeader className="p-3.5 pb-2">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  Dodaj hotspot
                  {isAddingMode && (
                    <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                      Aktywny
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-0 space-y-2.5">
                <Button
                  className="w-full h-9 text-xs"
                  variant={isAddingMode ? 'default' : 'outline'}
                  onClick={toggleAddingMode}
                  size="sm"
                >
                  {isAddingMode ? (
                    <>
                      <Copy className="size-3.5 mr-1.5" />
                      Anuluj
                    </>
                  ) : (
                    <>
                      <Plus className="size-3.5 mr-1.5" />
                      Wybierz pozycję
                    </>
                  )}
                </Button>

                {isAddingMode && clickedPosition && (
                  <div className="space-y-1.5 text-center">
                    <p className="text-[10px] text-muted-foreground">
                      Poz: <span className="font-mono">{clickedPosition.x},{clickedPosition.y},{clickedPosition.z}</span>
                    </p>
                    <Button className="w-full h-8 text-xs" onClick={handleAddHotspot} size="sm">
                      <Plus className="size-3.5 mr-1.5" />
                      Dodaj tutaj
                    </Button>
                  </div>
                )}

                {isAddingMode && !clickedPosition && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    Kliknij w panoramę
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Hotspot list */}
            <Card>
              <CardHeader className="p-3.5 pb-2">
                <CardTitle className="text-xs font-semibold">
                  Hotspoty ({currentPanorama?.hotspots.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-0 space-y-2">
                {currentPanorama?.hotspots.map((hotspot) => (
                  <div
                    key={hotspot.id}
                    className={`p-2.5 rounded-md border cursor-pointer transition-colors ${selectedHotspotId === hotspot.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
	                      }`}
	                    onClick={() => setSelectedHotspotId(hotspot.id)}
	                    onKeyDown={(event) => {
	                      if (event.key === 'Enter' || event.key === ' ') {
	                        event.preventDefault();
	                        setSelectedHotspotId(hotspot.id);
	                      }
	                    }}
	                    role="button"
	                    tabIndex={0}
	                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium truncate">
                        {hotspot.title}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-5"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteHotspot(hotspot.id);
                        }}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-none">
                      {hotspot.type === 'link' ? 'Link' : 'Info'}
                    </p>
                  </div>
                ))}

                {(!currentPanorama ||
                  currentPanorama.hotspots.length === 0) && (
                    <p className="text-[10px] text-muted-foreground text-center py-2">
                      Brak hotspotów
                    </p>
                  )}
              </CardContent>
            </Card>

            {/* Hotspot editor */}
            {selectedHotspot && (
              <Card>
                <CardHeader className="p-3.5 pb-2">
                  <CardTitle className="text-xs font-semibold">Edycja hotspotu</CardTitle>
                </CardHeader>
                <CardContent className="p-3.5 pt-0 space-y-3.5">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground/70">Tytuł</Label>
                    <Input
                      className="h-9 text-xs"
                      value={selectedHotspot.title}
                      onChange={(e) =>
                        handleUpdateHotspot(selectedHotspot.id, {
                          title: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground/70">Typ</Label>
                    <Select
                      value={selectedHotspot.type}
                      onValueChange={(v) =>
                        handleUpdateHotspot(selectedHotspot.id, {
                          type: v as 'link' | 'info',
                        })
                      }
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="link" className="text-xs">Link</SelectItem>
                        <SelectItem value="info" className="text-xs">Info</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedHotspot.type === 'link' && (
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground/70">Cel</Label>
                      <Select
                        value={selectedHotspot.target}
                        onValueChange={(v) =>
                          handleUpdateHotspot(selectedHotspot.id, { target: v })
                        }
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {config.panoramas.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="text-xs">
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground/70">Pozycja</Label>
                    <div className="grid grid-cols-3 gap-1">
                      <Input
                        className="h-7 text-xs px-1 text-center"
                        type="number"
                        value={selectedHotspot.position.x}
                        onChange={(e) =>
                          handleUpdateHotspot(selectedHotspot.id, {
                            position: {
                              ...selectedHotspot.position,
                              x: Number(e.target.value),
                            },
                          })
                        }
                      />
                      <Input
                        className="h-7 text-xs px-1 text-center"
                        type="number"
                        value={selectedHotspot.position.y}
                        onChange={(e) =>
                          handleUpdateHotspot(selectedHotspot.id, {
                            position: {
                              ...selectedHotspot.position,
                              y: Number(e.target.value),
                            },
                          })
                        }
                      />
                      <Input
                        className="h-7 text-xs px-1 text-center"
                        type="number"
                        value={selectedHotspot.position.z}
                        onChange={(e) =>
                          handleUpdateHotspot(selectedHotspot.id, {
                            position: {
                              ...selectedHotspot.position,
                              z: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="xs"
                      className="w-full text-[10px] h-7"
                      onClick={() => {
                        if (clickedPosition) {
                          handleUpdateHotspot(selectedHotspot.id, {
                            position: clickedPosition,
                          });
                          toast.success('Pozycja zaktualizowana');
                        }
                      }}
                      disabled={!clickedPosition}
                    >
                      Użyj klikniętej
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground/70">Kolor znacznika</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        className="h-8 w-12 p-1 cursor-pointer"
                        value={selectedHotspot.color || '#22d3ee'}
                        onChange={(e) =>
                          handleUpdateHotspot(selectedHotspot.id, {
                            color: e.target.value,
                          })
                        }
                      />
                      <Button
                        variant="secondary"
                        size="xs"
                        className="h-8 text-[10px]"
                        onClick={() =>
                          handleUpdateHotspot(selectedHotspot.id, {
                            color: undefined,
                          })
                        }
                      >
                        Domyślny
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Save button at bottom */}
          <div className="p-3.5 border-t bg-white dark:bg-zinc-950">
            <Button className="w-full h-10 text-xs" onClick={handleSave} disabled={isSaving} size="sm">
              {isSaving ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Save className="size-4 mr-2" />
              )}
              Zapisz zmiany
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
