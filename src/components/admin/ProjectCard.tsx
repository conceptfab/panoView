'use client';

// oxlint-disable react-doctor/no-giant-component react-doctor/prefer-useReducer react-doctor/no-cascading-set-state react-doctor/no-fetch-in-effect

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Panorama, Project } from '@/types';
import { uploadReplacementFiles } from '@/lib/upload-client';
import { ClientDate } from '@/components/ui/client-date';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Eye,
  Pencil,
  Crosshair,
  MoreVertical,
  Trash2,
  Image as ImageIcon,
  Download,
  Copy,
  Repeat,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { GridSize } from './AdminProjectGrid';

export interface ProjectCardGroupInfo {
  id: string;
  name: string;
  color: string;
}

interface ProjectCardProps {
  project: Project;
  size?: GridSize;
  /** Jedna lub więcej grup – jedna: jeden pasek i nazwa; wiele: pasek podzielony na segmenty i wszystkie nazwy na dole */
  groups?: ProjectCardGroupInfo[];
  /** W trybie Edytora – opcje „Pobierz projekt” i „Usuń” są zablokowane (wyszarzone) */
  disableDownload?: boolean;
}

const sizeConfig: Record<
  GridSize,
  {
    padding: string;
    titleSize: string;
    descSize: string;
    badgeSize: string;
    iconSize: string;
    placeholderIcon: string;
    showDescription: boolean;
    showDate: boolean;
    menuButtonSize: string;
  }
> = {
  large: {
    padding: 'p-4',
    titleSize: 'text-lg',
    descSize: 'text-sm',
    badgeSize: 'text-xs',
    iconSize: 'size-4',
    placeholderIcon: 'size-12',
    showDescription: true,
    showDate: true,
    menuButtonSize: 'size-8',
  },
  medium: {
    padding: 'p-3',
    titleSize: 'text-base',
    descSize: 'text-xs',
    badgeSize: 'text-xs',
    iconSize: 'size-4',
    placeholderIcon: 'size-10',
    showDescription: true,
    showDate: true,
    menuButtonSize: 'size-7',
  },
  small: {
    padding: 'p-2',
    titleSize: 'text-sm',
    descSize: 'text-xs',
    badgeSize: 'text-[10px]',
    iconSize: 'size-3',
    placeholderIcon: 'size-8',
    showDescription: false,
    showDate: false,
    menuButtonSize: 'size-6',
  },
};

