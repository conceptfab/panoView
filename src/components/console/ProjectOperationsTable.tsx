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
    <>
      <div className="divide-y divide-white/10 lg:hidden">
        {projects.map((project) => {
          const hasThumbnail = Boolean(project.thumbnailUrl);
          const previewHref = project.isPublished
            ? `/pano/${project.id}`
            : `/admin/projects/${project.id}`;

          return (
            <article
              key={project.id}
              className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 px-3.5 py-3.5"
            >
              <Link
                href={previewHref}
                className="block size-14 overflow-hidden rounded border border-white/10 bg-zinc-950"
                aria-label={
                  project.isPublished
                    ? `Otwórz panoramę ${project.name}`
                    : `Edytuj projekt ${project.name}`
                }
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

              <div className="min-w-0">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/projects/${project.id}`}
                      className="block truncate text-sm font-medium text-zinc-100"
                    >
                      {project.name}
                    </Link>
                    <div className="mt-1 truncate text-xs text-zinc-500">
                      {project.description || 'Brak opisu'}
                    </div>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 text-xs font-medium',
                      project.isPublished
                        ? 'text-emerald-300'
                        : 'text-zinc-400'
                    )}
                  >
                    {project.isPublished ? 'published' : 'draft'}
                  </span>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-zinc-500">
                  <span>{project.panoramaCount} panoram</span>
                  <span>{shareLabels[project.shareState]}</span>
                  <span>
                    <ClientDate value={project.updatedAt} />
                  </span>
                  <span>{project.nextAction}</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-[780px] table-fixed text-left">
          <colgroup>
            <col className="w-[88px]" />
            <col />
            <col className="w-[130px]" />
            <col className="w-[170px]" />
            <col className="w-[160px]" />
            <col className="w-[44px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-white/10 text-[11px] font-medium uppercase tracking-normal text-zinc-500">
              <th className="px-4 py-2 font-medium">Preview</th>
              <th className="px-4 py-2 font-medium">Project</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Assets</th>
              <th className="px-4 py-2 font-medium">Next action</th>
              <th className="px-4 py-2 font-medium" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
          {projects.map((project) => {
            const statusLabel = project.isPublished ? 'published' : 'draft';
            const hasThumbnail = Boolean(project.thumbnailUrl);
            const previewHref = project.isPublished
              ? `/pano/${project.id}`
              : `/admin/projects/${project.id}`;

            return (
              <tr
                key={project.id}
                className="border-b border-white/10 text-sm transition-colors last:border-b-0 hover:bg-white/[0.015]"
              >
                <td className="px-4 py-3 align-middle">
                  <Link
                    href={previewHref}
                    className="block size-14 overflow-hidden rounded border border-white/10 bg-zinc-950"
                    aria-label={
                      project.isPublished
                        ? `Otwórz panoramę ${project.name}`
                        : `Edytuj projekt ${project.name}`
                    }
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
                </td>

                <td className="min-w-0 px-4 py-3 align-middle">
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
                </td>

                <td className="space-y-1 px-4 py-3 align-middle">
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
                </td>

                <td className="space-y-1 px-4 py-3 align-middle text-xs text-zinc-500">
                  <div>
                    {project.panoramaCount}{' '}
                    {project.panoramaCount === 1 ? 'panorama' : 'panoram'}
                  </div>
                  <div>{hasThumbnail ? 'miniatura gotowa' : 'brak miniatury'}</div>
                </td>

                <td className="truncate px-4 py-3 align-middle text-sm text-zinc-300">
                  {project.nextAction}
                </td>

                <td className="px-4 py-3 align-middle">
                  <Link
                    href={`/admin/projects/${project.id}`}
                    className="flex size-8 items-center justify-center rounded border border-transparent text-zinc-500 transition-colors hover:border-white/10 hover:bg-white/[0.03] hover:text-zinc-100"
                    aria-label={`Więcej akcji dla ${project.name}`}
                  >
                    <MoreHorizontal className="size-4" aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            );
          })}
          </tbody>
        </table>
      </div>
    </>
  );
}
