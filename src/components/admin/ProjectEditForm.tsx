'use client';

// oxlint-disable react-doctor/no-giant-component react-doctor/prefer-useReducer react-doctor/rendering-usetransition-loading

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Group, Project, ProjectConfig } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from '@/components/ui/card';
import { ArrowLeft, Loader2, Save, Globe, GlobeLock, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ProjectShareLinkCard } from './ProjectShareLinkCard';

interface ProjectEditFormProps {
  project: Project;
  groups: Group[];
  initialOptimizePanoramaForScreen: boolean;
  /** Dla edytora – tylko te grupy są wybieralne (jego grupy). */
  editorGroupIds?: string[];
  /** W trybie Edytora – sekcja „Grupy (dostęp do projektu)” jest zablokowana (tylko do odczytu). */
  groupsReadOnly?: boolean;
}

export function ProjectEditForm({
  project,
  groups,
  initialOptimizePanoramaForScreen,
  editorGroupIds,
  groupsReadOnly = false,
}: ProjectEditFormProps) {
  const selectableGroups = editorGroupIds
    ? groups.filter((g) => editorGroupIds.includes(g.id))
    : groups;
  const { push, refresh } = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [name, setName] = useState(() => project.name);
  const [description, setDescription] = useState(() => project.description);
  const [isPublished, setIsPublished] = useState(() => project.isPublished);
  const [optimizePanoramaForScreen, setOptimizePanoramaForScreen] = useState(
    () => initialOptimizePanoramaForScreen
  );
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(
    project.groupIds ?? []
  );
  const [config, setConfig] = useState<ProjectConfig | null>(null);
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [replaceFiles, setReplaceFiles] = useState<Record<string, File | null>>(
    {}
  );
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const [replaceMessage, setReplaceMessage] = useState<string | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);
  const replaceCount = useMemo(
    () => Object.values(replaceFiles).filter(Boolean).length,
    [replaceFiles]
  );
  const pendingDir = `/uploads/projects/${project.id}/pending-panoramas`;

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleTogglePublish = async () => {
    setIsPublishing(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: !isPublished }),
      });

      if (!res.ok) throw new Error('Failed to update');

      setIsPublished(!isPublished);
      toast.success(isPublished ? 'Projekt ukryty' : 'Projekt opublikowany');
      refresh();
    } catch {
      toast.error('Nie udało się zmienić statusu');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          optimizePanoramaForScreen,
          ...(groupsReadOnly ? {} : { groupIds: selectedGroupIds }),
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update project');
      }

      const data = await res.json();
      const updatedProject = data.project;

      toast.success('Projekt zaktualizowany');

      if (updatedProject && updatedProject.id !== project.id) {
        push(`/admin/projects/${updatedProject.id}`);
      } else {
        refresh();
      }
    } catch {
      toast.error('Nie udało się zaktualizować projektu');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchConfig = useCallback(async () => {
    setIsConfigLoading(true);
    setConfigError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/config`);
      if (!res.ok) {
        throw new Error('Nie udało się pobrać konfiguracji panoram');
      }
      const data: ProjectConfig = await res.json();
      setConfig(data);
    } catch (error) {
      setConfigError(
        error instanceof Error
          ? error.message
          : 'Nie udało się pobrać konfiguracji panoram'
      );
    } finally {
      setIsConfigLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleReplaceFile = useCallback(
    (panoramaId: string, file: File | null) => {
      setReplaceFiles((prev) => ({ ...prev, [panoramaId]: file }));
      setReplaceError(null);
      setReplaceMessage(null);
    },
    []
  );

  const handleReplaceSubmit = useCallback(async () => {
    if (replaceCount === 0) {
      setReplaceError('Wybierz przynajmniej jeden plik');
      return;
    }

    setIsReplacing(true);
    setReplaceError(null);
    setReplaceMessage(null);

    const formData = new FormData();
    Object.entries(replaceFiles).forEach(([panoramaId, file]) => {
      if (file) {
        formData.append(`panorama:${panoramaId}`, file);
      }
    });

    try {
      const res = await fetch(`/api/projects/${project.id}/replace-panoramas`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Nie udało się zastąpić panoram');
      }

      toast.success(
        data.message ?? 'Zastąpione panoramy trafiły do poczekalni'
      );
      setReplaceMessage(
        data.message ?? 'Nowe panoramy przesłano, stare są w poczekalni'
      );
      setReplaceFiles({});
      fetchConfig();
    } catch (error) {
      setReplaceError(
        error instanceof Error ? error.message : 'Nie udało się zastąpić panoram'
      );
    } finally {
      setIsReplacing(false);
    }
  }, [project.id, replaceCount, replaceFiles, fetchConfig]);

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/projects">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-2" />
            Powrót do listy
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edycja projektu</CardTitle>
          <CardAction>
            <Button
              variant={isPublished ? 'outline' : 'default'}
              onClick={handleTogglePublish}
              disabled={isPublishing}
              className={
                isPublished
                  ? 'border-green-500 text-green-600 hover:bg-green-50'
                  : ''
              }
            >
              {isPublishing ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : isPublished ? (
                <Globe className="size-4 mr-2" />
              ) : (
                <GlobeLock className="size-4 mr-2" />
              )}
              {isPublished ? 'Opublikowany' : 'Opublikuj'}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nazwa projektu</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Opis</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border p-4">
              <div className="space-y-1">
                <Label htmlFor="optimize-screen">
                  Optymalizuj panoramy do ekranu klienta
                </Label>
                <p className="text-sm text-muted-foreground">
                  OFF: maksymalna jakość. ON: po zapisie system przygotuje
                  zestawy wariantów i będzie dobierał plik do ekranu klienta.
                </p>
              </div>
              <Switch
                id="optimize-screen"
                checked={optimizePanoramaForScreen}
                onCheckedChange={setOptimizePanoramaForScreen}
              />
            </div>

            <div className={cn('space-y-2', groupsReadOnly && 'opacity-70')}>
              <Label
                className={groupsReadOnly ? 'cursor-not-allowed' : undefined}
              >
                Grupy (dostęp do projektu)
              </Label>
              <div
                className={cn(
                  'border rounded-md p-3 max-h-[200px] overflow-y-auto space-y-2',
                  groupsReadOnly && 'pointer-events-none bg-muted/30'
                )}
              >
                {selectableGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Brak grup.</p>
                ) : (
                  selectableGroups.map((group) => (
                    <label
                      key={group.id}
                      className={cn(
                        'flex items-center gap-2 rounded px-2 py-1.5',
                        !groupsReadOnly && 'cursor-pointer hover:bg-muted/50',
                        selectedGroupIds.includes(group.id) && 'bg-muted/50'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedGroupIds.includes(group.id)}
                        onChange={() => toggleGroup(group.id)}
                        disabled={groupsReadOnly}
                        className="size-4 rounded border-input"
                      />
                      <span
                        className="inline-block size-3 rounded-full shrink-0"
                        style={{ backgroundColor: group.color }}
                      />
                      <span className="text-sm">{group.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isLoading || !name.trim()}>
                {isLoading ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <Save className="size-4 mr-2" />
                )}
                Zapisz zmiany
              </Button>
              <Link href={`/admin/projects/${project.id}/editor`}>
                <Button type="button" variant="outline">
                  Edytor hotspotów
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Wymiana panoram</CardTitle>
          <CardAction>
            <span className="text-xs text-muted-foreground">Poczekalnia:</span>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Wybierz nowe pliki dla konkretnych panoram, aby przekierować stare
            wersje do{' '}
            <span className="font-mono text-[11px]">{pendingDir}</span> – edytor
            może je usunąć ręcznie po testach.
          </p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Wybrane pliki: {replaceCount}</span>
            <span>Panoram: {config?.panoramas.length ?? 0}</span>
          </div>
          {replaceMessage && (
            <p className="text-xs text-green-600">{replaceMessage}</p>
          )}
          {replaceError && (
            <p className="text-xs text-destructive">{replaceError}</p>
          )}
          {configError && (
            <p className="text-xs text-destructive">{configError}</p>
          )}
          {isConfigLoading ? (
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Ładowanie panoram…
            </p>
          ) : config ? (
            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {config.panoramas.map((pano, idx) => {
                const inputId = `replace-${pano.id}`;
                return (
                  <div
                    key={pano.id}
                    className="rounded-lg border border-muted/50 px-3 py-2 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                      <span>
                        #{String(idx + 1).padStart(2, '0')} – {pano.name || pano.id}
                      </span>
                      <span className="truncate max-w-[120px]">{pano.file}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id={inputId}
                        type="file"
                        className="hidden"
                        accept="image/webp,image/jpeg,image/png"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          handleReplaceFile(pano.id, file);
                          event.target.value = '';
                        }}
                      />
                      <Button variant="outline" size="xs" asChild>
                        <label htmlFor={inputId} className="cursor-pointer">
                          Wybierz plik
                        </label>
                      </Button>
                      <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                        {replaceFiles[pano.id]?.name ?? 'Brak pliku'}
                      </span>
                      {replaceFiles[pano.id] && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleReplaceFile(pano.id, null)}
                        >
                          <X className="size-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nie udało się załadować listy panoram.
            </p>
          )}
          <Button
            className="w-full"
            disabled={replaceCount === 0 || isReplacing}
            onClick={handleReplaceSubmit}
          >
            {isReplacing && (
              <Loader2 className="size-4 mr-2 animate-spin" />
            )}
            Zastąp panoramy ({replaceCount})
          </Button>
        </CardContent>
      </Card>
      <ProjectShareLinkCard projectId={project.id} />
    </div>
  );
}
