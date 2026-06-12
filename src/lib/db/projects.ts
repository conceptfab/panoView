// oxlint-disable react-doctor/async-parallel react-doctor/async-await-in-loop
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import {
  readJsonFileWithDefault,
  writeJsonFile,
  ensureDir,
  deleteDir,
} from './json-store';
import { getDataRoot } from '@/lib/data-root';
import { Project, ProjectsData, ProjectConfig } from '@/types';
import { generateId, formatDate, projectSlugFromName } from '@/utils/helpers';
import { projectsDataSchema, projectConfigSchema } from '@/utils/validation';
import { syncGroupsProjectIdsFromProjects } from './sync-groups-projects';
import { ensurePanoramaVariantsForProject } from '@/lib/panorama-variants-server';
import { deleteShareLink } from './share-links';

const PROJECTS_FILE = 'projects.json';
const UPLOADS_DIR = path.join(getDataRoot(), 'uploads', 'projects');

export async function getProjects(): Promise<Project[]> {
  const data = await readJsonFileWithDefault<ProjectsData>(PROJECTS_FILE, {
    projects: [],
  });
  const validated = projectsDataSchema.parse(data);
  return validated.projects;
}

/**
 * Lista projektów budowana z dysku przy każdym odświeżeniu.
 * Czyta katalog uploads/projects/, dla każdego podkatalogu szuka wpisu w projects.json.
 */
export async function getProjectsWithExistingFolders(): Promise<Project[]> {
  let dirIds: string[];
  try {
    const entries = await fs.readdir(UPLOADS_DIR, { withFileTypes: true });
    dirIds = entries.flatMap((e) => (e.isDirectory() ? [e.name] : []));
  } catch {
    dirIds = [];
  }
  const projects = await getProjects();
  const byId = new Map(projects.map((p) => [p.id, p]));
  return dirIds.flatMap((id) => {
    const project = byId.get(id);
    return project ? [project] : [];
  });
}

export async function getProjectById(id: string): Promise<Project | null> {
  const projects = await getProjects();
  const project = projects.find((p) => p.id === id) || null;
  if (!project) return null;
  if (!existsSync(path.join(UPLOADS_DIR, id))) return null;
  return project;
}

export async function getProjectsByGroupId(
  groupId: string
): Promise<Project[]> {
  const projects = await getProjects();
  return projects.filter((p) => p.groupIds.includes(groupId));
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

export async function createProject(
  name: string,
  description: string,
  createdBy: string,
  groupIds: string[] = []
): Promise<Project> {
  const projects = await getProjects();
  const existingIds = projects.map((p) => p.id);
  const baseSlug = projectSlugFromName(name, description) || generateId('proj');
  const id = ensureUniqueProjectSlug(existingIds, baseSlug);
  const now = formatDate(new Date());

  const projectDir = path.join(UPLOADS_DIR, id);
  await ensureDir(projectDir);
  await ensureDir(path.join(projectDir, 'panoramas'));
  await ensureDir(path.join(projectDir, 'thumbnails'));

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

  const configPath = path.join(projectDir, 'config.json');
  await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));

  const newProject: Project = {
    id,
    name,
    description,
    thumbnailUrl: '',
    configPath: `/uploads/projects/${id}/config.json`,
    createdAt: now,
    updatedAt: now,
    createdBy,
    groupIds,
    isPublished: false,
    panoramaCount: 0,
  };

  projects.push(newProject);
  await writeJsonFile<ProjectsData>(PROJECTS_FILE, { projects });

  await syncGroupsProjectIdsFromProjects();
  return newProject;
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

  const projects = await getProjects();
  const existingIds = projects.map((p) => p.id);
  const baseSlug =
    projectSlugFromName(name, description) || generateId('proj');
  const newId = ensureUniqueProjectSlug(existingIds, baseSlug);

  await ensureDir(UPLOADS_DIR);
  const sourceDir = path.join(UPLOADS_DIR, id);
  const destinationDir = path.join(UPLOADS_DIR, newId);
  if (existsSync(destinationDir)) {
    throw new Error('Destination already exists');
  }
  await fs.cp(sourceDir, destinationDir, { recursive: true });

  const now = formatDate(new Date());
  const updatedConfig: ProjectConfig = {
    ...config,
    projectName: name,
    description,
    createdAt: now,
    updatedAt: now,
  };
  const validatedConfig = projectConfigSchema.parse(updatedConfig);
  await fs.writeFile(
    path.join(destinationDir, 'config.json'),
    JSON.stringify(validatedConfig, null, 2),
    'utf-8'
  );

  let thumbnailUrl = '';
  if (
    validatedConfig.panoramas.length &&
    validatedConfig.panoramas[0].thumbnail
  ) {
    thumbnailUrl = `/uploads/projects/${newId}/thumbnails/${validatedConfig.panoramas[0].thumbnail}`;
  }

  const newProject: Project = {
    id: newId,
    name,
    description,
    thumbnailUrl,
    configPath: `/uploads/projects/${newId}/config.json`,
    createdAt: now,
    updatedAt: now,
    createdBy: options.createdBy,
    groupIds: options.groupIds ?? original.groupIds,
    isPublished: false,
    panoramaCount: validatedConfig.panoramas.length,
  };

  projects.push(newProject);
  await writeJsonFile<ProjectsData>(PROJECTS_FILE, { projects });
  await syncGroupsProjectIdsFromProjects();
  return newProject;
}

