import { readJsonFileWithDefault, writeJsonFile } from './json-store';
import { GroupsData, ProjectsData } from '@/types';

const GROUPS_FILE = 'groups.json';
const PROJECTS_FILE = 'projects.json';

/**
 * Po zmianie project.groupIds – przelicza group.projectIds dla wszystkich grup
 * (źródło prawdy: project.groupIds).
 * ZOPTYMALIZOWANE: jeden zapis zamiast N zapisów
 */
export async function syncGroupsProjectIdsFromProjects(): Promise<void> {
  const [projectsData, groupsData] = await Promise.all([
    readJsonFileWithDefault<ProjectsData>(PROJECTS_FILE, { projects: [] }),
    readJsonFileWithDefault<GroupsData>(GROUPS_FILE, { groups: [] }),
  ]);

  const projects = projectsData.projects;
  const groups = groupsData.groups;

  // Modyfikuj w pamięci
  for (const group of groups) {
    const groupId = group.id;
    group.projectIds = projects.flatMap((p) =>
      new Set(p.groupIds).has(groupId) ? [p.id] : []
    );
  }

  // Jeden zapis
  await writeJsonFile<GroupsData>(GROUPS_FILE, { groups });
}

/**
 * Po zmianie group.projectIds – aktualizuje groupIds we wszystkich projektach,
 * tak aby były zgrane z listą projektów grupy.
 * ZOPTYMALIZOWANE: jeden zapis zamiast N zapisów
 */
export async function syncGroupProjectIdsToProjects(
  groupId: string,
  projectIds: string[]
): Promise<void> {
  const projectsData = await readJsonFileWithDefault<ProjectsData>(
    PROJECTS_FILE,
    { projects: [] }
  );

  const projects = projectsData.projects;
  const selectedProjectIds = new Set(projectIds);
  let modified = false;

  for (const project of projects) {
    const projectGroupIds = new Set(project.groupIds);
    const hasGroup = projectGroupIds.has(groupId);
    const shouldHaveGroup = selectedProjectIds.has(project.id);

    if (hasGroup && !shouldHaveGroup) {
      project.groupIds = project.groupIds.filter((id) => id !== groupId);
      modified = true;
    } else if (!hasGroup && shouldHaveGroup) {
      project.groupIds.push(groupId);
      modified = true;
    }
  }

  // Jeden zapis tylko jeśli coś się zmieniło
  if (modified) {
    await writeJsonFile<ProjectsData>(PROJECTS_FILE, { projects });
  }
}

/**
 * Po usunięciu grupy – usuwa groupId z groupIds we wszystkich projektach.
 * ZOPTYMALIZOWANE: jeden zapis zamiast N zapisów
 */
export async function removeGroupFromAllProjects(
  groupId: string
): Promise<void> {
  const projectsData = await readJsonFileWithDefault<ProjectsData>(
    PROJECTS_FILE,
    { projects: [] }
  );

  const projects = projectsData.projects;
  let modified = false;

  for (const project of projects) {
    const projectGroupIds = new Set(project.groupIds);
    if (projectGroupIds.has(groupId)) {
      project.groupIds = project.groupIds.filter((id) => id !== groupId);
      modified = true;
    }
  }

  // Jeden zapis tylko jeśli coś się zmieniło
  if (modified) {
    await writeJsonFile<ProjectsData>(PROJECTS_FILE, { projects });
  }
}
