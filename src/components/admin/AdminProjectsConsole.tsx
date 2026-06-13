'use client';

// oxlint-disable react-doctor/prefer-useReducer

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import {
  Archive,
  Copy,
  Crosshair,
  Database,
  Download,
  Eye,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Repeat,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { ClientDate } from '@/components/ui/client-date';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { uploadReplacementFiles } from '@/lib/upload-client';
import { cn } from '@/lib/utils';
import { downloadZipFromApi } from '@/utils/download-zip';
import { formatFileSize } from '@/utils/helpers';
import type { Group, Panorama, Project } from '@/types';

type ProjectWithSize = Project & { size?: number };
type ImportStage = 'idle' | 'uploading' | 'processing' | 'done';

interface AdminProjectsConsoleProps {
  canManageFiles: boolean;
  disableProjectMutations: boolean;
  groups: Group[];
  projects: ProjectWithSize[];
  subtitle: string;
}

export function AdminProjectsConsole({
  canManageFiles,
  disableProjectMutations,
  groups,
  projects,
  subtitle,
}: AdminProjectsConsoleProps) {
  const groupById = useMemo(
    () => new Map(groups.map((group) => [group.id, group])),
    [groups]
  );
  const totalSize = projects.reduce((sum, project) => sum + (project.size ?? 0), 0);
  const totalPanoramas = projects.reduce(
    (sum, project) => sum + project.panoramaCount,
    0
  );
  const publishedCount = projects.filter((project) => project.isPublished).length;

  const getProjectGroups = (project: Project) =>
    project.groupIds.flatMap((id) => {
      const group = groupById.get(id);
      return group ? [group] : [];
    });

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#050505]">
      <div className="border-b border-white/10 px-3.5 py-4 sm:px-4 lg:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-normal text-zinc-100">
              Projekty
            </h1>
            <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
          </div>
          <Link
            href="/admin/projects/new"
            className="inline-flex h-8 w-fit items-center gap-2 rounded border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/[0.06]"
          >
            <Plus className="size-4" aria-hidden="true" />
            Nowy projekt
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-4 border border-white/10">
          <ProjectStat label="Projects" value={projects.length} />
          <ProjectStat label="Published" value={publishedCount} />
          <ProjectStat label="Panoramas" value={totalPanoramas} />
          <ProjectStat isLast label="Storage" value={formatFileSize(totalSize)} />
        </div>
      </div>

      {projects.length === 0 ? (
        <EmptyProjectsState />
      ) : (
        <section aria-label="Lista projektów" className="border-b border-white/10">
          <div className="hidden grid-cols-[96px_minmax(220px,1fr)_120px_minmax(160px,0.55fr)_140px_112px_44px] border-b border-white/10 px-5 py-2 text-[11px] font-medium uppercase tracking-normal text-zinc-500 lg:grid">
            <div>Preview</div>
            <div>Project</div>
            <div>Status</div>
            <div>Groups</div>
            <div>Assets</div>
            <div>Updated</div>
            <div aria-label="Actions" />
          </div>
          <div className="divide-y divide-white/10">
            {projects.map((project) => (
              <ProjectRow
                disableProjectMutations={disableProjectMutations}
                groups={getProjectGroups(project)}
                key={project.id}
                project={project}
              />
            ))}
          </div>
        </section>
      )}

      {canManageFiles ? (
        <ProjectDataOperations
          projectCount={projects.length}
          totalSize={totalSize}
        />
      ) : null}
    </div>
  );
}

function ProjectStat({
  isLast = false,
  label,
  value,
}: {
  isLast?: boolean;
  label: string;
  value: number | string;
}) {
  return (
    <div className={cn('px-3 py-3', !isLast && 'border-r border-white/10')}>
      <div className="text-[11px] font-medium uppercase tracking-normal text-zinc-600">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-100">{value}</div>
    </div>
  );
}

function EmptyProjectsState() {
  return (
    <div className="px-3.5 py-16 text-center sm:px-4 lg:px-5">
      <div className="mx-auto flex size-10 items-center justify-center rounded border border-white/10 bg-white/[0.03] text-zinc-500">
        <FolderOpen className="size-5" aria-hidden="true" />
      </div>
      <p className="mt-4 text-sm font-medium text-zinc-200">Brak projektów</p>
      <Link
        href="/admin/projects/new"
        className="mt-4 inline-flex h-8 items-center gap-2 rounded border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/[0.06]"
      >
        <Plus className="size-4" aria-hidden="true" />
        Utwórz projekt
      </Link>
    </div>
  );
}

