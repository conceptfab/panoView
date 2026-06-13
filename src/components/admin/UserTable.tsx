'use client';

// oxlint-disable react-doctor/prefer-useReducer

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClientDate } from '@/components/ui/client-date';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { Group, User, UserRole } from '@/types';
import { Pencil, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

interface UserTableProps {
  users: User[];
  groups: Group[];
}

type EditableRole = Extract<UserRole, 'user' | 'admin' | 'editor'>;

const roleLabels: Record<EditableRole, string> = {
  admin: 'Admin',
  editor: 'Edytor',
  user: 'Użytkownik',
};

export function UserTable({ users, groups }: UserTableProps) {
  const { refresh } = useRouter();
  const groupById = useMemo(
    () => new Map(groups.map((group) => [group.id, group])),
    [groups]
  );
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingRole, setEditingRole] = useState<EditableRole>('user');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<EditableRole>('user');
  const [newUserGroupIds, setNewUserGroupIds] = useState<string[]>([]);
  const [addToWhitelist, setAddToWhitelist] = useState(true);
  const [creating, setCreating] = useState(false);

  const getGroupNames = (groupIds: string[]) =>
    groupIds.flatMap((id) => {
      const group = groupById.get(id);
      return group ? [group.name] : [];
    });

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setSelectedGroupIds([...user.groupIds]);
    setEditingRole(user.role);
    setIsDialogOpen(true);
  };

  const closeEditDialog = () => {
    setIsDialogOpen(false);
    setEditingUser(null);
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  const toggleNewUserGroup = (groupId: string) => {
    setNewUserGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  const saveUser = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupIds: selectedGroupIds, role: editingRole }),
      });
      if (!res.ok) throw new Error('Failed to update user');
      toast.success('Użytkownik zaktualizowany');
      closeEditDialog();
      refresh();
    } catch {
      toast.error('Nie udało się zapisać użytkownika');
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${userToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Nie udało się usunąć użytkownika');
        return;
      }
      toast.success('Użytkownik usunięty');
      setUserToDelete(null);
      refresh();
    } catch {
      toast.error('Nie udało się usunąć użytkownika');
    } finally {
      setDeleting(false);
    }
  };

  const openAddDialog = () => {
    setNewUserEmail('');
    setNewUserRole('user');
    setNewUserGroupIds([]);
    setAddToWhitelist(true);
    setIsAddDialogOpen(true);
  };

  const closeAddDialog = () => {
    setIsAddDialogOpen(false);
    setNewUserEmail('');
    setNewUserRole('user');
    setNewUserGroupIds([]);
    setAddToWhitelist(true);
  };

  const createUser = async () => {
    const email = newUserEmail.trim();
    if (!email) {
      toast.error('Podaj adres email');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Nieprawidłowy adres email');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          role: newUserRole,
          groupIds: newUserGroupIds,
          addToWhitelist,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Nie udało się utworzyć użytkownika');
        return;
      }
      toast.success(
        data.whitelistAdded
          ? 'Użytkownik utworzony i dodany do białej listy'
          : 'Użytkownik utworzony'
      );
      closeAddDialog();
      refresh();
    } catch {
      toast.error('Nie udało się utworzyć użytkownika');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <section aria-label="Lista użytkowników" className="border-b border-white/10">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3.5 py-3 sm:px-4 lg:px-5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-zinc-100">
              Lista użytkowników
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Role, grupy i status dostępu.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddDialog}
            className="inline-flex h-8 shrink-0 items-center gap-2 rounded border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/[0.06]"
          >
            <UserPlus className="size-4" aria-hidden="true" />
            Dodaj
          </button>
        </div>

        <div className="hidden grid-cols-[minmax(220px,1fr)_120px_minmax(160px,0.7fr)_120px_170px_96px] border-b border-white/10 px-5 py-2 text-[11px] font-medium uppercase tracking-normal text-zinc-500 lg:grid">
          <div>Email</div>
          <div>Role</div>
          <div>Groups</div>
          <div>Status</div>
          <div>Last login</div>
          <div className="text-right">Actions</div>
        </div>

        <div className="divide-y divide-white/10">
          {users.map((user) => (
            <UserRow
              getGroupNames={getGroupNames}
              key={user.id}
              onDelete={setUserToDelete}
              onEdit={openEditDialog}
              user={user}
            />
          ))}
        </div>
      </section>

      <EditUserDialog
        editingRole={editingRole}
        editingUser={editingUser}
        groups={groups}
        isOpen={isDialogOpen}
        onClose={closeEditDialog}
        onSave={saveUser}
        saving={saving}
        selectedGroupIds={selectedGroupIds}
        setEditingRole={setEditingRole}
        toggleGroup={toggleGroup}
      />
      <DeleteUserDialog
        deleting={deleting}
        onClose={() => setUserToDelete(null)}
        onConfirm={deleteUser}
        user={userToDelete}
      />
      <AddUserDialog
        addToWhitelist={addToWhitelist}
        creating={creating}
        groups={groups}
        isOpen={isAddDialogOpen}
        newUserEmail={newUserEmail}
        newUserGroupIds={newUserGroupIds}
        newUserRole={newUserRole}
        onClose={closeAddDialog}
        onCreate={createUser}
        setAddToWhitelist={setAddToWhitelist}
        setNewUserEmail={setNewUserEmail}
        setNewUserRole={setNewUserRole}
        toggleNewUserGroup={toggleNewUserGroup}
      />
    </>
  );
}