export function ProjectCard({
  project,
  size = 'large',
  groups: groupsProp,
  disableDownload = false,
}: ProjectCardProps) {
  const { refresh } = useRouter();
  const config = sizeConfig[size];
  const groups = groupsProp ?? [];
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [panoramasForReplace, setPanoramasForReplace] = useState<Panorama[] | null>(null);
  const [isLoadingPanoramas, setIsLoadingPanoramas] = useState(false);
  const [replaceFiles, setReplaceFiles] = useState<Record<string, File | null>>({});
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const [isReplacingPanoramas, setIsReplacingPanoramas] = useState(false);
  const selectedFileCount = useMemo(
    () => Object.values(replaceFiles).filter(Boolean).length,
    [replaceFiles]
  );

  useEffect(() => {
    let isActive = true;
    if (!replaceDialogOpen) {
      setPanoramasForReplace(null);
      setReplaceFiles({});
      setReplaceError(null);
      setIsLoadingPanoramas(false);
      return;
    }

    setIsLoadingPanoramas(true);
    setReplaceError(null);
    fetch(`/api/projects/${project.id}/config`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Nie udało się pobrać panoram');
        }
        if (!isActive) return;
        const data = await res.json();
        setPanoramasForReplace(data.panoramas ?? []);
        setReplaceFiles({});
      })
      .catch((err) => {
        if (!isActive) return;
        setReplaceError(
          err instanceof Error ? err.message : 'Nie udało się pobrać panoram'
        );
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoadingPanoramas(false);
      });

    return () => {
      isActive = false;
    };
  }, [replaceDialogOpen, project.id]);

  const handleFileInput = useCallback((panoramaId: string, file: File | null) => {
    setReplaceFiles((prev) => ({ ...prev, [panoramaId]: file }));
  }, []);

  const handleReplaceSubmit = useCallback(async () => {
    if (selectedFileCount === 0) return;
    setIsReplacingPanoramas(true);
    setReplaceError(null);

    try {
      const replacements = await uploadReplacementFiles(
        project.id,
        replaceFiles
      );
      const res = await fetch(`/api/projects/${project.id}/replace-panoramas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replacements }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Nie udało się zastąpić panoram');
      }

      toast.success(
        data.message ?? 'Panoramy zostały zastąpione i trafiły do poczekalni'
      );
      setReplaceDialogOpen(false);
      refresh();
    } catch (err) {
      setReplaceError(
        err instanceof Error ? err.message : 'Nie udało się zastąpić panoram'
      );
    } finally {
      setIsReplacingPanoramas(false);
    }
  }, [project.id, refresh, replaceFiles, selectedFileCount]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (
      !confirm(
        `Czy na pewno usunąć projekt „${project.name}"? Nie można tego cofnąć.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Błąd usuwania');
      }
      toast.success(`Projekt „${project.name}" został usunięty.`);
      refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Nie udało się usunąć projektu'
      );
    }
  };

  const handleDownload = () => {
    window.open(
      `/api/files/projects/${project.id}/download`,
      '_blank',
      'noopener,noreferrer'
    );
    toast.success(`Pobieranie „${project.name}"…`);
  };

  const handleClone = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/projects/${project.id}/clone`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Błąd klonowania projektu');
      }
      toast.success(
        data.message ?? `Projekt „${project.name}" został sklonowany.`
      );
      refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Nie udało się sklonować projektu'
      );
    }
  };
  const openReplaceDialog = () => setReplaceDialogOpen(true);

  return (
    <Card className="overflow-hidden pt-0 gap-0">
      {groups.length > 0 && (
        <div className="h-2 shrink-0 flex" aria-hidden>
          {groups.length === 1 ? (
            <div
              className="flex-1 min-w-0"
              style={{ backgroundColor: groups[0].color }}
            />
          ) : (
            groups.map((g) => (
              <div
                key={g.id}
                className="flex-1 min-w-0 first:rounded-l last:rounded-r"
                style={{ backgroundColor: g.color }}
              />
            ))
          )}
        </div>
      )}
      <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-800 shrink-0">
        {project.thumbnailUrl ? (
          <Image
            src={project.thumbnailUrl}
            alt={project.name}
            fill
            sizes="(max-width: 768px) 100vw, 24rem"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon
              className={cn('text-muted-foreground/50', config.placeholderIcon)}
            />
          </div>
        )}
        <Link
          href={`/pano/${project.id}`}
          className="absolute bottom-2 left-2 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-10"
          style={{
            width: config.menuButtonSize,
            height: config.menuButtonSize,
          }}
          title="Otwórz panoramę"
        >
          <Eye className={config.iconSize} />
        </Link>
        <div className="absolute top-2 right-2">
          <Badge
            variant={project.isPublished ? 'default' : 'secondary'}
            className={config.badgeSize}
          >
            {project.isPublished
              ? size === 'small'
                ? '✓'
                : 'Opublikowany'
              : size === 'small'
              ? '○'
              : 'Szkic'}
          </Badge>
        </div>
      </div>

      <CardHeader className={cn(config.padding, 'pb-2', 'pt-3')}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className={cn('line-clamp-1', config.titleSize)}>
              {project.name}
            </CardTitle>
            {config.showDescription && (
              <CardDescription
                className={cn('line-clamp-2 mt-1', config.descSize)}
              >
                {project.description || 'Brak opisu'}
              </CardDescription>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(config.menuButtonSize, '-mr-2')}
              >
                <MoreVertical className={config.iconSize} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/pano/${project.id}`}>
                  <Eye className="size-4 mr-2" />
                  Podgląd
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/admin/projects/${project.id}`}>
                  <Pencil className="size-4 mr-2" />
                  Edytuj
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/admin/projects/${project.id}/editor`}>
                  <Crosshair className="size-4 mr-2" />
                  Edytor hotspotów
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={disableDownload}
                onClick={disableDownload ? undefined : handleDownload}
              >
                <Download className="size-4 mr-2" />
                Pobierz projekt
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={disableDownload}
                onClick={disableDownload ? undefined : handleClone}
              >
                <Copy className="size-4 mr-2" />
                Klonuj projekt
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={disableDownload}
                onClick={disableDownload ? undefined : openReplaceDialog}
              >
                <Repeat className="size-4 mr-2" />
                Zastąp panoramy
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600"
                disabled={disableDownload}
                onClick={disableDownload ? undefined : handleDelete}
              >
                <Trash2 className="size-4 mr-2" />
                Usuń
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className={cn(config.padding, 'pt-0')}>
        <div
          className={cn(
            'flex flex-wrap items-center gap-2 text-muted-foreground',
            size === 'small' ? 'text-xs' : 'text-sm'
          )}
        >
          <span>
            {project.panoramaCount} {size === 'small' ? 'p.' : 'panoram'}
          </span>
          {config.showDate && (
            <>
              <span>•</span>
              <span>
                <ClientDate value={project.updatedAt} />
              </span>
            </>
          )}
        </div>
        {(size === 'large' || size === 'medium') && groups.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground truncate flex flex-wrap gap-x-1.5 gap-y-0.5">
            {groups.map((g, i) => (
              <span key={g.id} style={{ color: g.color }}>
                {g.name}
                {i < groups.length - 1 ? ',' : ''}
              </span>
            ))}
          </p>
        )}
      </CardContent>
      <Dialog open={replaceDialogOpen} onOpenChange={setReplaceDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Zastąp panoramy</DialogTitle>
            <DialogDescription>
              Wybierz dla każdego punktu widokowego nowy plik (np. ten plik zastąpi
              panoramę #00 lub #01). Zastąpione materiały trafią do{' '}
              <span className="font-mono">
                /uploads/projects/{project.id}/pending-panoramas
              </span>{' '}
              (poczekalnia). Po zakończonych testach edytor może je usunąć ręcznie.
            </DialogDescription>
          </DialogHeader>
          {replaceError && (
            <p className="text-sm text-destructive my-2">{replaceError}</p>
          )}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Wybrane pliki: {selectedFileCount}</span>
            {panoramasForReplace && panoramasForReplace.length > 0 && (
              <span>Liczba panoram: {panoramasForReplace.length}</span>
            )}
          </div>
          {isLoadingPanoramas ? (
            <p className="text-sm text-muted-foreground mt-3">
              Ładowanie panoram…
            </p>
          ) : (
            <div className="mt-3 space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {panoramasForReplace && panoramasForReplace.length > 0 ? (
                panoramasForReplace.map((pano, idx) => {
                  const inputId = `replace-panorama-${project.id}-${pano.id}`;
                  return (
                    <div
                      key={pano.id}
                      className="rounded-lg border border-muted/50 px-3 py-2 space-y-1"
                    >
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <Label className="text-sm font-semibold">
                          Panorama #{String(idx + 1).padStart(2, '0')} –{' '}
                          {pano.name || pano.id}
                        </Label>
                        <span className="text-[11px] text-muted-foreground">
                          {pano.file}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        ID: {pano.id}
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          id={inputId}
                          type="file"
                          className="hidden"
                          accept="image/webp,image/jpeg,image/png"
                          onChange={(event) => {
                            const file =
                              event.target.files?.[0] ?? null;
                            handleFileInput(pano.id, file);
                            event.target.value = '';
                          }}
                        />
                        <label htmlFor={inputId}>
                          <Button variant="outline" size="sm">
                            Wybierz plik
                          </Button>
                        </label>
                        <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {replaceFiles[pano.id]?.name ?? 'Brak nowego pliku'}
                        </span>
                        {replaceFiles[pano.id] && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleFileInput(pano.id, null)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="size-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">
                  Brak zapisanych panoram
                </p>
              )}
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setReplaceDialogOpen(false)}
              disabled={isReplacingPanoramas}
            >
              Anuluj
            </Button>
            <Button
              onClick={handleReplaceSubmit}
              disabled={selectedFileCount === 0 || isReplacingPanoramas}
            >
              {isReplacingPanoramas ? 'Aktualizuję…' : 'Zastąp panoramy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