function ProjectRow({
  disableProjectMutations,
  groups,
  project,
}: {
  disableProjectMutations: boolean;
  groups: Group[];
  project: ProjectWithSize;
}) {
  const groupNames = groups.map((group) => group.name);

  return (
    <article className="grid grid-cols-[72px_minmax(0,1fr)_36px] gap-3 px-3.5 py-3.5 transition-colors hover:bg-white/[0.015] lg:grid-cols-[96px_minmax(220px,1fr)_120px_minmax(160px,0.55fr)_140px_112px_44px] lg:items-center lg:gap-0 lg:px-5">
      <Link
        href={`/pano/${project.id}`}
        className="relative block h-14 w-[72px] overflow-hidden rounded border border-white/10 bg-zinc-950 lg:h-14 lg:w-20"
        aria-label={`Otwórz ${project.name}`}
      >
        {project.thumbnailUrl ? (
          <Image
            alt=""
            className="object-cover"
            fill
            sizes="(max-width: 768px) 72px, 96px"
            src={project.thumbnailUrl}
          />
        ) : (
          <span className="flex size-full items-center justify-center text-zinc-600">
            <ImageIcon className="size-5" aria-hidden="true" />
          </span>
        )}
      </Link>

      <div className="min-w-0 lg:pr-5">
        <Link
          href={`/admin/projects/${project.id}`}
          className="block truncate text-sm font-medium text-zinc-100 transition-colors hover:text-white"
        >
          {project.name}
        </Link>
        <p className="mt-1 truncate text-xs text-zinc-500">
          {project.description || 'Brak opisu'}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500 lg:hidden">
          <span
            className={cn(
              'font-medium',
              project.isPublished ? 'text-emerald-300' : 'text-zinc-400'
            )}
          >
            {project.isPublished ? 'published' : 'draft'}
          </span>
          <span>{project.panoramaCount} panoram</span>
          <span>{groupNames.length > 0 ? groupNames.join(', ') : 'Bez grup'}</span>
        </div>
      </div>

      <div
        className={cn(
          'hidden text-xs font-medium lg:block',
          project.isPublished ? 'text-emerald-300' : 'text-zinc-400'
        )}
      >
        {project.isPublished ? 'published' : 'draft'}
      </div>
      <div className="hidden truncate text-xs text-zinc-500 lg:block">
        {groupNames.length > 0 ? groupNames.join(', ') : 'Bez grup'}
      </div>
      <div className="hidden text-xs text-zinc-500 lg:block">
        <div>{project.panoramaCount} panoram</div>
        <div>{formatFileSize(project.size ?? 0)}</div>
      </div>
      <div className="hidden text-xs text-zinc-500 lg:block">
        <ClientDate value={project.updatedAt} />
      </div>
      <div className="flex justify-end">
        <ProjectActions
          disableProjectMutations={disableProjectMutations}
          project={project}
        />
      </div>
    </article>
  );
}