export async function updateProject(
  id: string,
  updates: Partial<Omit<Project, 'id' | 'createdAt' | 'createdBy'>>,
  options?: { skipGroupSync?: boolean }
): Promise<Project | null> {
  const projects = await getProjects();
  const index = projects.findIndex((p) => p.id === id);

  if (index === -1) return null;

  projects[index] = {
    ...projects[index],
    ...updates,
    updatedAt: formatDate(new Date()),
  };

  await writeJsonFile<ProjectsData>(PROJECTS_FILE, { projects });

  if (updates.groupIds !== undefined && !options?.skipGroupSync) {
    await syncGroupsProjectIdsFromProjects();
  }
  return projects[index];
}

export async function renameProjectAndId(
  oldId: string,
  newName: string,
  newDescription: string
): Promise<Project | null> {
  const projects = await getProjects();
  const index = projects.findIndex((p) => p.id === oldId);

  if (index === -1) return null;

  const original = projects[index];

  const existingIds = projects.flatMap((p) => (p.id !== oldId ? [p.id] : []));
  const baseSlug = projectSlugFromName(newName, newDescription) || generateId('proj');
  const newId = ensureUniqueProjectSlug(existingIds, baseSlug);

  if (newId === oldId) return original;

  await ensureDir(UPLOADS_DIR);
  const sourceDir = path.join(UPLOADS_DIR, oldId);
  const destinationDir = path.join(UPLOADS_DIR, newId);

  if (existsSync(sourceDir)) {
    if (existsSync(destinationDir)) {
      throw new Error('Destination already exists');
    }
    await fs.rename(sourceDir, destinationDir);
  } else {
    await ensureDir(destinationDir);
  }

  const now = formatDate(new Date());

  let newThumbnailUrl = original.thumbnailUrl;
  if (newThumbnailUrl?.includes(`/uploads/projects/${oldId}/`)) {
    newThumbnailUrl = newThumbnailUrl.replace(`/uploads/projects/${oldId}/`, `/uploads/projects/${newId}/`);
  }

  projects[index] = {
    ...original,
    id: newId,
    name: newName,
    description: newDescription || original.description,
    configPath: `/uploads/projects/${newId}/config.json`,
    thumbnailUrl: newThumbnailUrl,
    updatedAt: now,
  };

  await writeJsonFile<ProjectsData>(PROJECTS_FILE, { projects });
  await syncGroupsProjectIdsFromProjects();

  return projects[index];
}

export async function deleteProject(id: string): Promise<boolean> {
  const projects = await getProjects();
  const index = projects.findIndex((p) => p.id === id);

  if (index === -1) return false;

  const projectDir = path.join(UPLOADS_DIR, id);
  if (existsSync(projectDir)) {
    await deleteDir(projectDir);
  }

  projects.splice(index, 1);
  await writeJsonFile<ProjectsData>(PROJECTS_FILE, { projects });

  await syncGroupsProjectIdsFromProjects();
  await deleteShareLink(id);
  return true;
}

