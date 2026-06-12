'use client';

// oxlint-disable react-doctor/no-cascading-set-state

import { useState, useEffect, useMemo } from 'react';
import { Project, Group } from '@/types';
import { ProjectCard } from './ProjectCard';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Grid3X3, Grid2X2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type GridSize = 'large' | 'medium' | 'small';

interface AdminProjectGridProps {
  projects: Project[];
  groups: Group[];
  /** Ukryj grupy (np. widok edytora w Galerii) – płaska lista, bez sekcji i pasków na kartach */
  hideGroups?: boolean;
  /** W trybie Edytora – opcje „Pobierz projekt” i „Usuń” na kartach są zablokowane (wyszarzone) */
  disableDownload?: boolean;
}

const GRID_SIZE_KEY = 'admin-projects-grid-size';

const gridConfig: Record<
  GridSize,
  { cols: string; label: string; icon: typeof LayoutGrid }
> = {
  large: {
    cols: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    label: 'Duży',
    icon: Grid2X2,
  },
  medium: {
    cols: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
    label: 'Średni',
    icon: LayoutGrid,
  },
  small: {
    cols: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
    label: 'Mały',
    icon: Grid3X3,
  },
};

export function AdminProjectGrid({
  projects,
  groups,
  hideGroups = false,
  disableDownload = false,
}: AdminProjectGridProps) {
  const [gridSize, setGridSize] = useState<GridSize>('large');
  const [mounted, setMounted] = useState(false);

  const groupMap = useMemo(() => {
    const map = new Map<string, Group>();
    groups.forEach((g) => map.set(g.id, g));
    return map;
  }, [groups]);

  const sections = useMemo(() => {
    if (hideGroups) {
      return [{ group: null as Group | null, projects }];
    }
    const result: { group: Group | null; projects: Project[] }[] = [];
    const assignedIds = new Set<string>();

    for (const group of groups) {
      const groupProjectIds = new Set(group.projectIds);
      const groupProjects = projects.filter(
        (p) => groupProjectIds.has(p.id) && !assignedIds.has(p.id)
      );
      groupProjects.forEach((p) => assignedIds.add(p.id));
      if (groupProjects.length > 0) {
        result.push({ group, projects: groupProjects });
      }
    }

    const ungrouped = projects.filter((p) => !assignedIds.has(p.id));
    if (ungrouped.length > 0) {
      result.push({ group: null, projects: ungrouped });
    }
    return result;
  }, [projects, groups, hideGroups]);

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

  const handleSizeChange = (size: GridSize) => {
    setGridSize(size);
    localStorage.setItem(GRID_SIZE_KEY, size);
  };

  const getProjectGroups = (project: Project) =>
    hideGroups
      ? []
      : (project.groupIds ?? []).flatMap((id) => {
          const group = groupMap.get(id);
          return group
            ? [{ id: group.id, name: group.name, color: group.color }]
            : [];
        });

  if (!mounted) {
    return (
      <div className="space-y-8">
        <div className={cn('grid gap-6', gridConfig.large.cols)}>
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              size="large"
              groups={getProjectGroups(project)}
              disableDownload={disableDownload}
            />
          ))}
        </div>
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

      {/* Galeria pogrupowana */}
      <div className="space-y-8">
        {sections.map(({ group, projects: sectionProjects }) => (
          <section key={group?.id ?? 'bez-grupy'}>
            {!hideGroups && group && (
              <h2
                className="text-lg font-semibold mb-3 flex items-center gap-2"
                style={group.color ? { color: group.color } : undefined}
              >
                <span
                  className="inline-block size-2 rounded-full shrink-0"
                  style={{ backgroundColor: group.color }}
                  aria-hidden
                />
                {group.name}
              </h2>
            )}
            {!hideGroups && !group && sectionProjects.length > 0 && (
              <h2 className="text-lg font-semibold text-muted-foreground mb-3">
                Bez grupy
              </h2>
            )}
            <div className={cn('grid gap-6', gridConfig[gridSize].cols)}>
              {sectionProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  size={gridSize}
                  groups={getProjectGroups(project)}
                  disableDownload={disableDownload}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
