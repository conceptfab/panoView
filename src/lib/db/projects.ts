import { eq, inArray } from 'drizzle-orm';
import { getDb } from './client';
import { projects as projectsTable, groupProjects, shareLinks } from './schema';
import { Project, ProjectConfig } from '@/types';
import { generateId, formatDate, projectSlugFromName } from '@/utils/helpers';
import { projectConfigSchema } from '@/utils/validation';
import { setProjectGroupIds, groupIdsForProjects } from './sync-groups-projects';
import { ensurePanoramaVariantsForProject } from '@/lib/panorama-variants-server';
import {
  projectPrefix,
  copyPrefix,
  deletePrefix,
  prefixSize,
} from '@/lib/storage/blob';

type ProjectRow = typeof projectsTable.$inferSelect;

function configPathFor(id: string): string {
  return `/uploads/projects/${id}/config.json`;
}

function toProject(row: ProjectRow, groupIds: string[]): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    thumbnailUrl: row.thumbnailUrl,
    configPath: configPathFor(row.id),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy,
    groupIds,
    isPublished: row.isPublished,
    panoramaCount: row.panoramaCount,
  };
}

export async function getProjects(): Promise<Project[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(projectsTable)
    .orderBy(projectsTable.createdAt);
  const groupsMap = await groupIdsForProjects(rows.map((r) => r.id));
  return rows.map((r) => toProject(r, groupsMap.get(r.id) ?? []));
}

/**
 * Dawniej: lista projektów z istniejącym folderem na dysku.
 * Teraz baza jest źródłem prawdy – zwraca wszystkie projekty.
 */
export async function getProjectsWithExistingFolders(): Promise<Project[]> {
  return getProjects();
}

export async function getProjectById(id: string): Promise<Project | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, id))
    .limit(1);
  if (rows.length === 0) return null;
  const groupsMap = await groupIdsForProjects([id]);
  return toProject(rows[0], groupsMap.get(id) ?? []);
}

export async function getProjectsByGroupId(
  groupId: string
): Promise<Project[]> {
  const db = getDb();
  const links = await db
    .select({ projectId: groupProjects.projectId })
    .from(groupProjects)
    .where(eq(groupProjects.groupId, groupId));
  const ids = links.map((l) => l.projectId);
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(projectsTable)
    .where(inArray(projectsTable.id, ids));
  const groupsMap = await groupIdsForProjects(ids);
  return rows.map((r) => toProject(r, groupsMap.get(r.id) ?? []));
}

export async function getProjectsForUser(
  userGroupIds: string[]
): Promise<Project[]> {
  const projects = await getProjects();
  return projects.filter(
    (p) => p.isPublished && p.groupIds.some((gid) => userGroupIds.includes(gid))
  );
}

function ensureUniqueProjectSlug(
  existingIds: string[],
  baseSlug: string
): string {
  const existingIdSet = new Set(existingIds);
  if (!existingIdSet.has(baseSlug)) return baseSlug;
  let n = 2;
  while (existingIdSet.has(`${baseSlug}-${n}`)) n++;
  return `${baseSlug}-${n}`;
}

async function getAllProjectIds(): Promise<string[]> {
  const rows = await getDb()
    .select({ id: projectsTable.id })
    .from(projectsTable);
  return rows.map((r) => r.id);
}

export async function createProject(
  name: string,
  description: string,
  createdBy: string,
  groupIds: string[] = []
): Promise<Project> {
  const db = getDb();
  const existingIds = await getAllProjectIds();
  const baseSlug = projectSlugFromName(name, description) || generateId('proj');
  const id = ensureUniqueProjectSlug(existingIds, baseSlug);
  const now = formatDate(new Date());

  const defaultConfig: ProjectConfig = {
    version: '1.0',
    projectName: name,
    description,
    createdAt: now,
    updatedAt: now,
    settings: {
      autoRotate: true,
      autoRotateSpeed: 0.5,
      autoRotateDelay: 30000,
      cameraFov: 55,
      optimizePanoramaForScreen: true,
      controlBar: false,
      splashDuration: 3000,
      fadeDuration: 2000,
    },
    panoramas: [],
    metadata: {
      author: 'CONCEPTFAB',
      client: '',
      tags: [],
    },
  };

  await db.insert(projectsTable).values({
    id,
    name,
    description,
    thumbnailUrl: '',
    createdAt: now,
    updatedAt: now,
    createdBy,
    isPublished: false,
    panoramaCount: 0,
    config: defaultConfig,
  });
  if (groupIds.length > 0) {
    await setProjectGroupIds(id, groupIds);
  }

  return {
    id,
    name,
    description,
    thumbnailUrl: '',
    configPath: configPathFor(id),
    createdAt: now,
    updatedAt: now,
    createdBy,
    groupIds,
    isPublished: false,
    panoramaCount: 0,
  };
}

export interface CloneProjectOptions {
  name?: string;
  description?: string;
  groupIds?: string[];
  createdBy: string;
}