interface UserRowProps {
  getGroupNames: (groupIds: string[]) => string[];
  onDelete: (user: User) => void;
  onEdit: (user: User) => void;
  user: User;
}

function UserRow({ getGroupNames, onDelete, onEdit, user }: UserRowProps) {
  const groupNames = getGroupNames(user.groupIds);

  return (
    <article className="grid grid-cols-[minmax(0,1fr)_72px] gap-3 px-3.5 py-3.5 transition-colors hover:bg-white/[0.015] lg:grid-cols-[minmax(220px,1fr)_120px_minmax(160px,0.7fr)_120px_170px_96px] lg:items-center lg:gap-0 lg:px-5">
      <div className="min-w-0 lg:pr-5">
        <div className="truncate text-sm font-medium text-zinc-100">
          {user.email}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500 lg:hidden">
          <span>{roleLabels[user.role]}</span>
          <span>{user.isActive ? 'Aktywny' : 'Nieaktywny'}</span>
          <span>{groupNames.length > 0 ? groupNames.join(', ') : 'Bez grup'}</span>
        </div>
      </div>

      <div className="hidden text-xs font-medium text-zinc-300 lg:block">
        {roleLabels[user.role]}
      </div>
      <div className="hidden truncate text-xs text-zinc-500 lg:block">
        {groupNames.length > 0 ? groupNames.join(', ') : '-'}
      </div>
      <div
        className={cn(
          'hidden text-xs font-medium lg:block',
          user.isActive ? 'text-emerald-300' : 'text-zinc-500'
        )}
      >
        {user.isActive ? 'Aktywny' : 'Nieaktywny'}
      </div>
      <div className="hidden text-xs text-zinc-500 lg:block">
        {user.lastLoginAt ? (
          <ClientDate value={user.lastLoginAt} format="dateTime" />
        ) : (
          'Nigdy'
        )}
      </div>
      <div className="flex justify-end gap-1">
        <button
          type="button"
          onClick={() => onEdit(user)}
          className="flex size-8 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-white/[0.03] hover:text-zinc-100"
          aria-label={`Edytuj ${user.email}`}
        >
          <Pencil className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(user)}
          className="flex size-8 items-center justify-center rounded text-red-400/70 transition-colors hover:bg-red-500/10 hover:text-red-200"
          aria-label={`Usuń ${user.email}`}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

interface EditUserDialogProps {
  editingRole: EditableRole;
  editingUser: User | null;
  groups: Group[];
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  selectedGroupIds: string[];
  setEditingRole: (role: EditableRole) => void;
  toggleGroup: (groupId: string) => void;
}

function EditUserDialog({
  editingRole,
  editingUser,
  groups,
  isOpen,
  onClose,
  onSave,
  saving,
  selectedGroupIds,
  setEditingRole,
  toggleGroup,
}: EditUserDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-white/10 bg-[#080809] text-zinc-100 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold tracking-normal">
            Edytuj użytkownika
          </DialogTitle>
        </DialogHeader>
        {editingUser ? (
          <div className="space-y-4 pt-2">
            <p className="truncate text-sm text-zinc-400">{editingUser.email}</p>
            <RolePicker value={editingRole} onChange={setEditingRole} />
            <GroupPicker
              disabled={saving}
              groups={groups}
              selectedGroupIds={selectedGroupIds}
              toggleGroup={toggleGroup}
            />
            <DialogActions
              cancelLabel="Anuluj"
              disabled={saving}
              onCancel={onClose}
              onSubmit={onSave}
              submitLabel={saving ? 'Zapisywanie...' : 'Zapisz'}
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RolePicker({
  onChange,
  value,
}: {
  onChange: (role: EditableRole) => void;
  value: EditableRole;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-zinc-400">Rola</Label>
      <div className="grid grid-cols-3 border border-white/10">
        {(['user', 'editor', 'admin'] as EditableRole[]).map((role) => (
          <button
            className={cn(
              'h-8 border-r border-white/10 px-2 text-xs text-zinc-500 transition-colors last:border-r-0 hover:bg-white/[0.03] hover:text-zinc-100',
              value === role && 'bg-white/[0.06] text-zinc-100'
            )}
            key={role}
            onClick={() => onChange(role)}
            type="button"
          >
            {roleLabels[role]}
          </button>
        ))}
      </div>
    </div>
  );
}

function GroupPicker({
  disabled = false,
  groups,
  selectedGroupIds,
  toggleGroup,
}: {
  disabled?: boolean;
  groups: Group[];
  selectedGroupIds: string[];
  toggleGroup: (groupId: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-zinc-400">Grupy</Label>
      <div className="max-h-[220px] overflow-y-auto border border-white/10">
        {groups.length === 0 ? (
          <div className="px-3 py-4 text-sm text-zinc-500">
            Brak grup do wyboru.
          </div>
        ) : (
          groups.map((group) => {
            const isSelected = selectedGroupIds.includes(group.id);
            return (
              <label
                className={cn(
                  'grid cursor-pointer grid-cols-[16px_12px_minmax(0,1fr)] items-center gap-3 border-b border-white/10 px-3 py-2 last:border-b-0 hover:bg-white/[0.03]',
                  isSelected && 'bg-white/[0.04]',
                  disabled && 'cursor-not-allowed opacity-60'
                )}
                key={group.id}
              >
                <input
                  checked={isSelected}
                  className="size-4 rounded border-white/10 bg-[#050505]"
                  disabled={disabled}
                  onChange={() => toggleGroup(group.id)}
                  type="checkbox"
                />
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: group.color }}
                />
                <span className="truncate text-sm text-zinc-200">
                  {group.name}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

interface DeleteUserDialogProps {
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
  user: User | null;
}

function DeleteUserDialog({
  deleting,
  onClose,
  onConfirm,
  user,
}: DeleteUserDialogProps) {
  return (
    <Dialog open={Boolean(user)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-white/10 bg-[#080809] text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold tracking-normal">
            Usuń użytkownika
          </DialogTitle>
        </DialogHeader>
        {user ? (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-zinc-400">
              Usunąć <span className="font-medium text-zinc-100">{user.email}</span>?
            </p>
            <DialogActions
              cancelLabel="Anuluj"
              disabled={deleting}
              onCancel={onClose}
              onSubmit={onConfirm}
              submitDanger
              submitLabel={deleting ? 'Usuwanie...' : 'Usuń'}
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

interface AddUserDialogProps {
  addToWhitelist: boolean;
  creating: boolean;
  groups: Group[];
  isOpen: boolean;
  newUserEmail: string;
  newUserGroupIds: string[];
  newUserRole: EditableRole;
  onClose: () => void;
  onCreate: () => void;
  setAddToWhitelist: (value: boolean) => void;
  setNewUserEmail: (value: string) => void;
  setNewUserRole: (role: EditableRole) => void;
  toggleNewUserGroup: (groupId: string) => void;
}

function AddUserDialog({
  addToWhitelist,
  creating,
  groups,
  isOpen,
  newUserEmail,
  newUserGroupIds,
  newUserRole,
  onClose,
  onCreate,
  setAddToWhitelist,
  setNewUserEmail,
  setNewUserRole,
  toggleNewUserGroup,
}: AddUserDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-white/10 bg-[#080809] text-zinc-100 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold tracking-normal">
            Dodaj użytkownika
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="newUserEmail" className="text-xs text-zinc-400">
              Email
            </Label>
            <Input
              className="h-9 rounded border-white/10 bg-[#050505] text-sm text-zinc-100 placeholder:text-zinc-600"
              disabled={creating}
              id="newUserEmail"
              onChange={(event) => setNewUserEmail(event.target.value)}
              placeholder="jan@example.com"
              type="email"
              value={newUserEmail}
            />
          </div>
          <RolePicker onChange={setNewUserRole} value={newUserRole} />
          <GroupPicker
            disabled={creating}
            groups={groups}
            selectedGroupIds={newUserGroupIds}
            toggleGroup={toggleNewUserGroup}
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
            <input
              checked={addToWhitelist}
              className="size-4 rounded border-white/10 bg-[#050505]"
              disabled={creating}
              onChange={(event) => setAddToWhitelist(event.target.checked)}
              type="checkbox"
            />
            Dodaj do whitelist
          </label>
          <DialogActions
            cancelLabel="Anuluj"
            disabled={creating || !newUserEmail.trim()}
            onCancel={onClose}
            onSubmit={onCreate}
            submitLabel={creating ? 'Tworzenie...' : 'Utwórz'}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DialogActions({
  cancelLabel,
  disabled,
  onCancel,
  onSubmit,
  submitDanger = false,
  submitLabel,
}: {
  cancelLabel: string;
  disabled: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  submitDanger?: boolean;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button
        className="inline-flex h-8 items-center rounded border border-white/10 px-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/[0.03] hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        onClick={onCancel}
        type="button"
      >
        {cancelLabel}
      </button>
      <button
        className={cn(
          'inline-flex h-8 items-center rounded border border-white/10 px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          submitDanger
            ? 'bg-red-500/10 text-red-200 hover:bg-red-500/20'
            : 'bg-zinc-100 text-zinc-950 hover:bg-white'
        )}
        disabled={disabled}
        onClick={onSubmit}
        type="button"
      >
        {submitLabel}
      </button>
    </div>
  );
}
