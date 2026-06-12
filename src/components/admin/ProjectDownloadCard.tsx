'use client';

import { Project } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, HardDrive } from 'lucide-react';
import { toast } from 'sonner';
import { formatFileSize } from '@/utils/helpers';
import { downloadZipFromApi } from '@/utils/download-zip';

interface ProjectDownloadCardProps {
  project: Project;
  size: number;
}

export function ProjectDownloadCard({ project, size }: ProjectDownloadCardProps) {
  const handleDownload = async () => {
    try {
      await downloadZipFromApi(`/api/files/projects/${project.id}/download`);
      toast.success(`Pobieranie „${project.name}"…`);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Nie udało się pobrać projektu'
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="size-5" />
          Pliki projektu
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Rozmiar: <span className="font-medium text-foreground">{formatFileSize(size)}</span>
          </div>
          <Button onClick={handleDownload} className="gap-2">
            <Download className="size-4" />
            Pobierz ZIP
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
