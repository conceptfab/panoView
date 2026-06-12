import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import {
  getProjectsWithExistingFolders,
  getProjectSize,
} from '@/lib/db/projects';
import { getGroups } from '@/lib/db/groups';
import { getUserById } from '@/lib/db/users';
import { Button } from '@/components/ui/button';
import { AdminProjectGrid } from '@/components/admin/AdminProjectGrid';
import { FileManager } from '@/components/admin/FileManager';
import { Project } from '@/types';
import { Plus } from 'lucide-react';

export default async function AdminProjectsPage() {
  const session = await getSession();
  if (!session || (session.role !== 'admin' && session.role !== 'editor')) {
    redirect('/');
  }

  const [allProjects, groups] = await Promise.all([
    getProjectsWithExistingFolders(),
    getGroups(),
  ]);

  let resolvedProjects: Project[];
  if (session.role === 'editor') {
    const user = await getUserById(session.userId);
    resolvedProjects = user
      ? allProjects.filter((p) =>
          p.groupIds.some((gid) => user.groupIds.includes(gid))
        )
      : [];
  } else {
    resolvedProjects = allProjects;
  }
  const projectsWithSize: (Project & { size?: number })[] = await Promise.all(
    resolvedProjects.map(async (p) => ({
      ...p,
      size: await getProjectSize(p.id),
    }))
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extralight">Projekty</h1>
          <p className="text-muted-foreground mt-1">
            {session.role === 'editor'
              ? 'Projekty w Twoich grupach – możesz je dodawać i edytować'
              : 'Zarządzaj projektami panoram'}
          </p>
        </div>
        <Link href="/admin/projects/new">
          <Button>
            <Plus className="size-4 mr-2" />
            Nowy projekt
          </Button>
        </Link>
      </div>

      {resolvedProjects.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground">Brak projektów</p>
          <Link href="/admin/projects/new">
            <Button variant="outline" className="mt-4">
              <Plus className="size-4 mr-2" />
              Utwórz pierwszy projekt
            </Button>
          </Link>
        </div>
      ) : (
        <AdminProjectGrid
          projects={resolvedProjects}
          groups={groups}
          hideGroups={session.role === 'editor'}
          disableDownload={session.role === 'editor'}
        />
      )}

      {session.role === 'admin' && <FileManager projects={projectsWithSize} />}
    </div>
  );
}
