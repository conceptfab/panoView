import { eq, and, inArray, notInArray } from 'drizzle-orm';
import { getDb } from './client';
import { groupProjects } from './schema';

/**
 * Relacja grupa-projekt jest teraz pojedynczą tabelą łączącą (group_projects),
 * więc nie ma dwóch kopii do synchronizowania. Funkcja zostaje jako no-op
 * dla zgodności z istniejącymi wywołaniami.
 */
async function syncGroupsProjectIdsFromProjects(): Promise<void> {
  // no-op: group_projects jest jedynym źródłem prawdy
}

/**
 * Ustawia pełną listę projektów grupy (zastępuje poprzednią).
 */
export async function syncGroupProjectIdsToProjects(
  groupId: string,
  projectIds: string[]
): Promise<void> {
  const db = getDb();
  if (projectIds.length === 0) {
    await db.delete(groupProjects).where(eq(groupProjects.groupId, groupId));
    return;
  }
  await db
    .delete(groupProjects)
    .where(
      and(
        eq(groupProjects.groupId, groupId),
        notInArray(groupProjects.projectId, projectIds)
      )
    );
  await db
    .insert(groupProjects)
    .values(projectIds.map((projectId) => ({ groupId, projectId })))
    .onConflictDoNothing();
}

/**
 * Ustawia pełną listę grup projektu (zastępuje poprzednią).
 */
export async function setProjectGroupIds(
  projectId: string,
  groupIds: string[]
): Promise<void> {
  const db = getDb();
  if (groupIds.length === 0) {
    await db
      .delete(groupProjects)
      .where(eq(groupProjects.projectId, projectId));
    return;
  }
  await db
    .delete(groupProjects)
    .where(
      and(
        eq(groupProjects.projectId, projectId),
        notInArray(groupProjects.groupId, groupIds)
      )
    );
  await db
    .insert(groupProjects)
    .values(groupIds.map((groupId) => ({ groupId, projectId })))
    .onConflictDoNothing();
}

/**
 * Po usunięciu grupy – wpisy znikają przez ON DELETE CASCADE; funkcja
 * zostaje dla zgodności i usuwa wpisy jawnie, gdyby była wywołana osobno.
 */
async function removeGroupFromAllProjects(
  groupId: string
): Promise<void> {
  const db = getDb();
  await db.delete(groupProjects).where(eq(groupProjects.groupId, groupId));
}

/** Pomocnicze: mapa projectId -> groupIds dla wielu projektów naraz. */
export async function groupIdsForProjects(
  projectIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (projectIds.length === 0) return map;
  const rows = await getDb()
    .select()
    .from(groupProjects)
    .where(inArray(groupProjects.projectId, projectIds));
  for (const row of rows) {
    const list = map.get(row.projectId) ?? [];
    list.push(row.groupId);
    map.set(row.projectId, list);
  }
  return map;
}
