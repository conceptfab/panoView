'use client';

// oxlint-disable react-doctor/no-giant-component react-doctor/prefer-useReducer

import { useState } from 'react';
import { upload } from '@vercel/blob/client';
import { useRouter } from 'next/navigation';
import { Project } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Archive,
  Upload,
  HardDrive,
  FolderOpen,
  Image as ImageIcon,
  Database,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatFileSize } from '@/utils/helpers';
import { downloadZipFromApi } from '@/utils/download-zip';
import { Progress } from '@/components/ui/progress';

async function backupAllProjects() {
  await downloadZipFromApi('/api/files/backup');
  toast.success('Pobieranie kopii zapasowej wszystkich projektów…');
}

interface ProjectWithSize extends Project {
  size?: number;
}

type ImportStage = 'idle' | 'uploading' | 'processing' | 'done';

interface FileManagerProps {
  projects: ProjectWithSize[];
}

export function FileManager({ projects }: FileManagerProps) {
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

  // Stats
  const totalSize = projects.reduce((sum, p) => sum + (p.size ?? 0), 0);
  const totalPanoramas = projects.reduce((sum, p) => sum + p.panoramaCount, 0);
  const projectCount = projects.length;

  const handleBackupAll = () => {
    void backupAllProjects().catch((e) =>
      toast.error(
        e instanceof Error ? e.message : 'Nie udało się pobrać kopii zapasowej'
      )
    );
  };

  const resetImportState = () => {
    setImportStage('idle');
    setImportProgress(0);
    setImportStatus('');
  };

  const handleUploadProject = async () => {
    if (!uploadFile) {
      toast.error('Wybierz plik ZIP');
      return;
    }
    setUploading(true);
    setImportStage('uploading');
    setImportProgress(2);
    setImportStatus('Przygotowanie wysyłki…');

    let processingTimer: ReturnType<typeof setInterval> | null = null;
    let succeeded = false;

    try {
      const blob = await upload(
        `tmp/uploads/import/${uploadFile.name}`,
        uploadFile,
        {
          access: 'public',
          handleUploadUrl: '/api/upload',
          clientPayload: JSON.stringify({ purpose: 'import' }),
          onUploadProgress: ({ percentage }) => {
            const pct = Math.min(65, Math.max(2, Math.round(percentage * 0.65)));
            setImportProgress(pct);
            setImportStatus(`Wysyłanie ZIP… ${Math.round(percentage)}%`);
          },
        }
      );

      setImportStage('processing');
      setImportProgress(68);
      setImportStatus('Rozpakowywanie archiwum i wgrywanie panoram…');

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
      if (!res.ok) {
        throw new Error(data.error || 'Błąd importu');
      }

      setImportStage('done');
      setImportProgress(100);
      setImportStatus('Projekt zaimportowany');
      succeeded = true;

      toast.success(
        `Projekt „${data.project?.name ?? '?'}" został zaimportowany`
      );
      setUploadDialogOpen(false);
      setUploadFile(null);
      setImportName('');
      setImportDescription('');
      resetImportState();
      refresh();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Nie udało się zaimportować projektu'
      );
    } finally {
      if (processingTimer) clearInterval(processingTimer);
      setUploading(false);
      if (!succeeded) resetImportState();
    }
  };

  const handleRebuildProjects = async () => {
    setRebuilding(true);
    try {
      const res = await fetch('/api/projects/rebuild', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Błąd przebudowy');
      }
      toast.success(data.message ?? 'Lista projektów została przebudowana.');
      refresh();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Nie udało się przebudować projektów'
      );
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <>
      {/* Storage Stats – 3 kolumny: Projekty | Całkowity rozmiar | Panoramy */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-muted/60 py-2 gap-0">
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 px-4 py-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Projekty
            </CardTitle>
            <FolderOpen className="size-3.5 text-muted-foreground/70" />
          </CardHeader>
          <CardContent className="px-4 pt-0 pb-2">
            <div className="text-lg font-semibold">{projectCount}</div>
            <p className="text-[11px] text-muted-foreground">
              Łączna liczba projektów
            </p>
          </CardContent>
        </Card>

        <Card className="border-muted/60 py-2 gap-0">
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 px-4 py-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Całkowity rozmiar
            </CardTitle>
            <HardDrive className="size-3.5 text-muted-foreground/70" />
          </CardHeader>
          <CardContent className="px-4 pt-0 pb-2">
            <div className="text-lg font-semibold">
              {formatFileSize(totalSize)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Wszystkie projekty i pliki
            </p>
          </CardContent>
        </Card>

        <Card className="border-muted/60 py-2 gap-0">
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 px-4 py-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Panoramy
            </CardTitle>
            <ImageIcon className="size-3.5 text-muted-foreground/70" />
          </CardHeader>
          <CardContent className="px-4 pt-0 pb-2">
            <div className="text-lg font-semibold">{totalPanoramas}</div>
            <p className="text-[11px] text-muted-foreground">
              Łączna liczba panoram
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card className="border-muted/60 py-2 gap-0">
        <CardHeader className="px-4 py-1.5">
          <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Database className="size-3.5" />
            Operacje na danych
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-4 pb-2">
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Backup All */}
            <div className="flex-1 p-2 border border-muted/50 rounded-md bg-muted/20">
              <div className="flex items-start gap-2">
                <Archive className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium">
                    Backup wszystkich projektów
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Pobierz archiwum ZIP ze wszystkimi projektami i plikami.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1.5 h-7 gap-1.5 text-xs"
                    onClick={handleBackupAll}
                    disabled={projectCount === 0}
                  >
                    <Archive className="size-3" />
                    Pobierz backup ({formatFileSize(totalSize)})
                  </Button>
                </div>
              </div>
            </div>

            {/* Import Project */}
            <div className="flex-1 p-2 border border-muted/50 rounded-md bg-muted/20">
              <div className="flex items-start gap-2">
                <Upload className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium">
                    Importuj projekt z ZIP
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Wgraj ZIP z gotowym projektem (config.json, panoramas/,
                    thumbnails/).
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1.5 h-7 gap-1.5 text-xs"
                    onClick={() => setUploadDialogOpen(true)}
                  >
                    <Upload className="size-3" />
                    Wgraj projekt
                  </Button>
                </div>
              </div>
            </div>

            {/* Rebuild projects */}
            <div className="flex-1 p-2 border border-muted/50 rounded-md bg-muted/20">
              <div className="flex items-start gap-2">
                <RefreshCw className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium">Przebuduj projekty</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Przelicz metadane projektów z ich konfiguracji.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1.5 h-7 gap-1.5 text-xs"
                    onClick={handleRebuildProjects}
                    disabled={rebuilding}
                  >
                    {rebuilding ? (
                      <RefreshCw className="size-3 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3" />
                    )}
                    Przebuduj projekty
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {projectCount === 0 && (
            <div className="text-center py-4 border border-dashed border-muted/50 rounded-md text-muted-foreground">
              <FolderOpen className="size-6 mx-auto mb-1 opacity-40" />
              <p className="text-sm">Brak projektów</p>
              <p className="text-xs mt-0.5">
                Utwórz projekt w zakładce Projekty lub wgraj gotowy projekt
                (ZIP).
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Import ZIP */}
      <Dialog
        open={uploadDialogOpen}
        onOpenChange={(open) => {
          if (!open && uploading) return;
          if (!open) {
            setUploadDialogOpen(false);
            setUploadFile(null);
            setImportName('');
            setImportDescription('');
            resetImportState();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wgraj gotowy projekt (ZIP)</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Archiwum ZIP musi zawierać w głównym katalogu:{' '}
            <code className="text-xs bg-muted px-1 rounded">config.json</code>,
            folder{' '}
            <code className="text-xs bg-muted px-1 rounded">panoramas</code>,
            folder{' '}
            <code className="text-xs bg-muted px-1 rounded">thumbnails</code>.
          </p>
          <div className="space-y-2">
            <Label>Plik ZIP</Label>
            <input
              type="file"
              accept=".zip"
              aria-label="Plik ZIP projektu do importu"
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-secondary file:text-secondary-foreground disabled:opacity-50"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              disabled={uploading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="import-name">Nazwa projektu (opcjonalnie)</Label>
            <Input
              id="import-name"
              placeholder="Z ZIP lub wpisz nową"
              value={importName}
              onChange={(e) => setImportName(e.target.value)}
              disabled={uploading}
            />
            <p className="text-xs text-muted-foreground">
              Ustalona przy imporcie; wpisana tutaj nadpisze nazwę z
              config.json.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="import-desc">Opis (opcjonalnie)</Label>
            <Textarea
              id="import-desc"
              placeholder="Z ZIP lub wpisz nowy"
              value={importDescription}
              onChange={(e) => setImportDescription(e.target.value)}
              rows={2}
              className="resize-none"
              disabled={uploading}
            />
          </div>

          {uploading && (
            <output
              className="block space-y-2 rounded-lg border border-muted/60 bg-muted/30 p-3"
              aria-live="polite"
            >
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 min-w-0">
                  <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                  <span className="truncate">{importStatus}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {importProgress}%
                </span>
              </div>
              <Progress value={importProgress} />
              <p className="text-xs text-muted-foreground">
                {importStage === 'uploading'
                  ? 'Trwa wysyłanie archiwum ZIP do chmury.'
                  : 'Trwa rozpakowanie ZIP i wgrywanie panoram — duże projekty mogą zająć kilka minut. Nie zamykaj tego okna.'}
              </p>
            </output>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUploadDialogOpen(false);
                setUploadFile(null);
              }}
              disabled={uploading}
            >
              Anuluj
            </Button>
            <Button
              onClick={handleUploadProject}
              disabled={!uploadFile || uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Importowanie…
                </>
              ) : (
                'Importuj'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
