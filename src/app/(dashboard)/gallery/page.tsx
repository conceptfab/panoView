import Link from 'next/link';
import { FolderOpen, Plus } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import {
  getProjectsWithExistingFolders,
  getProjectsForUser,
} from '@/lib/db/projects';
import { getUserById } from '@/lib/db/users';
import { GalleryProjectList } from '@/components/gallery/GalleryProjectList';
import type { Project } from '@/types';

export default async function GalleryPage() {
  const session = await getSession();
  if (!session) return null;

  const isAdmin = session.role === 'admin';
  const isEditor = session.role === 'editor';
  const canEdit = isAdmin || isEditor;

  let projects: Project[];

  if (canEdit) {
    const allProjects = await getProjectsWithExistingFolders();
    if (isEditor) {
      const user = await getUserById(session.userId);
      projects = user
        ? allProjects.filter((p) =>
            p.groupIds.some((gid) => user.groupIds.includes(gid))
          )
        : [];
    } else {
      projects = allProjects;
    }
  } else {
    const user = await getUserById(session.userId);
    if (!user) return null;
    projects = await getProjectsForUser(user.groupIds);
  }

  const publishedCount = projects.filter((project) => project.isPublished).length;
  const panoramaCount = projects.reduce(
    (total, project) => total + project.panoramaCount,
    0
  );

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#050505]">
      <div className="border-b border-white/10 px-3.5 py-4 sm:px-4 lg:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-normal text-zinc-100">
              Galeria projektów
            </h1>
            <p className="mt-1 text-xs text-zinc-500">
              {canEdit
                ? 'Projekty, status publikacji i szybkie akcje operacyjne.'
                : 'Wybierz projekt, aby rozpocząć przeglądanie panoram.'}
            </p>
          </div>

          {isEditor ? (
            <Link
              href="/admin/projects/new"
              className="inline-flex h-8 w-fit items-center gap-2 rounded border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/[0.06]"
            >
              <Plus className="size-4" aria-hidden="true" />
              Nowy projekt
            </Link>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-3 border border-white/10">
          <div className="border-r border-white/10 px-3 py-3">
            <div className="text-[11px] font-medium uppercase tracking-normal text-zinc-600">
              Projects
            </div>
            <div className="mt-2 text-lg font-semibold text-zinc-100">
              {projects.length}
            </div>
          </div>
          <div className="border-r border-white/10 px-3 py-3">
            <div className="text-[11px] font-medium uppercase tracking-normal text-zinc-600">
              Published
            </div>
            <div className="mt-2 text-lg font-semibold text-zinc-100">
              {publishedCount}
            </div>
          </div>
          <div className="px-3 py-3">
            <div className="text-[11px] font-medium uppercase tracking-normal text-zinc-600">
              Panoramas
            </div>
            <div className="mt-2 text-lg font-semibold text-zinc-100">
              {panoramaCount}
            </div>
          </div>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="px-3.5 py-16 text-center sm:px-4 lg:px-5">
          <div className="mx-auto flex size-10 items-center justify-center rounded border border-white/10 bg-white/[0.03] text-zinc-500">
            <FolderOpen className="size-5" aria-hidden="true" />
          </div>
          <p className="mt-4 text-sm font-medium text-zinc-200">
            Brak dostępnych projektów
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs text-zinc-500">
            {isEditor
              ? 'Utwórz pierwszy projekt albo poproś administratora o przypisanie grup.'
              : isAdmin
                ? 'Dodaj projekt w sekcji Projects.'
                : 'Skontaktuj się z administratorem, aby uzyskać dostęp.'}
          </p>
          {isEditor ? (
            <Link
              href="/admin/projects/new"
              className="mt-4 inline-flex h-8 items-center gap-2 rounded border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/[0.06]"
            >
              <Plus className="size-4" aria-hidden="true" />
              Utwórz projekt
            </Link>
          ) : isAdmin ? (
            <Link
              href="/admin/projects"
              className="mt-4 inline-flex h-8 items-center rounded border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/[0.06]"
            >
              Przejdź do Projects
            </Link>
          ) : null}
        </div>
      ) : (
        <GalleryProjectList projects={projects} canEdit={canEdit} />
      )}
    </div>
  );
}
