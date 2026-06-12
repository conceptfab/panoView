'use client';

// oxlint-disable react-doctor/prefer-useReducer

import { useState } from 'react';
import { Group, Project } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
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

  const getProjectNames = (projectIds: string[]) => {
    const projectById = new Map(projects.map((project) => [project.id, project]));
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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="size-4 mr-2" />
              Nowa grupa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingGroup ? 'Edytuj grupę' : 'Nowa grupa'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nazwa</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="np. Klienci VIP"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Opis</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Krótki opis grupy"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Kolor</Label>
                <div className="flex gap-2">
                  <Input
                    id="color"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="#6b7280"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Projekty w grupie</Label>
                <div className="border rounded-md p-3 max-h-[200px] overflow-y-auto space-y-2">
                  {projects.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Brak projektów.
                    </p>
                  ) : (
                    projects.map((project) => (
                      <label
                        key={project.id}
                        className={cn(
                          'flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-muted/50',
                          selectedProjectIds.includes(project.id) &&
                            'bg-muted/50'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedProjectIds.includes(project.id)}
                          onChange={() => toggleProject(project.id)}
                          className="size-4 rounded border-input"
                        />
                        <span className="text-sm truncate">{project.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={handleSave} className="flex-1">
                  Zapisz
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Anuluj
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map((group) => (
          <Card key={group.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="size-4 rounded-full"
                    style={{ backgroundColor: group.color }}
                  />
                  <CardTitle className="text-lg">{group.name}</CardTitle>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => handleOpenDialog(group)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-red-500"
                    onClick={() => handleDelete(group.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {group.description || 'Brak opisu'}
              </p>
              <div className="flex flex-wrap gap-1">
                {getProjectNames(group.projectIds).map((name) => (
                  <Badge key={name} variant="secondary" className="text-xs">
                    {name}
                  </Badge>
                ))}
                {group.projectIds.length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    Brak przypisanych projektów
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {groups.length === 0 && (
          <div className="col-span-full text-center py-16 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">Brak grup</p>
          </div>
        )}
      </div>
    </div>
  );
}
