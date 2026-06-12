'use client';

// oxlint-disable react-doctor/no-cascading-set-state

import { useState, useEffect } from 'react';
import { Project } from '@/types';
import { ProjectThumbnail } from './ProjectThumbnail';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Grid3X3, Grid2X2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type GridSize = 'large' | 'medium' | 'small';

interface ProjectGridProps {
  projects: Project[];
}

const GRID_SIZE_KEY = 'gallery-grid-size';

const gridConfig: Record<
  GridSize,
  { cols: string; label: string; icon: typeof LayoutGrid }
> = {
  large: {
    cols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    label: 'Duży',
    icon: Grid2X2,
  },
  medium: {
    cols: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
    label: 'Średni',
    icon: Grid3X3,
  },
  small: {
    cols: 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
    label: 'Mały',
    icon: LayoutGrid,
  },
};

export function ProjectGrid({ projects }: ProjectGridProps) {
  const [gridSize, setGridSize] = useState<GridSize>('large');
  const [mounted, setMounted] = useState(false);

  // Załaduj preferencje z localStorage po zamontowaniu (setState w timeout, żeby uniknąć synchronicznego setState w effect)
  useEffect(() => {
    const saved = localStorage.getItem(GRID_SIZE_KEY) as GridSize | null;
    const timer = setTimeout(() => {
      setMounted(true);
      if (saved && gridConfig[saved]) {
        setGridSize(saved);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Zapisz preferencje do localStorage
  const handleSizeChange = (size: GridSize) => {
    setGridSize(size);
    localStorage.setItem(GRID_SIZE_KEY, size);
  };

  // Zapobiegaj hydration mismatch
  if (!mounted) {
    return (
      <div className={cn('grid gap-6', gridConfig.large.cols)}>
        {projects.map((project) => (
          <ProjectThumbnail key={project.id} project={project} size="large" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Przyciski rozmiaru */}
      <div className="flex items-center justify-end gap-1">
        <span className="text-sm text-muted-foreground mr-2">Widok:</span>
        {(Object.keys(gridConfig) as GridSize[]).map((size) => {
          const config = gridConfig[size];
          const Icon = config.icon;
          const isActive = gridSize === size;

          return (
            <Button
              key={size}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSizeChange(size)}
              className={cn('size-8 p-0', isActive && 'pointer-events-none')}
              title={config.label}
            >
              <Icon className="size-4" />
            </Button>
          );
        })}
      </div>

      {/* Siatka projektów */}
      <div className={cn('grid gap-6', gridConfig[gridSize].cols)}>
        {projects.map((project) => (
          <ProjectThumbnail
            key={project.id}
            project={project}
            size={gridSize}
          />
        ))}
      </div>
    </div>
  );
}
