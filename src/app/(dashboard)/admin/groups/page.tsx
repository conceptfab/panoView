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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extralight">Grupy</h1>
        <p className="text-muted-foreground mt-1">
          Zarządzaj grupami i przypisanymi projektami
        </p>
      </div>

      <GroupManager groups={groups} projects={projects} />
    </div>
  );
}
