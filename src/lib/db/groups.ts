import { eq, inArray, and } from 'drizzle-orm';
import { getDb } from './client';
import { groups as groupsTable, groupProjects } from './schema';
import { Group } from '@/types';
import { generateId, formatDate } from '@/utils/helpers';
import { syncGroupProjectIdsToProjects } from './sync-groups-projects';

type GroupRow = typeof groupsTable.$inferSelect;

function toGroup(row: GroupRow, projectIds: string[]): Group {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    createdAt: row.createdAt,
    projectIds,
  };
}

async function projectIdsForGroups(
  groupIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (groupIds.length === 0) return map;
  const rows = await getDb()
    .select()
    .from(groupProjects)
    .where(inArray(groupProjects.groupId, groupIds));
  for (const row of rows) {
    const list = map.get(row.groupId) ?? [];
    list.push(row.projectId);
    map.set(row.groupId, list);
  }
  return map;
}

export async function getGroups(): Promise<Group[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(groupsTable)
    .orderBy(groupsTable.createdAt);
  const projectsMap = await projectIdsForGroups(rows.map((r) => r.id));
  return rows.map((r) => toGroup(r, projectsMap.get(r.id) ?? []));
}

export async function getGroupById(id: string): Promise<Group | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(groupsTable)
    .where(eq(groupsTable.id, id))
    .limit(1);
  if (rows.length === 0) return null;
  const projectsMap = await projectIdsForGroups([id]);
  return toGroup(rows[0], projectsMap.get(id) ?? []);
}

export async function createGroup(
  name: string,
  description: string = '',
  color: string = '#6b7280'
): Promise<Group> {
  const db = getDb();
  const newGroup: Group = {
    id: generateId('group'),
    name,
    description,
    color,
    createdAt: formatDate(new Date()),
    projectIds: [],
  };
  await db.insert(groupsTable).values({
    id: newGroup.id,
    name: newGroup.name,
    description: newGroup.description,
    color: newGroup.color,
    createdAt: newGroup.createdAt,
  });
  return newGroup;
}

export async function updateGroup(
  id: string,
  updates: Partial<Omit<Group, 'id' | 'createdAt'>>
): Promise<Group | null> {
  const db = getDb();
  const { projectIds, ...fields } = updates;

  const columnUpdates: Partial<GroupRow> = {};
  if (fields.name !== undefined) columnUpdates.name = fields.name;
  if (fields.description !== undefined)
    columnUpdates.description = fields.description;
  if (fields.color !== undefined) columnUpdates.color = fields.color;

  if (Object.keys(columnUpdates).length > 0) {
    const updated = await db
      .update(groupsTable)
      .set(columnUpdates)
      .where(eq(groupsTable.id, id))
      .returning();
    if (updated.length === 0) return null;
  } else {
    const exists = await db
      .select({ id: groupsTable.id })
      .from(groupsTable)
      .where(eq(groupsTable.id, id))
      .limit(1);
    if (exists.length === 0) return null;
  }

  if (projectIds !== undefined) {
    await syncGroupProjectIdsToProjects(id, projectIds);
  }

  return getGroupById(id);
}

async function addProjectToGroup(
  groupId: string,
  projectId: string
): Promise<boolean> {
  const db = getDb();
  const group = await db
    .select({ id: groupsTable.id })
    .from(groupsTable)
    .where(eq(groupsTable.id, groupId))
    .limit(1);
  if (group.length === 0) return false;

  await db
    .insert(groupProjects)
    .values({ groupId, projectId })
    .onConflictDoNothing();
  return true;
}

async function removeProjectFromGroup(
  groupId: string,
  projectId: string
): Promise<boolean> {
  const db = getDb();
  const group = await db
    .select({ id: groupsTable.id })
    .from(groupsTable)
    .where(eq(groupsTable.id, groupId))
    .limit(1);
  if (group.length === 0) return false;

  await db
    .delete(groupProjects)
    .where(
      and(
        eq(groupProjects.groupId, groupId),
        eq(groupProjects.projectId, projectId)
      )
    );
  return true;
}

export async function deleteGroup(id: string): Promise<boolean> {
  const db = getDb();
  // group_projects i user_groups mają ON DELETE CASCADE
  const deleted = await db
    .delete(groupsTable)
    .where(eq(groupsTable.id, id))
    .returning({ id: groupsTable.id });
  return deleted.length > 0;
}
