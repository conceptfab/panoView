'use client';

// oxlint-disable react-doctor/prefer-useReducer react-doctor/rerender-state-only-in-handlers

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FolderOpen,
  FileText,
  RefreshCw,
  Download,
  FileCode,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatFileSize } from '@/utils/helpers';

type BrowseEntry = {
  name: string;
  type: 'dir' | 'file';
  size?: number;
  mtime?: string;
};

type PanelState = {
  path: string;
  entries: BrowseEntry[];
  loading: boolean;
  selectedIndex: number;
};

const ROOT_LABEL = '[root]';

function Panel({
  title,
  path,
  entries,
  loading,
  selectedIndex,
  onNavigate,
  onSelectEntry,
  onRefresh,
  isActive,
  onFocus,
}: {
  title: string;
  path: string;
  entries: BrowseEntry[];
  loading: boolean;
  selectedIndex: number;
  onNavigate: (newPath: string) => void;
  onSelectEntry: (entry: BrowseEntry, currentPath: string) => void;
  onRefresh: () => void;
  isActive: boolean;
  onFocus: () => void;
}) {
  const atRoot = !path || path === '.';
  const displayEntries: BrowseEntry[] = atRoot
    ? entries
    : [{ name: '..', type: 'dir' } as BrowseEntry, ...entries];

  const handleDoubleClick = (entry: BrowseEntry) => {
    if (entry.type === 'dir') {
      const nextPath =
        entry.name === '..'
          ? path.split('/').slice(0, -1).join('/')
          : path
          ? `${path}/${entry.name}`
          : entry.name;
      onNavigate(nextPath);
    } else {
      onSelectEntry(entry, path);
    }
  };

  return (
    <Card
      className={`flex-1 min-w-0 flex flex-col ${
        isActive ? 'ring-2 ring-primary' : ''
      }`}
      onFocus={onFocus}
      tabIndex={0}
    >
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between gap-2 border-b">
        <CardTitle className="text-sm font-medium truncate">{title}</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <div className="px-2 py-1 bg-muted/50 text-xs font-mono truncate border-b">
        {path || ROOT_LABEL}
      </div>
      <CardContent className="p-0 flex-1 min-h-[280px] overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Ładowanie…
          </div>
        ) : (
          <ul className="font-mono text-sm">
            {displayEntries.map((entry, i) => {
              const isSelected = i === selectedIndex;
              const isParent = entry.name === '..';
              return (
                <li
                  key={entry.name + (entry.type === 'file' ? entry.size : '')}
                  className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/80 ${
                    isSelected ? 'bg-muted' : ''
	                  }`}
	                  onDoubleClick={() => handleDoubleClick(entry)}
	                  onClick={() => {}}
	                  onKeyDown={(event) => {
	                    if (event.key === 'Enter') handleDoubleClick(entry);
	                  }}
	                  role="button"
	                  tabIndex={0}
	                >
                  {entry.type === 'dir' ? (
                    <FolderOpen className="size-4 text-amber-500 shrink-0" />
                  ) : (
                    <FileText className="size-4 text-blue-400 shrink-0" />
                  )}
                  <span className="truncate flex-1">
                    {isParent ? '..' : entry.name}
                  </span>
                  {entry.type === 'file' && entry.size != null && (
                    <span className="text-muted-foreground text-xs shrink-0">
                      {formatFileSize(entry.size)}
                    </span>
                  )}
                </li>
              );
            })}
            {!loading && displayEntries.length === 0 && (
              <li className="px-3 py-4 text-muted-foreground text-center">
                Pusty katalog
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function DataFileExplorer() {
  const [left, setLeft] = useState<PanelState>({
    path: 'data',
    entries: [],
    loading: true,
    selectedIndex: 0,
  });
  const [right, setRight] = useState<PanelState>({
    path: 'uploads',
    entries: [],
    loading: true,
    selectedIndex: 0,
  });
  const [activePanel, setActivePanel] = useState<'left' | 'right'>('left');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewName, setPreviewName] = useState('');
  const [previewFilePath, setPreviewFilePath] = useState('');
  const [previewPanel, setPreviewPanel] = useState<'left' | 'right'>('left');
  const [saving, setSaving] = useState(false);

  const fetchDir = useCallback(async (path: string) => {
    const q = path ? `?path=${encodeURIComponent(path)}` : '';
    const res = await fetch(`/api/files/browse${q}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Błąd listowania');
    }
    const data = await res.json();
    return data as { path: string; entries: BrowseEntry[] };
  }, []);

  const loadPanel = useCallback(
    (side: 'left' | 'right') => {
      const state = side === 'left' ? left : right;
      (side === 'left' ? setLeft : setRight)((prev) => ({
        ...prev,
        loading: true,
      }));
      fetchDir(state.path)
        .then((data) => {
          (side === 'left' ? setLeft : setRight)((prev) => ({
            ...prev,
            path: data.path,
            entries: data.entries,
            loading: false,
            selectedIndex: 0,
          }));
        })
        .catch((err) => {
          toast.error(err.message);
          (side === 'left' ? setLeft : setRight)((prev) => ({
            ...prev,
            loading: false,
          }));
        });
    },
    [fetchDir, left, right]
  );

  // Initial load of both panels (once on mount)
  useEffect(() => {
    loadPanel('left');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    loadPanel('right');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNavigate = (side: 'left' | 'right', newPath: string) => {
    (side === 'left' ? setLeft : setRight)((prev) => ({
      ...prev,
      path: newPath,
      loading: true,
      selectedIndex: 0,
    }));
    fetchDir(newPath)
      .then((data) => {
        (side === 'left' ? setLeft : setRight)((prev) => ({
          ...prev,
          path: data.path,
          entries: data.entries,
          loading: false,
        }));
      })
      .catch((err) => {
        toast.error(err.message);
        (side === 'left' ? setLeft : setRight)((prev) => ({
          ...prev,
          loading: false,
        }));
      });
  };

  const handleSelectEntry = async (
    entry: BrowseEntry,
    currentPath: string,
    side: 'left' | 'right'
  ) => {
    if (entry.type === 'dir') return;
    const filePath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    const ext = entry.name.split('.').pop()?.toLowerCase();
    const textExt = [
      'json',
      'txt',
      'md',
      'html',
      'css',
      'js',
      'ts',
      'xml',
      'yaml',
      'yml',
      'env',
      'log',
      'csv',
    ];
    if (ext && textExt.includes(ext)) {
      try {
        const res = await fetch(
          `/api/files/read?path=${encodeURIComponent(filePath)}`
        );
        if (!res.ok) throw new Error('Nie można odczytać pliku');
        const text = await res.text();
        setPreviewName(entry.name);
        setPreviewContent(text);
        setPreviewFilePath(filePath);
        setPreviewPanel(side);
        setPreviewOpen(true);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Błąd podglądu pliku');
      }
    } else {
      window.open(
        `/api/files/download?path=${encodeURIComponent(filePath)}`,
        '_blank'
      );
      toast.success(`Pobieranie: ${entry.name}`);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileCode className="size-5" />
          Menedżer plików
        </h2>
        <p className="text-sm text-muted-foreground">
          Dwuklik: wejście do katalogu / edycja lub pobranie pliku
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel
          title="Lewy panel"
          path={left.path}
          entries={left.entries}
          loading={left.loading}
          selectedIndex={left.selectedIndex}
          onNavigate={(p) => handleNavigate('left', p)}
          onSelectEntry={(e, p) => handleSelectEntry(e, p, 'left')}
          onRefresh={() => loadPanel('left')}
          isActive={activePanel === 'left'}
          onFocus={() => setActivePanel('left')}
        />
        <Panel
          title="Prawy panel"
          path={right.path}
          entries={right.entries}
          loading={right.loading}
          selectedIndex={right.selectedIndex}
          onNavigate={(p) => handleNavigate('right', p)}
          onSelectEntry={(e, p) => handleSelectEntry(e, p, 'right')}
          onRefresh={() => loadPanel('right')}
          isActive={activePanel === 'right'}
          onFocus={() => setActivePanel('right')}
        />
      </div>

      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) setSaving(false);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-5" />
              {previewName} – edycja
            </DialogTitle>
          </DialogHeader>
          <textarea
            className="flex-1 min-h-[300px] w-full p-4 bg-muted rounded-md text-sm font-mono whitespace-pre-wrap break-words resize-y border border-input"
            value={previewContent}
            onChange={(e) => setPreviewContent(e.target.value)}
            spellCheck={false}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.open(
                  `/api/files/download?path=${encodeURIComponent(
                    previewFilePath
                  )}`,
                  '_blank'
                );
              }}
            >
              <Download className="size-4 mr-1" />
              Pobierz
            </Button>
            <Button
              size="sm"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  const res = await fetch(
                    `/api/files/write?path=${encodeURIComponent(
                      previewFilePath
                    )}`,
                    {
                      method: 'PUT',
                      body: previewContent,
                      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                    }
                  );
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || 'Błąd zapisu');
                  }
                  toast.success('Plik zapisany');
                  loadPanel(previewPanel);
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : 'Nie udało się zapisać'
                  );
                } finally {
                  setSaving(false);
                }
              }}
            >
              <Save className="size-4 mr-1" />
              {saving ? 'Zapisywanie…' : 'Zapisz'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