export async function cloneProject(
  id: string,
  options: CloneProjectOptions
): Promise<Project> {
  const db = getDb();
  const original = await getProjectById(id);
  if (!original) {
    throw new Error('Project not found');
  }

  const config = await getProjectConfig(id);
  if (!config) {
    throw new Error('Config not found');
  }

  const fallbackName = original.name
    ? `${original.name} (kopia)`
    : 'Kopia projektu';
  const normalizedName = options.name?.trim() || fallbackName;
  if (!normalizedName) {
    throw new Error('Project name cannot be empty');
  }
  const name = normalizedName.slice(0, 200);
  const descriptionBase =
    options.description?.trim() ?? original.description ?? '';
  const description = descriptionBase.slice(0, 1000);

  const existingIds = await getAllProjectIds();
  const baseSlug = projectSlugFromName(name, description) || generateId('proj');
  const newId = ensureUniqueProjectSlug(existingIds, baseSlug);

  // Kopiowanie wszystkich plików projektu w Blob (panoramy, miniatury)
  await copyPrefix(projectPrefix(id), projectPrefix(newId));

  const now = formatDate(new Date());
  const updatedConfig: ProjectConfig = {
    ...config,
    projectName: name,
    description,
    createdAt: now,
    updatedAt: now,
  };
  const validatedConfig = projectConfigSchema.parse(updatedConfig);

  let thumbnailUrl = '';
  if (
    validatedConfig.panoramas.length &&
    validatedConfig.panoramas[0].thumbnail
  ) {
    thumbnailUrl = `/uploads/projects/${newId}/thumbnails/${validatedConfig.panoramas[0].thumbnail}`;
  }

  await db.insert(projectsTable).values({
    id: newId,
    name,
    description,
    thumbnailUrl,
    createdAt: now,
    updatedAt: now,
    createdBy: options.createdBy,
    isPublished: false,
    panoramaCount: validatedConfig.panoramas.length,
    config: validatedConfig,
  });

  const groupIds = options.groupIds ?? original.groupIds;
  if (groupIds.length > 0) {
    await setProjectGroupIds(newId, groupIds);
  }

  return {
    id: newId,
    name,
    description,
    thumbnailUrl,
    configPath: configPathFor(newId),
    createdAt: now,
    updatedAt: now,
    createdBy: options.createdBy,
    groupIds,
    isPublished: false,
    panoramaCount: validatedConfig.panoramas.length,
  };
}

export async function updateProject(
  id: string,
  updates: Partial<Omit<Project, 'id' | 'createdAt' | 'createdBy'>>,
  options?: { skipGroupSync?: boolean }
): Promise<Project | null> {
  void options; // relacja grupa-projekt ma jedno źródło prawdy – sync nie jest potrzebny
  const db = getDb();
  const { groupIds, ...fields } = updates;

  const columnUpdates: Partial<ProjectRow> = {
    updatedAt: formatDate(new Date()),
  };
  if (fields.name !== undefined) columnUpdates.name = fields.name;
  if (fields.description !== undefined)
    columnUpdates.description = fields.description;
  if (fields.thumbnailUrl !== undefined)
    columnUpdates.thumbnailUrl = fields.thumbnailUrl;
  if (fields.isPublished !== undefined)
    columnUpdates.isPublished = fields.isPublished;
  if (fields.panoramaCount !== undefined)
    columnUpdates.panoramaCount = fields.panoramaCount;

  const updated = await db
    .update(projectsTable)
    .set(columnUpdates)
    .where(eq(projectsTable.id, id))
    .returning();
  if (updated.length === 0) return null;

  if (groupIds !== undefined) {
    await setProjectGroupIds(id, groupIds);
  }

  return getProjectById(id);
}

export async function renameProjectAndId(
  oldId: string,
  newName: string,
  newDescription: string
): Promise<Project | null> {
  const db = getDb();
  const original = await getProjectById(oldId);
  if (!original) return null;

  const existingIds = (await getAllProjectIds()).filter((i) => i !== oldId);
  const baseSlug =
    projectSlugFromName(newName, newDescription) || generateId('proj');
  const newId = ensureUniqueProjectSlug(existingIds, baseSlug);

  if (newId === oldId) return original;

  const rows = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, oldId))
    .limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];

  // Przeniesienie plików w Blob (kopiowanie + usunięcie starego prefiksu)
  await copyPrefix(projectPrefix(oldId), projectPrefix(newId));

  const now = formatDate(new Date());

  let newThumbnailUrl = row.thumbnailUrl;
  if (newThumbnailUrl?.includes(`/uploads/projects/${oldId}/`)) {
    newThumbnailUrl = newThumbnailUrl.replace(
      `/uploads/projects/${oldId}/`,
      `/uploads/projects/${newId}/`
    );
  }

  const description = newDescription || row.description;
  const newConfig: ProjectConfig = {
    ...row.config,
    projectName: newName,
    description,
    updatedAt: now,
  };

  // Zmiana PK: nowy wiersz + przepięcie referencji + usunięcie starego
  await db.insert(projectsTable).values({
    id: newId,
    name: newName,
    description,
    thumbnailUrl: newThumbnailUrl,
    createdAt: row.createdAt,
    updatedAt: now,
    createdBy: row.createdBy,
    isPublished: row.isPublished,
    panoramaCount: row.panoramaCount,
    config: newConfig,
  });
  await db
    .update(groupProjects)
    .set({ projectId: newId })
    .where(eq(groupProjects.projectId, oldId));
  await db
    .update(shareLinks)
    .set({ projectId: newId })
    .where(eq(shareLinks.projectId, oldId));
  await db.delete(projectsTable).where(eq(projectsTable.id, oldId));

  await deletePrefix(projectPrefix(oldId));

  return getProjectById(newId);
}