function ProjectActions({
  disableProjectMutations,
  project,
}: {
  disableProjectMutations: boolean;
  project: Project;
}) {
  const { refresh } = useRouter();
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [panoramasForReplace, setPanoramasForReplace] = useState<Panorama[] | null>(null);
  const [isLoadingPanoramas, setIsLoadingPanoramas] = useState(false);
  const [replaceFiles, setReplaceFiles] = useState<Record<string, File | null>>({});
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const [isReplacingPanoramas, setIsReplacingPanoramas] = useState(false);
  const selectedFileCount = useMemo(
    () => Object.values(replaceFiles).filter(Boolean).length,
    [replaceFiles]
  );

  const openReplaceDialog = useCallback((open: boolean) => {
    setReplaceDialogOpen(open);
    if (!open) {
      setPanoramasForReplace(null);
      setReplaceFiles({});
      setReplaceError(null);
      setIsLoadingPanoramas(false);
      return;
    }

    setIsLoadingPanoramas(true);
    setReplaceError(null);
    void (async () => {
      try {
        const res = await fetch(`/api/projects/${project.id}/config`);
        if (!res.ok) throw new Error('Nie udało się pobrać panoram');
        const data = await res.json();
        setPanoramasForReplace(data.panoramas ?? []);
        setReplaceFiles({});
      } catch (error) {
        setReplaceError(
          error instanceof Error ? error.message : 'Nie udało się pobrać panoram'
        );
      } finally {
        setIsLoadingPanoramas(false);
      }
    })();
  }, [project.id]);

  const downloadProject = async () => {
    try {
      await downloadZipFromApi(`/api/files/projects/${project.id}/download`);
      toast.success(`Pobieranie „${project.name}"...`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Nie udało się pobrać projektu'
      );
    }
  };

  const cloneProject = async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/clone`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Błąd klonowania projektu');
      toast.success(data.message ?? `Projekt „${project.name}" został sklonowany.`);
      refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Nie udało się sklonować projektu'
      );
    }
  };

  const deleteProject = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Błąd usuwania');
      }
      toast.success(`Projekt „${project.name}" został usunięty.`);
      setDeleteDialogOpen(false);
      refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Nie udało się usunąć projektu'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const replacePanoramas = async () => {
    if (selectedFileCount === 0) return;
    setIsReplacingPanoramas(true);
    setReplaceError(null);
    try {
      const replacements = await uploadReplacementFiles(project.id, replaceFiles);
      const res = await fetch(`/api/projects/${project.id}/replace-panoramas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replacements }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Nie udało się zastąpić panoram');
      toast.success(data.message ?? 'Panoramy zostały zastąpione');
      setReplaceDialogOpen(false);
      refresh();
    } catch (error) {
      setReplaceError(
        error instanceof Error ? error.message : 'Nie udało się zastąpić panoram'
      );
    } finally {
      setIsReplacingPanoramas(false);
    }
  };

  return (
    <>
      <details className="group relative inline-block">
        <summary
          className="flex size-8 cursor-pointer list-none items-center justify-center rounded text-zinc-500 transition-colors hover:bg-white/[0.03] hover:text-zinc-100 [&::-webkit-details-marker]:hidden"
          aria-label={`Akcje dla ${project.name}`}
        >
          <MoreVertical className="size-4" aria-hidden="true" />
        </summary>
        <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-md border border-white/10 bg-[#18181b] p-1 text-sm shadow-lg">
          <ActionLink href={`/pano/${project.id}`} icon={Eye} label="Podgląd" />
          <ActionLink href={`/admin/projects/${project.id}`} icon={Pencil} label="Edytuj" />
          <ActionLink
            href={`/admin/projects/${project.id}/editor`}
            icon={Crosshair}
            label="Edytor hotspotów"
          />
          <ActionButton
            disabled={disableProjectMutations}
            icon={Download}
            label="Pobierz projekt"
            onClick={downloadProject}
          />
          <ActionButton
            disabled={disableProjectMutations}
            icon={Copy}
            label="Klonuj projekt"
            onClick={cloneProject}
          />
          <ActionButton
            disabled={disableProjectMutations}
            icon={Repeat}
            label="Zastąp panoramy"
            onClick={() => openReplaceDialog(true)}
          />
          <ActionButton
            danger
            disabled={disableProjectMutations}
            icon={Trash2}
            label="Usuń"
            onClick={() => setDeleteDialogOpen(true)}
          />
        </div>
      </details>

      <ReplacePanoramasDialog
        error={replaceError}
        isLoading={isLoadingPanoramas}
        isOpen={replaceDialogOpen}
        isReplacing={isReplacingPanoramas}
        onClose={() => openReplaceDialog(false)}
        onSubmit={replacePanoramas}
        panoramas={panoramasForReplace}
        project={project}
        replaceFiles={replaceFiles}
        selectedFileCount={selectedFileCount}
        setReplaceFiles={setReplaceFiles}
      />
      <DeleteProjectDialog
        isDeleting={isDeleting}
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onDelete={deleteProject}
        project={project}
      />
    </>
  );
}

function ActionLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Eye;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-zinc-200 transition-colors hover:bg-white/[0.06]"
    >
      <Icon className="size-4 text-zinc-500" aria-hidden="true" />
      {label}
    </Link>
  );
}

function ActionButton({
  danger = false,
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  danger?: boolean;
  disabled: boolean;
  icon: typeof Download;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-zinc-200 transition-colors hover:bg-white/[0.06]',
        danger && 'text-red-200 hover:bg-red-500/10',
        disabled && 'cursor-not-allowed opacity-40'
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <Icon className="size-4 text-zinc-500" aria-hidden="true" />
      {label}
    </button>
  );
}

function ReplacePanoramasDialog({
  error,
  isLoading,
  isOpen,
  isReplacing,
  onClose,
  onSubmit,
  panoramas,
  project,
  replaceFiles,
  selectedFileCount,
  setReplaceFiles,
}: {
  error: string | null;
  isLoading: boolean;
  isOpen: boolean;
  isReplacing: boolean;
  onClose: () => void;
  onSubmit: () => void;
  panoramas: Panorama[] | null;
  project: Project;
  replaceFiles: Record<string, File | null>;
  selectedFileCount: number;
  setReplaceFiles: React.Dispatch<React.SetStateAction<Record<string, File | null>>>;
}) {
  const handleFileInput = (panoramaId: string, file: File | null) => {
    setReplaceFiles((prev) => ({ ...prev, [panoramaId]: file }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-white/10 bg-[#080809] text-zinc-100 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold tracking-normal">
            Zastąp panoramy
          </DialogTitle>
        </DialogHeader>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Wybrane pliki: {selectedFileCount}</span>
          {panoramas ? <span>Panoramy: {panoramas.length}</span> : null}
        </div>
        {isLoading ? (
          <div className="py-8 text-sm text-zinc-500">Ładowanie panoram...</div>
        ) : (
          <div className="max-h-[320px] overflow-y-auto border border-white/10">
            {panoramas && panoramas.length > 0 ? (
              panoramas.map((panorama, index) => {
                const inputId = `replace-${project.id}-${panorama.id}`;

                return (
                  <div
                    className="grid gap-2 border-b border-white/10 px-3 py-2 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_220px]"
                    key={panorama.id}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-zinc-100">
                        #{String(index + 1).padStart(2, '0')} {panorama.name || panorama.id}
                      </div>
                      <div className="mt-1 truncate text-xs text-zinc-500">
                        {panorama.file}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        accept="image/webp,image/jpeg,image/png"
                        className="hidden"
                        id={inputId}
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          handleFileInput(panorama.id, file);
                          event.target.value = '';
                        }}
                        type="file"
                      />
                      <label
                        className="inline-flex h-8 shrink-0 cursor-pointer items-center rounded border border-white/10 px-2 text-xs text-zinc-300 hover:bg-white/[0.03]"
                        htmlFor={inputId}
                      >
                        Wybierz
                      </label>
                      <span className="min-w-0 flex-1 truncate text-xs text-zinc-500">
                        {replaceFiles[panorama.id]?.name ?? 'Brak pliku'}
                      </span>
                      {replaceFiles[panorama.id] ? (
                        <button
                          className="flex size-7 items-center justify-center rounded text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-100"
                          onClick={() => handleFileInput(panorama.id, null)}
                          type="button"
                        >
                          <X className="size-3" aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-6 text-center text-sm text-zinc-500">
                Brak zapisanych panoram
              </div>
            )}
          </div>
        )}
        <DialogActions
          cancelLabel="Anuluj"
          disabled={isReplacing}
          onCancel={onClose}
          onSubmit={onSubmit}
          submitDisabled={selectedFileCount === 0 || isReplacing}
          submitLabel={isReplacing ? 'Aktualizuję...' : 'Zastąp'}
        />
      </DialogContent>
    </Dialog>
  );
}

function DeleteProjectDialog({
  isDeleting,
  isOpen,
  onClose,
  onDelete,
  project,
}: {
  isDeleting: boolean;
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
  project: Project;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-white/10 bg-[#080809] text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold tracking-normal">
            Usunąć projekt?
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-zinc-400">
          Projekt <span className="font-medium text-zinc-100">{project.name}</span> zostanie trwale usunięty.
        </p>
        <DialogActions
          cancelLabel="Anuluj"
          disabled={isDeleting}
          onCancel={onClose}
          onSubmit={onDelete}
          submitDanger
          submitLabel={isDeleting ? 'Usuwanie...' : 'Usuń'}
        />
      </DialogContent>
    </Dialog>
  );
}

function ProjectDataOperations({
  projectCount,
  totalSize,
}: {
  projectCount: number;
  totalSize: number;
}) {
  const { refresh } = useRouter();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [importName, setImportName] = useState('');
  const [importDescription, setImportDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [importStage, setImportStage] = useState<ImportStage>('idle');
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const [rebuilding, setRebuilding] = useState(false);

  const resetImportState = () => {
    setImportStage('idle');
    setImportProgress(0);
    setImportStatus('');
  };

  const handleBackupAll = async () => {
    try {
      await downloadZipFromApi('/api/files/backup');
      toast.success('Pobieranie kopii zapasowej wszystkich projektów...');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Nie udało się pobrać kopii zapasowej'
      );
    }
  };

  const handleRebuildProjects = async () => {
    setRebuilding(true);
    try {
      const res = await fetch('/api/projects/rebuild', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Błąd przebudowy');
      toast.success(data.message ?? 'Lista projektów została przebudowana.');
      refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Nie udało się przebudować projektów'
      );
    } finally {
      setRebuilding(false);
    }
  };

  const handleUploadProject = async () => {
    if (!uploadFile) {
      toast.error('Wybierz plik ZIP');
      return;
    }
    setUploading(true);
    setImportStage('uploading');
    setImportProgress(2);
    setImportStatus('Przygotowanie wysyłki...');

    let processingTimer: ReturnType<typeof setInterval> | null = null;
    let succeeded = false;
    try {
      const blob = await upload(`tmp/uploads/import/${uploadFile.name}`, uploadFile, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        clientPayload: JSON.stringify({ purpose: 'import' }),
        onUploadProgress: ({ percentage }) => {
          const pct = Math.min(65, Math.max(2, Math.round(percentage * 0.65)));
          setImportProgress(pct);
          setImportStatus(`Wysyłanie ZIP... ${Math.round(percentage)}%`);
        },
      });

      setImportStage('processing');
      setImportProgress(68);
      setImportStatus('Rozpakowywanie archiwum...');
      processingTimer = setInterval(() => {
        setImportProgress((prev) => (prev < 92 ? prev + 1 : prev));
      }, 2500);

      const res = await fetch('/api/files/upload-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: blob.url,
          name: importName.trim() || undefined,
          description: importDescription.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Błąd importu');
      setImportStage('done');
      setImportProgress(100);
      setImportStatus('Projekt zaimportowany');
      succeeded = true;
      toast.success(`Projekt „${data.project?.name ?? '?'}" został zaimportowany`);
      setUploadDialogOpen(false);
      setUploadFile(null);
      setImportName('');
      setImportDescription('');
      resetImportState();
      refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Nie udało się zaimportować projektu'
      );
    } finally {
      if (processingTimer) clearInterval(processingTimer);
      setUploading(false);
      if (!succeeded) resetImportState();
    }
  };

  return (
    <section aria-label="Operacje na danych" className="border-b border-white/10">
      <div className="flex items-center gap-2 border-b border-white/10 px-3.5 py-3 text-sm font-semibold text-zinc-100 sm:px-4 lg:px-5">
        <Database className="size-4 text-zinc-500" aria-hidden="true" />
        Operacje na danych
      </div>
      <div className="grid divide-y divide-white/10 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        <OperationItem
          description="Pobierz archiwum ZIP ze wszystkimi projektami."
          disabled={projectCount === 0}
          icon={Archive}
          label={`Pobierz backup (${formatFileSize(totalSize)})`}
          onClick={handleBackupAll}
          title="Backup wszystkich projektów"
        />
        <OperationItem
          description="Wgraj ZIP z config.json, panoramas i thumbnails."
          icon={Upload}
          label="Wgraj projekt"
          onClick={() => setUploadDialogOpen(true)}
          title="Importuj projekt z ZIP"
        />
        <OperationItem
          description="Przelicz metadane projektów z konfiguracji."
          disabled={rebuilding}
          icon={rebuilding ? Loader2 : RefreshCw}
          label={rebuilding ? 'Przebudowuję...' : 'Przebuduj projekty'}
          onClick={handleRebuildProjects}
          title="Przebuduj projekty"
        />
      </div>

      <ImportProjectDialog
        importDescription={importDescription}
        importName={importName}
        importProgress={importProgress}
        importStage={importStage}
        importStatus={importStatus}
        isOpen={uploadDialogOpen}
        onClose={() => {
          if (uploading) return;
          setUploadDialogOpen(false);
          setUploadFile(null);
          setImportName('');
          setImportDescription('');
          resetImportState();
        }}
        onSubmit={handleUploadProject}
        setImportDescription={setImportDescription}
        setImportName={setImportName}
        setUploadFile={setUploadFile}
        uploadFile={uploadFile}
        uploading={uploading}
      />
    </section>
  );
}

