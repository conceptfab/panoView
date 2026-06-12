import { eq, inArray } from 'drizzle-orm';
import { getDb } from './client';
import { users as usersTable, userGroups } from './schema';
import { User } from '@/types';
import { generateId, formatDate } from '@/utils/helpers';

type UserRow = typeof usersTable.$inferSelect;

function toUser(row: UserRow, groupIds: string[]): User {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    isActive: row.isActive,
    createdAt: row.createdAt,
    lastLoginAt: row.lastLoginAt,
    groupIds,
  };
}

async function groupIdsForUsers(
  userIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (userIds.length === 0) return map;
  const rows = await getDb()
    .select()
    .from(userGroups)
    .where(inArray(userGroups.userId, userIds));
  for (const row of rows) {
    const list = map.get(row.userId) ?? [];
    list.push(row.groupId);
    map.set(row.userId, list);
  }
  return map;
}

export async function getUsers(): Promise<User[]> {
  const db = getDb();
  const rows = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  const groupsMap = await groupIdsForUsers(rows.map((r) => r.id));
  return rows.map((r) => toUser(r, groupsMap.get(r.id) ?? []));
}

export async function getUserById(id: string): Promise<User | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);
  if (rows.length === 0) return null;
  const groupsMap = await groupIdsForUsers([id]);
  return toUser(rows[0], groupsMap.get(id) ?? []);
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);
  if (rows.length === 0) return null;
  const groupsMap = await groupIdsForUsers([rows[0].id]);
  return toUser(rows[0], groupsMap.get(rows[0].id) ?? []);
}

export async function createUser(
  email: string,
  role: 'admin' | 'user' | 'editor' = 'user',
  groupIds: string[] = []
): Promise<User> {
  const db = getDb();
  const existing = await getUserByEmail(email);
  if (existing) {
    throw new Error('User with this email already exists');
  }

  const newUser: User = {
    id: generateId('user'),
    email: email.toLowerCase(),
    role,
    isActive: true,
    createdAt: formatDate(new Date()),
    lastLoginAt: null,
    groupIds,
  };

  await db.insert(usersTable).values({
    id: newUser.id,
    email: newUser.email,
    role: newUser.role,
    isActive: newUser.isActive,
    createdAt: newUser.createdAt,
    lastLoginAt: newUser.lastLoginAt,
  });
  if (groupIds.length > 0) {
    await db
      .insert(userGroups)
      .values(groupIds.map((groupId) => ({ userId: newUser.id, groupId })))
      .onConflictDoNothing();
  }
  return newUser;
}

export async function updateUser(
  id: string,
  updates: Partial<Omit<User, 'id' | 'email' | 'createdAt'>>
): Promise<User | null> {
  const db = getDb();
  const { groupIds, ...fields } = updates;

  const columnUpdates: Partial<UserRow> = {};
  if (fields.role !== undefined) columnUpdates.role = fields.role;
  if (fields.isActive !== undefined) columnUpdates.isActive = fields.isActive;
  if (fields.lastLoginAt !== undefined)
    columnUpdates.lastLoginAt = fields.lastLoginAt;

  if (Object.keys(columnUpdates).length > 0) {
    const updated = await db
      .update(usersTable)
      .set(columnUpdates)
      .where(eq(usersTable.id, id))
      .returning();
    if (updated.length === 0) return null;
  }

  if (groupIds !== undefined) {
    const exists = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    if (exists.length === 0) return null;
    await db.delete(userGroups).where(eq(userGroups.userId, id));
    if (groupIds.length > 0) {
      await db
        .insert(userGroups)
        .values(groupIds.map((groupId) => ({ userId: id, groupId })))
        .onConflictDoNothing();
    }
  }

  return getUserById(id);
}

export async function updateUserLastLogin(id: string): Promise<void> {
  await updateUser(id, { lastLoginAt: formatDate(new Date()) });
}

export async function deleteUser(id: string): Promise<boolean> {
  const db = getDb();
  const deleted = await db
    .delete(usersTable)
    .where(eq(usersTable.id, id))
    .returning({ id: usersTable.id });
  return deleted.length > 0;
}
