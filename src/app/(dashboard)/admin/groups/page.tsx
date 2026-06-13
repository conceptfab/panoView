import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getGroups } from '@/lib/db/groups';
import { getProjects } from '@/lib/db/projects';
import { GroupManager } from '@/components/admin/GroupManager';

export default async function AdminGroupsPage() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    redirect('/');
  }

  const [groups, projects] = await Promise.all([getGroups(), getProjects()]);

  return <GroupManager groups={groups} projects={projects} />;
}