export async function getProjectConfig(
  id: string
): Promise<ProjectConfig | null> {
  const configPath = path.join(UPLOADS_DIR, id, 'config.json');
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const config = projectConfigSchema.parse(JSON.parse(content));

    // Auto-migration: dla starszych projektów generuje brakujące warianty,
    // gdy optymalizacja jest włączona.
    const ensured = await ensurePanoramaVariantsForProject(id, config);
    if (ensured.changed) {
      ensured.config.updatedAt = formatDate(new Date());
      await fs.writeFile(configPath, JSON.stringify(ensured.config, null, 2));
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
  const configPath = path.join(UPLOADS_DIR, id, 'config.json');
  try {
    const validated = projectConfigSchema.parse(config);
    validated.updatedAt = formatDate(new Date());
    await fs.writeFile(configPath, JSON.stringify(validated, null, 2));

    // Set project thumbnail to first panorama's thumbnail
    let thumbnailUrl = '';
    if (validated.panoramas.length > 0 && validated.panoramas[0].thumbnail) {
      thumbnailUrl = `/uploads/projects/${id}/thumbnails/${validated.panoramas[0].thumbnail}`;
    }

    await updateProject(id, {
      name: validated.projectName,
      description: validated.description,
      panoramaCount: validated.panoramas.length,
      thumbnailUrl,
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * Zwraca rozmiar katalogu projektu na dysku (w bajtach).
 * Zwraca 0, jeśli katalog nie istnieje lub wystąpi błąd.
 * ZOPTYMALIZOWANE: równoległe wywołania fs.stat
 */
export async function getProjectSize(id: string): Promise<number> {
  const projectDir = path.join(UPLOADS_DIR, id);
  try {
    return await getDirSizeParallel(projectDir);
  } catch {
    return 0;
  }
}

async function getDirSizeParallel(dirPath: string): Promise<number> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  const sizes = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);
      try {
        if (entry.isDirectory()) {
          return await getDirSizeParallel(fullPath);
        }
        const stat = await fs.stat(fullPath);
        return stat.size;
      } catch {
        return 0;
      }
    })
  );

  return sizes.reduce((a, b) => a + b, 0);
}

export interface RebuildProjectsResult {
  updated: number;
  removed: number;
  added: number;
  projects: Project[];
}

/**
 * Przebudowuje globalną listę projektów na podstawie folderów w uploads/projects/.
 * - Tylko foldery na dysku = wpisy w liście (usuwa stare/orphaned wpisy).
 * - Dla każdego folderu synchronizuje name, description, panoramaCount, thumbnailUrl z config.json.
 * - Dla folderów bez wpisu w projects.json tworzy nowy wpis.
 * Po zapisie wywołuje syncGroupsProjectIdsFromProjects().
 */
export async function rebuildProjects(): Promise<RebuildProjectsResult> {
  let dirIds: string[];
  try {
    const entries = await fs.readdir(UPLOADS_DIR, { withFileTypes: true });
    dirIds = entries.flatMap((e) => (e.isDirectory() ? [e.name] : []));
  } catch {
    dirIds = [];
  }

  const currentProjects = await getProjects();
  const byId = new Map(currentProjects.map((p) => [p.id, p]));

  const newProjects: Project[] = [];
  let updated = 0;
  let added = 0;

  for (const id of dirIds) {
    const config = await getProjectConfig(id);
    const name = config?.projectName ?? id;
    const description = config?.description ?? '';
    const panoramaCount = config?.panoramas?.length ?? 0;
    let thumbnailUrl = '';
    if (config?.panoramas?.length && config.panoramas[0].thumbnail) {
      thumbnailUrl = `/uploads/projects/${id}/thumbnails/${config.panoramas[0].thumbnail}`;
    }
    const configPath = `/uploads/projects/${id}/config.json`;
    const now = formatDate(new Date());

    const existing = byId.get(id);
    if (existing) {
      const customThumbPath = `/uploads/projects/${id}/thumbnails/thumb.webp`;
      const keepCustomThumb =
        existing.thumbnailUrl === customThumbPath &&
        existsSync(path.join(UPLOADS_DIR, id, 'thumbnails', 'thumb.webp'));
      const finalThumbnailUrl = keepCustomThumb
        ? existing.thumbnailUrl
        : thumbnailUrl;

      const changed =
        existing.name !== name ||
        existing.description !== description ||
        existing.panoramaCount !== panoramaCount ||
        existing.thumbnailUrl !== finalThumbnailUrl;

      newProjects.push({
        ...existing,
        name,
        description,
        panoramaCount,
        thumbnailUrl: finalThumbnailUrl,
        configPath,
        updatedAt: now,
      });
      if (changed) updated++;
    } else {
      newProjects.push({
        id,
        name,
        description,
        thumbnailUrl,
        configPath,
        createdAt: config?.createdAt ?? now,
        updatedAt: now,
        createdBy: 'system',
        groupIds: [],
        isPublished: false,
        panoramaCount,
      });
      added++;
    }
  }

  const dirIdSet = new Set(dirIds);
  const removed = currentProjects.filter((p) => !dirIdSet.has(p.id)).length;

  await writeJsonFile<ProjectsData>(PROJECTS_FILE, { projects: newProjects });
  await syncGroupsProjectIdsFromProjects();

  return {
    updated,
    removed,
    added,
    projects: newProjects,
  };
}
