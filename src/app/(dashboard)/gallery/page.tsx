import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import {
  getProjectsWithExistingFolders,
  getProjectsForUser,
} from '@/lib/db/projects';
import { getGroups } from '@/lib/db/groups';
import { getUserById } from '@/lib/db/users';
import { ProjectGrid } from '@/components/gallery/ProjectGrid';
import { AdminProjectGrid } from '@/components/admin/AdminProjectGrid';
import { Button } from '@/components/ui/button';
import { Project } from '@/types';
import { Plus } from 'lucide-react';

export default async function GalleryPage() {
  const session = await getSession();
  if (!session) return null;

  const isAdmin = session.role === 'admin';
  const isEditor = session.role === 'editor';
  const canEdit = isAdmin || isEditor;

  let projects: Project[];
  let groups: Awaited<ReturnType<typeof getGroups>> = [];

  if (canEdit) {
    const [allProjects, allGroups] = await Promise.all([
      getProjectsWithExistingFolders(),
      getGroups(),
    ]);
    groups = allGroups;
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

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extralight">Galeria projektów</h1>
          <p className="text-muted-foreground mt-1">
            {canEdit
              ? 'Przeglądaj i edytuj projekty – menu ⋮ na karcie'
              : 'Wybierz projekt, aby rozpocząć przeglądanie panoram'}
          </p>
        </div>
        {canEdit && (
          <Link href="/admin/projects/new">
            <Button>
              <Plus className="size-4 mr-2" />
              Nowy projekt
            </Button>
          </Link>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>Brak dostępnych projektów</p>
          {canEdit ? (
            <Link href="/admin/projects/new">
              <Button variant="outline" className="mt-4">
                <Plus className="size-4 mr-2" />
                Utwórz pierwszy projekt
              </Button>
            </Link>
          ) : (
            <p className="text-sm mt-2">
              Skontaktuj się z administratorem, aby uzyskać dostęp
            </p>
          )}
        </div>
      ) : canEdit ? (
        <AdminProjectGrid
          projects={projects}
          groups={groups}
          hideGroups={isEditor}
          disableDownload={isEditor}
        />
      ) : (
        <ProjectGrid projects={projects} />
      )}
    </div>
  );
}