export async function deleteProject(id: string): Promise<boolean> {
  const db = getDb();
  // group_projects i share_links znikają przez ON DELETE CASCADE
  const deleted = await db
    .delete(projectsTable)
    .where(eq(projectsTable.id, id))
    .returning({ id: projectsTable.id });
  if (deleted.length === 0) return false;

  await deletePrefix(projectPrefix(id));
  return true;
}

export async function getProjectConfig(
  id: string
): Promise<ProjectConfig | null> {
  const db = getDb();
  const rows = await db
    .select({ config: projectsTable.config })
    .from(projectsTable)
    .where(eq(projectsTable.id, id))
    .limit(1);
  if (rows.length === 0) return null;

  try {
    const config = projectConfigSchema.parse(rows[0].config);

    // Auto-migration: dla starszych projektów generuje brakujące warianty,
    // gdy optymalizacja jest włączona.
    const ensured = await ensurePanoramaVariantsForProject(id, config);
    if (ensured.changed) {
      ensured.config.updatedAt = formatDate(new Date());
      await db
        .update(projectsTable)
        .set({ config: ensured.config })
        .where(eq(projectsTable.id, id));
      return ensured.config;
    }

    return config;
  } catch {
    return null;
  }
}

export async function updateProjectConfig(
  id: string,
  config: ProjectConfig
): Promise<boolean> {
  const db = getDb();
  try {
    const validated = projectConfigSchema.parse(config);
    validated.updatedAt = formatDate(new Date());

    // Set project thumbnail to first panorama's thumbnail
    let thumbnailUrl = '';
    if (validated.panoramas.length > 0 && validated.panoramas[0].thumbnail) {
      thumbnailUrl = `/uploads/projects/${id}/thumbnails/${validated.panoramas[0].thumbnail}`;
    }

    const updated = await db
      .update(projectsTable)
      .set({
        config: validated,
        name: validated.projectName,
        description: validated.description,
        panoramaCount: validated.panoramas.length,
        thumbnailUrl,
        updatedAt: validated.updatedAt,
      })
      .where(eq(projectsTable.id, id))
      .returning({ id: projectsTable.id });

    return updated.length > 0;
  } catch {
    return false;
  }
}

/**
 * Zwraca łączny rozmiar plików projektu w Blob (w bajtach).
 * Zwraca 0, jeśli projekt nie ma plików lub wystąpi błąd.
 */
export async function getProjectSize(id: string): Promise<number> {
  try {
    return await prefixSize(projectPrefix(id));
  } catch {
    return 0;
  }
}

export interface RebuildProjectsResult {
  updated: number;
  removed: number;
  added: number;
  projects: Project[];
}

/**
 * Przelicza zdenormalizowane pola projektów (name, description, panoramaCount,
 * thumbnailUrl) na podstawie kolumny config. Baza jest źródłem prawdy –
 * nie ma już skanowania folderów na dysku.
 */
export async function rebuildProjects(): Promise<RebuildProjectsResult> {
  const db = getDb();
  const rows = await db.select().from(projectsTable);
  let updated = 0;

  for (const row of rows) {
    const config = row.config;
    const name = config?.projectName ?? row.id;
    const description = config?.description ?? '';
    const panoramaCount = config?.panoramas?.length ?? 0;
    let thumbnailUrl = '';
    if (config?.panoramas?.length && config.panoramas[0].thumbnail) {
      thumbnailUrl = `/uploads/projects/${row.id}/thumbnails/${config.panoramas[0].thumbnail}`;
    }

    // Zachowaj ręcznie ustawioną miniaturę projektu (thumb.webp)
    const customThumbPath = `/uploads/projects/${row.id}/thumbnails/thumb.webp`;
    const finalThumbnailUrl =
      row.thumbnailUrl === customThumbPath ? row.thumbnailUrl : thumbnailUrl;

    const changed =
      row.name !== name ||
      row.description !== description ||
      row.panoramaCount !== panoramaCount ||
      row.thumbnailUrl !== finalThumbnailUrl;

    if (changed) {
      await db
        .update(projectsTable)
        .set({
          name,
          description,
          panoramaCount,
          thumbnailUrl: finalThumbnailUrl,
          updatedAt: formatDate(new Date()),
        })
        .where(eq(projectsTable.id, row.id));
      updated++;
    }
  }

  const projects = await getProjects();
  return {
    updated,
    removed: 0,
    added: 0,
    projects,
  };
}
