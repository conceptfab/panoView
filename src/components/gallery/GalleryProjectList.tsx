'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  Crosshair,
  Eye,
  Image as ImageIcon,
  MoreVertical,
  Pencil,
} from 'lucide-react';
import { ClientDate } from '@/components/ui/client-date';
import { cn } from '@/lib/utils';
import type { Project } from '@/types';

interface GalleryProjectListProps {
  projects: Project[];
  canEdit: boolean;
}

function getPrimaryHref(project: Project, canEdit: boolean) {
  if (project.isPublished) {
    return `/pano/${project.id}`;
  }

  return canEdit ? `/admin/projects/${project.id}` : `/gallery`;
}

function ProjectActionMenu({
  project,
  canEdit,
}: {
  project: Project;
  canEdit: boolean;
}) {
  const hasPreview = project.isPublished;

  return (
    <details className="group relative inline-block">
      <summary
        className="flex size-8 cursor-pointer list-none items-center justify-center rounded text-zinc-500 transition-colors hover:bg-white/[0.03] hover:text-zinc-100 [&::-webkit-details-marker]:hidden"
        aria-label={`Akcje dla ${project.name}`}
      >
        <MoreVertical className="size-4" aria-hidden="true" />
      </summary>

      <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-md border border-white/10 bg-[#18181b] p-1 text-sm shadow-lg">
        {hasPreview ? (
          <Link
            href={`/pano/${project.id}`}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-zinc-200 transition-colors hover:bg-white/[0.06]"
          >
            <Eye className="size-4 text-zinc-500" aria-hidden="true" />
            Podgląd
          </Link>
        ) : null}

        {canEdit ? (
          <>
            <Link
              href={`/admin/projects/${project.id}`}
              className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-zinc-200 transition-colors hover:bg-white/[0.06]"
            >
              <Pencil className="size-4 text-zinc-500" aria-hidden="true" />
              Edytuj
            </Link>
            <Link
              href={`/admin/projects/${project.id}/editor`}
              className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-zinc-200 transition-colors hover:bg-white/[0.06]"
            >
              <Crosshair
                className="size-4 text-zinc-500"
                aria-hidden="true"
              />
              Edytor hotspotów
            </Link>
          </>
        ) : null}
      </div>
    </details>
  );
}

function ProjectPreview({ project }: { project: Project }) {
  if (project.thumbnailUrl) {
    return (
      <Image
        src={project.thumbnailUrl}
        alt=""
        fill
        sizes="(max-width: 768px) 72px, 112px"
        className="object-cover"
      />
    );
  }

  return (
    <span className="flex size-full items-center justify-center bg-[#080809] text-zinc-600">
      <ImageIcon className="size-5" aria-hidden="true" />
    </span>
  );
}

export function GalleryProjectList({
  projects,
  canEdit,
}: GalleryProjectListProps) {
  return (
    <section aria-label="Lista projektów" className="border-y border-white/10">
      <div className="hidden grid-cols-[112px_minmax(0,1fr)_120px_120px_96px_44px] border-b border-white/10 px-5 py-2 text-[11px] font-medium uppercase tracking-normal text-zinc-500 lg:grid">
        <div>Preview</div>
        <div>Project</div>
        <div>Status</div>
        <div>Assets</div>
        <div>Updated</div>
        <div aria-label="Actions" />
      </div>

      <div className="divide-y divide-white/10">
        {projects.map((project) => {
          const primaryHref = getPrimaryHref(project, canEdit);
          const hasPublishedPath = project.isPublished || canEdit;

          return (
            <article
              key={project.id}
              className="grid grid-cols-[72px_minmax(0,1fr)_36px] gap-3 px-3.5 py-3.5 transition-colors hover:bg-white/[0.015] lg:grid-cols-[112px_minmax(0,1fr)_120px_120px_96px_44px] lg:items-center lg:gap-0 lg:px-5"
            >
              <Link
                href={primaryHref}
                aria-label={`Otwórz ${project.name}`}
                className={cn(
                  'relative block h-14 w-[72px] overflow-hidden rounded border border-white/10 bg-zinc-950 lg:h-16 lg:w-[88px]',
                  !hasPublishedPath && 'pointer-events-none'
                )}
              >
                <ProjectPreview project={project} />
              </Link>

              <div className="min-w-0 lg:pr-5">
                <Link
                  href={primaryHref}
                  className={cn(
                    'block truncate text-sm font-medium text-zinc-100 transition-colors hover:text-white',
                    !hasPublishedPath && 'pointer-events-none'
                  )}
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
                      project.isPublished
                        ? 'text-emerald-300'
                        : 'text-zinc-400'
                    )}
                  >
                    {project.isPublished ? 'published' : 'draft'}
                  </span>
                  <span>
                    {project.panoramaCount}{' '}
                    {project.panoramaCount === 1 ? 'panorama' : 'panoram'}
                  </span>
                  <span>
                    <ClientDate value={project.updatedAt} />
                  </span>
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

              <div className="hidden text-xs text-zinc-500 lg:block">
                {project.panoramaCount}{' '}
                {project.panoramaCount === 1 ? 'panorama' : 'panoram'}
              </div>

              <div className="hidden text-xs text-zinc-500 lg:block">
                <ClientDate value={project.updatedAt} />
              </div>

              <div className="flex justify-end">
                <ProjectActionMenu project={project} canEdit={canEdit} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
