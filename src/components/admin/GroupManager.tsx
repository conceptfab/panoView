'use client';

// oxlint-disable react-doctor/prefer-useReducer

import { useMemo, useState } from 'react';
import type { Group, Project } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FolderOpen, Pencil, Plus, Trash2, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface GroupManagerProps {
  groups: Group[];
  projects: Project[];
}

export function GroupManager({
  groups: initialGroups,
  projects,
}: GroupManagerProps) {
  const [groups, setGroups] = useState(() => initialGroups);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6b7280');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  );
  const assignedProjectIds = useMemo(
    () => new Set(groups.flatMap((group) => group.projectIds)),
    [groups]
  );
  const assignedCount = assignedProjectIds.size;

  const getProjectNames = (projectIds: string[]) => {
    return projectIds.flatMap((id) => {
      const project = projectById.get(id);
      return project ? [project.name] : [];
    });
  };

  const handleOpenDialog = (group?: Group) => {
    if (group) {
      setEditingGroup(group);
      setName(group.name);
      setDescription(group.description);
      setColor(group.color);
      setSelectedProjectIds([...group.projectIds]);
    } else {
      setEditingGroup(null);
      setName('');
      setDescription('');
      setColor('#6b7280');
      setSelectedProjectIds([]);
    }
    setIsDialogOpen(true);
  };

  const toggleProject = (projectId: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Podaj nazwę grupy');
      return;
    }

    try {
      if (editingGroup) {
        const res = await fetch(`/api/groups/${editingGroup.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description,
            color,
            projectIds: selectedProjectIds,
          }),
        });

        if (!res.ok) throw new Error('Failed to update group');

        const data = await res.json();
        setGroups((prev) =>
          prev.map((g) => (g.id === editingGroup.id ? data.group : g))
        );
        toast.success('Grupa zaktualizowana');
      } else {
        const res = await fetch('/api/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description, color }),
        });

        if (!res.ok) throw new Error('Failed to create group');

        const data = await res.json();
        setGroups((prev) => [...prev, data.group]);
        toast.success('Grupa utworzona');
        const newGroupId = data.group.id;
        if (selectedProjectIds.length > 0) {
          const updateRes = await fetch(`/api/groups/${newGroupId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectIds: selectedProjectIds }),
          });
          if (updateRes.ok) {
            const updated = await updateRes.json();
            setGroups((prev) =>
              prev.map((g) => (g.id === newGroupId ? updated.group : g))
            );
          }
        }
      }

      setIsDialogOpen(false);
    } catch {
      toast.error('Nie udało się zapisać grupy');
    }
  };

  const handleDelete = async (groupId: string) => {
    const group = groups.find((item) => item.id === groupId);
    if (group && !window.confirm(`Usunąć grupę "${group.name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete group');

      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      toast.success('Grupa usunięta');
    } catch {
      toast.error('Nie udało się usunąć grupy');
    }
  };

  const dialogProps: GroupDialogProps = {
    isDialogOpen,
    setIsDialogOpen,
    editingGroup,
    name,
    setName,
    description,
    setDescription,
    color,
    setColor,
    projects,
    selectedProjectIds,
    toggleProject,
    handleOpenDialog,
    handleSave,
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#050505]">
      <GroupManagerHeader
        assignedCount={assignedCount}
        dialogProps={dialogProps}
        groupsCount={groups.length}
        projectsCount={projects.length}
      />

      {groups.length === 0 ? (
        <EmptyGroupsState onCreate={() => handleOpenDialog()} />
      ) : (
        <GroupList
          groups={groups}
          getProjectNames={getProjectNames}
          onDelete={handleDelete}
          onEdit={handleOpenDialog}
        />
      )}
    </div>
  );
}

interface GroupManagerHeaderProps {
  assignedCount: number;
  dialogProps: GroupDialogProps;
  groupsCount: number;
  projectsCount: number;
}

function GroupManagerHeader({
  assignedCount,
  dialogProps,
  groupsCount,
  projectsCount,
}: GroupManagerHeaderProps) {
  return (
    <div className="border-b border-white/10 px-3.5 py-4 sm:px-4 lg:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-normal text-zinc-100">
            Grupy
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Segmenty dostępu, przypisania projektów i operacje administracyjne.
          </p>
        </div>

        <div className="flex justify-start sm:justify-end">
          <GroupDialog {...dialogProps} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 border border-white/10">
        <GroupStat label="Groups" value={groupsCount} />
        <GroupStat label="Assigned" value={assignedCount} />
        <GroupStat isLast label="Projects" value={projectsCount} />
      </div>
    </div>
  );
}

function GroupStat({
  isLast = false,
  label,
  value,
}: {
  isLast?: boolean;
  label: string;
  value: number;
}) {
  return (
    <div className={cn('px-3 py-3', !isLast && 'border-r border-white/10')}>
      <div className="text-[11px] font-medium uppercase tracking-normal text-zinc-600">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-100">{value}</div>
    </div>
  );
}

function EmptyGroupsState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="px-3.5 py-16 text-center sm:px-4 lg:px-5">
      <div className="mx-auto flex size-10 items-center justify-center rounded border border-white/10 bg-white/[0.03] text-zinc-500">
        <UsersRound className="size-5" aria-hidden="true" />
      </div>
      <p className="mt-4 text-sm font-medium text-zinc-200">Brak grup</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-zinc-500">
        Utwórz pierwszą grupę i przypisz do niej projekty.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-4 inline-flex h-8 items-center gap-2 rounded border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/[0.06]"
      >
        <Plus className="size-4" aria-hidden="true" />
        Utwórz grupę
      </button>
    </div>
  );
}

interface GroupListProps {
  groups: Group[];
  getProjectNames: (projectIds: string[]) => string[];
  onDelete: (groupId: string) => void;
  onEdit: (group: Group) => void;
}

function GroupList({
  groups,
  getProjectNames,
  onDelete,
  onEdit,
}: GroupListProps) {
  return (
    <section aria-label="Lista grup" className="border-b border-white/10">
      <div className="hidden grid-cols-[minmax(0,1fr)_160px_minmax(220px,0.9fr)_96px] border-b border-white/10 px-5 py-2 text-[11px] font-medium uppercase tracking-normal text-zinc-500 lg:grid">
        <div>Group</div>
        <div>Projects</div>
        <div>Assigned projects</div>
        <div className="text-right">Actions</div>
      </div>

      <div className="divide-y divide-white/10">
        {groups.map((group) => (
          <GroupRow
            key={group.id}
            group={group}
            onDelete={onDelete}
            onEdit={onEdit}
            projectNames={getProjectNames(group.projectIds)}
          />
        ))}
      </div>
    </section>
  );
}

interface GroupRowProps {
  group: Group;
  onDelete: (groupId: string) => void;
  onEdit: (group: Group) => void;
  projectNames: string[];
}

function GroupRow({ group, onDelete, onEdit, projectNames }: GroupRowProps) {
  return (
    <article className="grid grid-cols-[minmax(0,1fr)_72px] gap-3 px-3.5 py-3.5 transition-colors hover:bg-white/[0.015] lg:grid-cols-[minmax(0,1fr)_160px_minmax(220px,0.9fr)_96px] lg:items-center lg:gap-0 lg:px-5">
      <div className="min-w-0 lg:pr-5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: group.color }}
            aria-hidden="true"
          />
          <h2 className="truncate text-sm font-medium text-zinc-100">
            {group.name}
          </h2>
        </div>
        <p className="mt-1 truncate text-xs text-zinc-500">
          {group.description || 'Brak opisu'}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500 lg:hidden">
          <span>
            {group.projectIds.length}{' '}
            {group.projectIds.length === 1 ? 'projekt' : 'projektów'}
          </span>
          <span>
            {projectNames.length > 0
              ? projectNames.slice(0, 2).join(', ')
              : 'Brak przypisań'}
          </span>
        </div>
      </div>

      <div className="hidden text-xs text-zinc-500 lg:block">
        {group.projectIds.length}{' '}
        {group.projectIds.length === 1 ? 'projekt' : 'projektów'}
      </div>

      <div className="hidden min-w-0 text-xs text-zinc-500 lg:block">
        {projectNames.length > 0 ? (
          <div className="truncate">
            {projectNames.slice(0, 3).join(', ')}
            {projectNames.length > 3 ? ` +${projectNames.length - 3}` : ''}
          </div>
        ) : (
          <span>Brak przypisanych projektów</span>
        )}
      </div>

      <div className="flex justify-end gap-1">
        <button
          type="button"
          onClick={() => onEdit(group)}
          className="flex size-8 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-white/[0.03] hover:text-zinc-100"
          aria-label={`Edytuj ${group.name}`}
        >
          <Pencil className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(group.id)}
          className="flex size-8 items-center justify-center rounded text-red-400/70 transition-colors hover:bg-red-500/10 hover:text-red-200"
          aria-label={`Usuń ${group.name}`}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

interface GroupDialogProps {
  isDialogOpen: boolean;
  setIsDialogOpen: (open: boolean) => void;
  editingGroup: Group | null;
  name: string;
  setName: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  color: string;
  setColor: (value: string) => void;
  projects: Project[];
  selectedProjectIds: string[];
  toggleProject: (projectId: string) => void;
  handleOpenDialog: (group?: Group) => void;
  handleSave: () => Promise<void>;
  compactLabel?: string;
}

function GroupDialog({
  isDialogOpen,
  setIsDialogOpen,
  editingGroup,
  name,
  setName,
  description,
  setDescription,
  color,
  setColor,
  projects,
  selectedProjectIds,
  toggleProject,
  handleOpenDialog,
  handleSave,
  compactLabel = 'Nowa grupa',
}: GroupDialogProps) {
  return (
    <>
      <button
        type="button"
        onClick={() => handleOpenDialog()}
        className="inline-flex h-8 w-fit items-center gap-2 rounded border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/[0.06]"
      >
        <Plus className="size-4" aria-hidden="true" />
        {compactLabel}
      </button>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent className="border-white/10 bg-[#080809] text-zinc-100 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold tracking-normal">
            {editingGroup ? 'Edytuj grupę' : 'Nowa grupa'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs text-zinc-400">
              Nazwa
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Klienci VIP"
              className="h-9 rounded border-white/10 bg-[#050505] text-sm text-zinc-100 placeholder:text-zinc-600"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description" className="text-xs text-zinc-400">
              Opis
            </Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Krótki opis grupy"
              className="h-9 rounded border-white/10 bg-[#050505] text-sm text-zinc-100 placeholder:text-zinc-600"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="color" className="text-xs text-zinc-400">
              Kolor
            </Label>
            <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-2">
              <Input
                id="color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 rounded border-white/10 bg-[#050505] p-1"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#6b7280"
                className="h-9 rounded border-white/10 bg-[#050505] text-sm text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-zinc-400">Projekty w grupie</Label>
            <div className="max-h-[220px] overflow-y-auto border border-white/10">
              {projects.length === 0 ? (
                <div className="flex items-center gap-2 px-3 py-4 text-sm text-zinc-500">
                  <FolderOpen className="size-4" aria-hidden="true" />
                  Brak projektów.
                </div>
              ) : (
                projects.map((project) => {
                  const isSelected = selectedProjectIds.includes(project.id);

                  return (
                    <label
                      key={project.id}
                      className={cn(
                        'grid cursor-pointer grid-cols-[16px_minmax(0,1fr)] items-center gap-3 border-b border-white/10 px-3 py-2 last:border-b-0 hover:bg-white/[0.03]',
                        isSelected && 'bg-white/[0.04]'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleProject(project.id)}
                        className="size-4 rounded border-white/10 bg-[#050505]"
                      />
                      <span className="truncate text-sm text-zinc-200">
                        {project.name}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsDialogOpen(false)}
              className="inline-flex h-8 items-center rounded border border-white/10 px-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/[0.03] hover:text-zinc-100"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex h-8 items-center rounded border border-white/10 bg-zinc-100 px-3 text-sm font-medium text-zinc-950 transition-colors hover:bg-white"
            >
              Zapisz
            </button>
          </div>
        </div>
      </DialogContent>
      </Dialog>
    </>
  );
}
