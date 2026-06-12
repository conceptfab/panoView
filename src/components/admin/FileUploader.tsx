'use client';

import { useState, useCallback } from 'react';
import { upload } from '@vercel/blob/client';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, X, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface FileUploaderProps {
  projectId: string;
}

interface UploadFile {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
}

export function FileUploader({ projectId }: FileUploaderProps) {
  const { refresh } = useRouter();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const validateFile = (file: File): boolean => {
    const validTypes = ['image/webp', 'image/jpeg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      toast.error(`${file.name}: Nieprawidłowy format. Dozwolone: WebP, JPG, PNG`);
      return false;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error(`${file.name}: Plik zbyt duży. Maksymalnie 50MB`);
      return false;
    }
    return true;
  };

  const addFiles = useCallback((newFiles: FileList) => {
    const validFiles = Array.from(newFiles).flatMap((file) =>
      validateFile(file)
        ? [
            {
              file,
              status: 'pending' as const,
              progress: 0,
            },
          ]
        : []
    );

    setFiles((prev) => [...prev, ...validFiles]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
      }
    },
    [addFiles]
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const uploadFiles = async () => {
    const pendingFiles = files.filter((f) => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsUploading(true);

    // Update status to uploading
    setFiles((prev) =>
      prev.map((f) =>
        f.status === 'pending' ? { ...f, status: 'uploading' as const } : f
      )
    );

    try {
      // 1. Direct upload do Vercel Blob (omija limit 4.5MB requestu)
      const uploaded: { url: string; name: string; contentType: string }[] = [];
      for (const f of pendingFiles) {
        const blob = await upload(
          `tmp/uploads/${projectId}/${f.file.name}`,
          f.file,
          {
            access: 'public',
            handleUploadUrl: '/api/upload',
            clientPayload: JSON.stringify({ projectId }),
          }
        );
        uploaded.push({
          url: blob.url,
          name: f.file.name,
          contentType: f.file.type,
        });
      }

      // 2. Przetworzenie na panoramy (warianty, miniatury, config)
      const res = await fetch('/api/upload/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, files: uploaded }),
      });

      if (!res.ok) {
        throw new Error('Upload failed');
      }

      const data = await res.json();

      // Update status to success
      setFiles((prev) =>
        prev.map((f) =>
          f.status === 'uploading' ? { ...f, status: 'success' as const, progress: 100 } : f
        )
      );

      if (data.skipped?.length) {
        for (const s of data.skipped) {
          toast.error(`${s.name}: ${s.reason}`);
        }
      }
      toast.success(`Przesłano ${data.uploadedFiles.length} plików`);
      refresh();
    } catch {
      setFiles((prev) =>
        prev.map((f) =>
          f.status === 'uploading' ? { ...f, status: 'error' as const } : f
        )
      );
      toast.error('Nie udało się przesłać plików');
    } finally {
      setIsUploading(false);
    }
  };

  const clearCompleted = () => {
    setFiles((prev) => prev.filter((f) => f.status !== 'success'));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Panoramy</span>
          {files.some((f) => f.status === 'success') && (
            <Button variant="ghost" size="sm" onClick={clearCompleted}>
              Wyczyść ukończone
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="size-10 mx-auto text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground mb-2">
            Przeciągnij i upuść panoramy tutaj lub
          </p>
          <label aria-label="Wybierz pliki">
            <input
              type="file"
              className="hidden"
              multiple
              accept="image/webp,image/jpeg,image/png"
              onChange={handleFileInput}
            />
            <Button variant="outline" asChild>
              <span>Wybierz pliki</span>
            </Button>
          </label>
          <p className="text-xs text-muted-foreground mt-4">
            Dozwolone formaty: WebP, JPG, PNG. Maksymalnie 50MB na plik.
            <br />
            Proporcje 2:1 (equirectangular)
          </p>
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((f, index) => (
              <div
                key={`${f.file.name}-${f.file.size}-${f.file.lastModified}`}
                className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(f.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                {f.status === 'uploading' && (
                  <Progress value={50} className="w-24" />
                )}
                {f.status === 'success' && (
                  <CheckCircle className="size-5 text-green-500" />
                )}
                {f.status === 'error' && (
                  <AlertCircle className="size-5 text-red-500" />
                )}
                {f.status === 'pending' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(index)}
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {files.some((f) => f.status === 'pending') && (
          <Button onClick={uploadFiles} disabled={isUploading} className="w-full">
            {isUploading ? 'Przesyłanie...' : 'Prześlij wszystkie'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
