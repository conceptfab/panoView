import { readJsonFileWithDefault, writeJsonFile } from './json-store';
import { Group, GroupsData } from '@/types';
import { generateId, formatDate } from '@/utils/helpers';
import { groupsDataSchema } from '@/utils/validation';
import {
  syncGroupProjectIdsToProjects,
  removeGroupFromAllProjects,
} from './sync-groups-projects';

const GROUPS_FILE = 'groups.json';

export async function getGroups(): Promise<Group[]> {
  const data = await readJsonFileWithDefault<GroupsData>(GROUPS_FILE, {
    groups: [],
  });
  const validated = groupsDataSchema.parse(data);
  return validated.groups;
}

export async function getGroupById(id: string): Promise<Group | null> {
  const groups = await getGroups();
  return groups.find((g) => g.id === id) || null;
}

export async function createGroup(
  name: string,
  description: string = '',
  color: string = '#6b7280'
): Promise<Group> {
  const groups = await getGroups();

  const newGroup: Group = {
    id: generateId('group'),
    name,
    description,
    color,
    createdAt: formatDate(new Date()),
    projectIds: [],
  };

  groups.push(newGroup);
  await writeJsonFile<GroupsData>(GROUPS_FILE, { groups });
  return newGroup;
}

export async function updateGroup(
  id: string,
  updates: Partial<Omit<Group, 'id' | 'createdAt'>>
): Promise<Group | null> {
  const groups = await getGroups();
  const index = groups.findIndex((g) => g.id === id);

  if (index === -1) return null;

  groups[index] = { ...groups[index], ...updates };
  await writeJsonFile<GroupsData>(GROUPS_FILE, { groups });

  if (updates.projectIds !== undefined) {
    await syncGroupProjectIdsToProjects(id, groups[index].projectIds);
  }
  return groups[index];
}

export async function addProjectToGroup(
  groupId: string,
  projectId: string
): Promise<boolean> {
  const groups = await getGroups();
  const group = groups.find((g) => g.id === groupId);

  if (!group) return false;

  if (!group.projectIds.includes(projectId)) {
    group.projectIds.push(projectId);
    await writeJsonFile<GroupsData>(GROUPS_FILE, { groups });
  }

  return true;
}

export async function removeProjectFromGroup(
  groupId: string,
  projectId: string
): Promise<boolean> {
  const groups = await getGroups();
  const group = groups.find((g) => g.id === groupId);

  if (!group) return false;

  group.projectIds = group.projectIds.filter((id) => id !== projectId);
  await writeJsonFile<GroupsData>(GROUPS_FILE, { groups });

  return true;
}

export async function deleteGroup(id: string): Promise<boolean> {
  const groups = await getGroups();
  const index = groups.findIndex((g) => g.id === id);

  if (index === -1) return false;

  await removeGroupFromAllProjects(id);
  groups.splice(index, 1);
  await writeJsonFile<GroupsData>(GROUPS_FILE, { groups });
  return true;
}
