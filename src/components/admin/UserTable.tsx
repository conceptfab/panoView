'use client';

// oxlint-disable react-doctor/no-giant-component react-doctor/prefer-useReducer

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Group } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClientDate } from '@/components/ui/client-date';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pencil, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UserTableProps {
  users: User[];
  groups: Group[];
}

export function UserTable({ users, groups }: UserTableProps) {
  const { refresh } = useRouter();
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingRole, setEditingRole] = useState<'user' | 'admin' | 'editor'>(
    'user'
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Stan dla dialogu dodawania użytkownika
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin' | 'editor'>(
    'user'
  );
  const [newUserGroupIds, setNewUserGroupIds] = useState<string[]>([]);
  const [addToWhitelist, setAddToWhitelist] = useState(true);
  const [creating, setCreating] = useState(false);

  const getGroupNames = (groupIds: string[]) => {
    const groupById = new Map(groups.map((group) => [group.id, group]));
    return groupIds
      .flatMap((id) => {
        const group = groupById.get(id);
        return group ? [group.name] : [];
      })
      .join(', ');
  };

  const handleOpenDialog = (user: User) => {
    setEditingUser(user);
    setSelectedGroupIds([...user.groupIds]);
    setEditingRole(user.role);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
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

  const handleSave = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupIds: selectedGroupIds, role: editingRole }),
      });
      if (!res.ok) throw new Error('Failed to update user');
      toast.success('Grupy użytkownika zaktualizowane');
      handleCloseDialog();
      refresh();
    } catch {
      toast.error('Nie udało się zapisać grup');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (user: User) => setUserToDelete(user);

  const handleDeleteConfirm = async () => {
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

  const handleOpenAddDialog = () => {
    setNewUserEmail('');
    setNewUserRole('user');
    setNewUserGroupIds([]);
    setAddToWhitelist(true);
    setIsAddDialogOpen(true);
  };

  const handleCloseAddDialog = () => {
    setIsAddDialogOpen(false);
    setNewUserEmail('');
    setNewUserRole('user');
    setNewUserGroupIds([]);
    setAddToWhitelist(true);
  };

  const handleCreateUser = async () => {
    if (!newUserEmail.trim()) {
      toast.error('Podaj adres email');
      return;
    }

    // Podstawowa walidacja email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUserEmail.trim())) {
      toast.error('Nieprawidłowy adres email');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUserEmail.trim(),
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

      if (data.whitelistAdded) {
        toast.success('Użytkownik utworzony i dodany do białej listy');
      } else {
        toast.success('Użytkownik utworzony');
      }

      handleCloseAddDialog();
      refresh();
    } catch {
      toast.error('Nie udało się utworzyć użytkownika');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lista użytkowników ({users.length})</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Aby dodać użytkownika do grupy: kliknij ikonę{' '}
                <strong>ołówka</strong> przy danym użytkowniku, zaznacz grupy w
                oknie i kliknij <strong>Zapisz</strong>.
              </p>
            </div>
            <Button onClick={handleOpenAddDialog} className="gap-2">
              <UserPlus className="size-4" />
              Dodaj użytkownika
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Rola</TableHead>
                <TableHead>Grupy</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ostatnie logowanie</TableHead>
                <TableHead className="w-[100px]">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        user.role === 'admin'
                          ? 'default'
                          : user.role === 'editor'
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {user.role === 'admin'
                        ? 'Admin'
                        : user.role === 'editor'
                        ? 'Edytor'
                        : 'Użytkownik'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {getGroupNames(user.groupIds) || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? 'default' : 'destructive'}>
                      {user.isActive ? 'Aktywny' : 'Nieaktywny'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.lastLoginAt
                      ? <ClientDate value={user.lastLoginAt} format="dateTime" />
                      : 'Nigdy'}
                  </TableCell>
                  <TableCell className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={() => handleOpenDialog(user)}
                      title="Przypisz użytkownika do grup"
                    >
                      <Pencil className="size-4" />
                      <span className="hidden sm:inline text-xs">Grupy</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteClick(user)}
                      title="Usuń użytkownika"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog usuwania użytkownika */}
      <Dialog
        open={!!userToDelete}
        onOpenChange={(open) => !open && setUserToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuń użytkownika</DialogTitle>
          </DialogHeader>
          {userToDelete && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Czy na pewno usunąć użytkownika{' '}
                <span className="font-medium text-foreground">
                  {userToDelete.email}
                </span>
                ? Tej operacji nie można cofnąć.
              </p>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setUserToDelete(null)}
                  disabled={deleting}
                >
                  Anuluj
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                >
                  {deleting ? 'Usuwanie…' : 'Usuń'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog edycji grup użytkownika */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => !open && handleCloseDialog()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Przypisz użytkownika do grup</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Użytkownik:{' '}
                <span className="font-medium text-foreground">
                  {editingUser.email}
                </span>
              </p>
              <div className="space-y-2">
                <Label>Rola</Label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editing-role"
                      checked={editingRole === 'user'}
                      onChange={() => setEditingRole('user')}
                      className="size-4 border-input"
                    />
                    <span className="text-sm">Użytkownik</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editing-role"
                      checked={editingRole === 'editor'}
                      onChange={() => setEditingRole('editor')}
                      className="size-4 border-input"
                    />
                    <span className="text-sm">Edytor</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editing-role"
                      checked={editingRole === 'admin'}
                      onChange={() => setEditingRole('admin')}
                      className="size-4 border-input"
                    />
                    <span className="text-sm">Administrator</span>
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Grupy</Label>
                <div className="border rounded-md p-3 max-h-[240px] overflow-y-auto space-y-2">
                  {groups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Brak grup do wyboru.
                    </p>
                  ) : (
                    groups.map((group) => (
                      <label
                        key={group.id}
                        className={cn(
                          'flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-muted/50',
                          selectedGroupIds.includes(group.id) && 'bg-muted/50'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedGroupIds.includes(group.id)}
                          onChange={() => toggleGroup(group.id)}
                          className="size-4 rounded border-input"
                        />
                        <span
                          className="inline-block size-3 rounded-full shrink-0"
                          style={{ backgroundColor: group.color }}
                        />
                        <span className="text-sm">{group.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? 'Zapisywanie…' : 'Zapisz'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCloseDialog}
                  disabled={saving}
                >
                  Anuluj
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog dodawania nowego użytkownika */}
      <Dialog
        open={isAddDialogOpen}
        onOpenChange={(open) => !open && handleCloseAddDialog()}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dodaj nowego użytkownika</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="newUserEmail">Adres email *</Label>
              <Input
                id="newUserEmail"
                type="email"
                placeholder="jan@example.com"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                disabled={creating}
              />
            </div>

            {/* Rola */}
            <div className="space-y-2">
              <Label>Rola</Label>
              <Select
                value={newUserRole}
                onValueChange={(v) =>
                  setNewUserRole(v as 'user' | 'admin' | 'editor')
                }
                disabled={creating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Użytkownik</SelectItem>
                  <SelectItem value="editor">Edytor</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Grupy */}
            <div className="space-y-2">
              <Label>Grupy (opcjonalnie)</Label>
              <div className="border rounded-md p-3 max-h-[160px] overflow-y-auto space-y-2">
                {groups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Brak grup do wyboru.
                  </p>
                ) : (
                  groups.map((group) => (
                    <label
                      key={group.id}
                      className={cn(
                        'flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-muted/50',
                        newUserGroupIds.includes(group.id) && 'bg-muted/50'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={newUserGroupIds.includes(group.id)}
                        onChange={() => toggleNewUserGroup(group.id)}
                        disabled={creating}
                        className="size-4 rounded border-input"
                      />
                      <span
                        className="inline-block size-3 rounded-full shrink-0"
                        style={{ backgroundColor: group.color }}
                      />
                      <span className="text-sm">{group.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Dodaj do białej listy */}
            <div className="flex items-center gap-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addToWhitelist}
                  onChange={(e) => setAddToWhitelist(e.target.checked)}
                  disabled={creating}
                  className="size-4 rounded border-input"
                />
                <span className="text-sm">
                  Automatycznie dodaj do białej listy
                </span>
              </label>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Użytkownik na białej liście może się zalogować do systemu.
            </p>

            {/* Przyciski */}
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleCreateUser}
                disabled={creating || !newUserEmail.trim()}
                className="flex-1"
              >
                {creating ? 'Tworzenie…' : 'Utwórz użytkownika'}
              </Button>
              <Button
                variant="outline"
                onClick={handleCloseAddDialog}
                disabled={creating}
              >
                Anuluj
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
