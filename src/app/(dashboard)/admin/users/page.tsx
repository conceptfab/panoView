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
  const activeUsers = users.filter((user) => user.isActive).length;
  const pendingCount = accessControl.pending?.length ?? 0;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#050505]">
      <div className="border-b border-white/10 px-3.5 py-4 sm:px-4 lg:px-5">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-normal text-zinc-100">
            Użytkownicy
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Konta, role, grupy i reguły dostępu.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-4 border border-white/10">
          <div className="border-r border-white/10 px-3 py-3">
            <div className="text-[11px] font-medium uppercase tracking-normal text-zinc-600">
              Users
            </div>
            <div className="mt-2 text-lg font-semibold text-zinc-100">
              {users.length}
            </div>
          </div>
          <div className="border-r border-white/10 px-3 py-3">
            <div className="text-[11px] font-medium uppercase tracking-normal text-zinc-600">
              Active
            </div>
            <div className="mt-2 text-lg font-semibold text-zinc-100">
              {activeUsers}
            </div>
          </div>
          <div className="border-r border-white/10 px-3 py-3">
            <div className="text-[11px] font-medium uppercase tracking-normal text-zinc-600">
              Groups
            </div>
            <div className="mt-2 text-lg font-semibold text-zinc-100">
              {groups.length}
            </div>
          </div>
          <div className="px-3 py-3">
            <div className="text-[11px] font-medium uppercase tracking-normal text-zinc-600">
              Pending
            </div>
            <div className="mt-2 text-lg font-semibold text-zinc-100">
              {pendingCount}
            </div>
          </div>
        </div>
      </div>

      <UserTable users={users} groups={groups} />
      <AccessControlPanel accessControl={accessControl} />
    </div>
  );
}