function OperationItem({
  description,
  disabled = false,
  icon: Icon,
  label,
  onClick,
  title,
}: {
  description: string;
  disabled?: boolean;
  icon: typeof Archive;
  label: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <div className="px-3.5 py-3 sm:px-4 lg:px-5">
      <div className="flex items-start gap-3">
        <Icon className={cn('mt-0.5 size-4 shrink-0 text-zinc-500', title.includes('Przebuduj') && disabled && 'animate-spin')} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-zinc-100">{title}</h3>
          <p className="mt-1 text-xs text-zinc-500">{description}</p>
          <button
            className="mt-2 inline-flex h-8 items-center rounded border border-white/10 px-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.03] hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled}
            onClick={onClick}
            type="button"
          >
            {label}
          </button>
        </div>
      </div>
    </div>
  );
}

function ImportProjectDialog({
  importDescription,
  importName,
  importProgress,
  importStage,
  importStatus,
  isOpen,
  onClose,
  onSubmit,
  setImportDescription,
  setImportName,
  setUploadFile,
  uploadFile,
  uploading,
}: {
  importDescription: string;
  importName: string;
  importProgress: number;
  importStage: ImportStage;
  importStatus: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  setImportDescription: (value: string) => void;
  setImportName: (value: string) => void;
  setUploadFile: (file: File | null) => void;
  uploadFile: File | null;
  uploading: boolean;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-white/10 bg-[#080809] text-zinc-100 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold tracking-normal">
            Wgraj gotowy projekt ZIP
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-xs text-zinc-400">Plik ZIP</Label>
            <input
              accept=".zip"
              aria-label="Plik ZIP projektu do importu"
              className="block w-full text-sm text-zinc-500 file:mr-4 file:h-8 file:rounded file:border file:border-white/10 file:bg-white/[0.03] file:px-3 file:text-sm file:text-zinc-100 disabled:opacity-50"
              disabled={uploading}
              onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
              type="file"
            />
            <p className="text-xs text-zinc-600">
              {uploadFile?.name ?? 'config.json, panoramas/, thumbnails/'}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="import-name" className="text-xs text-zinc-400">
              Nazwa projektu
            </Label>
            <Input
              className="h-9 rounded border-white/10 bg-[#050505] text-sm text-zinc-100 placeholder:text-zinc-600"
              disabled={uploading}
              id="import-name"
              onChange={(event) => setImportName(event.target.value)}
              placeholder="Opcjonalnie"
              value={importName}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="import-desc" className="text-xs text-zinc-400">
              Opis
            </Label>
            <Textarea
              className="min-h-20 rounded border-white/10 bg-[#050505] text-sm text-zinc-100 placeholder:text-zinc-600"
              disabled={uploading}
              id="import-desc"
              onChange={(event) => setImportDescription(event.target.value)}
              placeholder="Opcjonalnie"
              value={importDescription}
            />
          </div>
          {importStage !== 'idle' ? (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-zinc-500">
                <span>{importStatus}</span>
                <span>{importProgress}%</span>
              </div>
              <Progress value={importProgress} />
            </div>
          ) : null}
          <DialogActions
            cancelLabel="Anuluj"
            disabled={uploading}
            onCancel={onClose}
            onSubmit={onSubmit}
            submitDisabled={!uploadFile || uploading}
            submitLabel={uploading ? 'Importuję...' : 'Importuj'}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DialogActions({
  cancelLabel,
  disabled,
  onCancel,
  onSubmit,
  submitDanger = false,
  submitDisabled,
  submitLabel,
}: {
  cancelLabel: string;
  disabled: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  submitDanger?: boolean;
  submitDisabled?: boolean;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button
        className="inline-flex h-8 items-center rounded border border-white/10 px-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/[0.03] hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        onClick={onCancel}
        type="button"
      >
        {cancelLabel}
      </button>
      <button
        className={cn(
          'inline-flex h-8 items-center rounded border border-white/10 px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          submitDanger
            ? 'bg-red-500/10 text-red-200 hover:bg-red-500/20'
            : 'bg-zinc-100 text-zinc-950 hover:bg-white'
        )}
        disabled={submitDisabled ?? disabled}
        onClick={onSubmit}
        type="button"
      >
        {submitLabel}
      </button>
    </div>
  );
}
