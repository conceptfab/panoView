import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getUsers } from '@/lib/db/users';
import { getGroups } from '@/lib/db/groups';
import { getAccessControl } from '@/lib/auth/access-control';
import { UserTable } from '@/components/admin/UserTable';
import { AccessControlPanel } from '@/components/admin/AccessControlPanel';

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    redirect('/');
  }

  const [users, groups, accessControl] = await Promise.all([
    getUsers(),
    getGroups(),
    getAccessControl(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extralight">Użytkownicy</h1>
        <p className="text-muted-foreground mt-1">
          Zarządzaj dostępem użytkowników
        </p>
      </div>

      <UserTable users={users} groups={groups} />

      <AccessControlPanel accessControl={accessControl} />
    </div>
  );
}
