import Image from 'next/image';
import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import { ClientDate } from '@/components/ui/client-date';
import type { CommandCenterProjectRow } from '@/lib/command-center';
import { cn } from '@/lib/utils';

interface ProjectOperationsTableProps {
  projects: CommandCenterProjectRow[];
}

const shareLabels: Record<CommandCenterProjectRow['shareState'], string> = {
  active: 'link aktywny',
  inactive: 'link wyłączony',
  none: 'bez linku',
};

export function ProjectOperationsTable({
  projects,
}: ProjectOperationsTableProps) {
  if (projects.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-zinc-500">
        Brak projektów. Utwórz pierwszy projekt albo zaimportuj ZIP.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[780px]">
        <div className="grid grid-cols-[88px_minmax(220px,1.4fr)_130px_170px_minmax(160px,0.8fr)_44px] items-center border-b border-white/10 px-4 py-2 text-[11px] font-medium uppercase tracking-normal text-zinc-500">
          <div>Preview</div>
          <div>Project</div>
          <div>Status</div>
          <div>Assets</div>
          <div>Next action</div>
          <div aria-hidden="true" />
        </div>

        <div className="divide-y divide-white/10">
          {projects.map((project) => {
            const statusLabel = project.isPublished ? 'published' : 'draft';
            const hasThumbnail = Boolean(project.thumbnailUrl);

            return (
              <div
                key={project.id}
                className="grid grid-cols-[88px_minmax(220px,1.4fr)_130px_170px_minmax(160px,0.8fr)_44px] items-center px-4 py-3 text-sm transition-colors hover:bg-white/[0.015]"
              >
                <Link
                  href={`/pano/${project.id}`}
                  className="block size-14 overflow-hidden rounded border border-white/10 bg-zinc-950"
                  aria-label={`Otwórz panoramę ${project.name}`}
                >
                  {hasThumbnail ? (
                    <Image
                      src={project.thumbnailUrl}
                      alt=""
                      width={56}
                      height={56}
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="block size-full bg-linear-to-br from-zinc-900 via-zinc-800 to-zinc-950" />
                  )}
                </Link>

                <div className="min-w-0 pr-4">
                  <Link
                    href={`/admin/projects/${project.id}`}
                    className="block truncate font-medium text-zinc-100 transition-colors hover:text-white"
                  >
                    {project.name}
                  </Link>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {project.description || 'Brak opisu'}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-600">
                    Updated <ClientDate value={project.updatedAt} />
                  </p>
                </div>

                <div className="space-y-1">
                  <div
                    className={cn(
                      'text-xs font-medium',
                      project.isPublished ? 'text-emerald-300' : 'text-zinc-400'
                    )}
                  >
                    {statusLabel}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {shareLabels[project.shareState]}
                  </div>
                  {project.hasPin ? (
                    <div className="text-[11px] text-zinc-500">PIN</div>
                  ) : null}
                </div>

                <div className="space-y-1 text-xs text-zinc-500">
                  <div>
                    {project.panoramaCount}{' '}
                    {project.panoramaCount === 1 ? 'panorama' : 'panoram'}
                  </div>
                  <div>{hasThumbnail ? 'miniatura gotowa' : 'brak miniatury'}</div>
                </div>

                <div className="truncate text-sm text-zinc-300">
                  {project.nextAction}
                </div>

                <Link
                  href={`/admin/projects/${project.id}`}
                  className="flex size-8 items-center justify-center rounded border border-transparent text-zinc-500 transition-colors hover:border-white/10 hover:bg-white/[0.03] hover:text-zinc-100"
                  aria-label={`Więcej akcji dla ${project.name}`}
                >
                  <MoreHorizontal className="size-4" aria-hidden="true" />
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
