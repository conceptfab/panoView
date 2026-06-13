import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import {
  getProjectsWithExistingFolders,
  getProjectSize,
} from '@/lib/db/projects';
import { getGroups } from '@/lib/db/groups';
import { getUserById } from '@/lib/db/users';
import { AdminProjectsConsole } from '@/components/admin/AdminProjectsConsole';
import type { Project } from '@/types';

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
    <AdminProjectsConsole
      canManageFiles={session.role === 'admin'}
      disableProjectMutations={session.role === 'editor'}
      groups={groups}
      projects={projectsWithSize}
      subtitle={
        session.role === 'editor'
          ? 'Projekty w Twoich grupach i szybkie akcje edycji.'
          : 'Projekty, publikacje, pliki i operacje administracyjne.'
      }
    />
  );
}
