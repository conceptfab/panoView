import type { Project, ShareLink } from '@/types';

export type CommandCenterShareState = 'active' | 'inactive' | 'none';

export interface CommandCenterSummary {
  totalProjects: number;
  publishedProjects: number;
  draftProjects: number;
  totalPanoramas: number;
  activeShareLinks: number;
  pinProtectedShareLinks: number;
}

export interface CommandCenterProjectRow {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  isPublished: boolean;
  panoramaCount: number;
  updatedAt: string;
  shareState: CommandCenterShareState;
  hasPin: boolean;
  nextAction: string;
}

export interface CommandCenterQuickAction {
  id: string;
  label: string;
  description: string;
  href: string;
  shortcut: string;
}

export interface CommandCenterAttentionItem {
  id: string;
  tone: 'info' | 'warning';
  title: string;
  description: string;
  href: string;
}

export interface CommandCenterActivityItem {
  id: string;
  title: string;
  description: string;
  at: string;
}

export interface CommandCenterModel {
  summary: CommandCenterSummary;
  projects: CommandCenterProjectRow[];
  quickActions: CommandCenterQuickAction[];
  attentionItems: CommandCenterAttentionItem[];
  activityItems: CommandCenterActivityItem[];
}

interface BuildCommandCenterModelInput {
  projects: Project[];
  shareLinks: ShareLink[];
}

const quickActions: CommandCenterQuickAction[] = [
  {
    id: 'import-zip',
    label: 'Importuj projekt ZIP',
    description: 'config.json, panoramy i miniatury',
    href: '/admin/projects',
    shortcut: 'I',
  },
  {
    id: 'new-project',
    label: 'Nowy projekt',
    description: 'Utwórz pusty projekt panoram',
    href: '/admin/projects/new',
    shortcut: 'N',
  },
  {
    id: 'open-studio',
    label: 'Otwórz Studio',
    description: 'Edytuj hotspoty wybranego projektu',
    href: '/admin/projects',
    shortcut: 'H',
  },
  {
    id: 'download-backup',
    label: 'Pobierz backup',
    description: 'Archiwum ZIP wszystkich projektów',
    href: '/admin/projects',
    shortcut: 'B',
  },
  {
    id: 'rebuild-metadata',
    label: 'Przebuduj metadane',
    description: 'Przelicz indeks projektów',
    href: '/admin/projects',
    shortcut: 'R',
  },
];

function shareStateFor(
  project: Project,
  shareByProjectId: Map<string, ShareLink>
): CommandCenterShareState {
  const share = shareByProjectId.get(project.id);
  if (!share) return 'none';
  return share.isActive ? 'active' : 'inactive';
}

function nextActionFor(project: Project): string {
  if (project.panoramaCount === 0) return 'Dodaj panoramy';
  if (!project.isPublished) return 'Opublikuj';
  return 'Otwórz Studio';
}

function projectHref(projectId: string): string {
  return `/admin/projects/${projectId}`;
}

export function buildCommandCenterModel({
  projects,
  shareLinks,
}: BuildCommandCenterModelInput): CommandCenterModel {
  const shareByProjectId = new Map(shareLinks.map((link) => [link.projectId, link]));
  const sortedProjects = [...projects].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const rows = sortedProjects.map((project): CommandCenterProjectRow => {
    const share = shareByProjectId.get(project.id);
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      thumbnailUrl: project.thumbnailUrl,
      isPublished: project.isPublished,
      panoramaCount: project.panoramaCount,
      updatedAt: project.updatedAt,
      shareState: shareStateFor(project, shareByProjectId),
      hasPin: Boolean(share?.pinHash),
      nextAction: nextActionFor(project),
    };
  });

  const attentionItems: CommandCenterAttentionItem[] = [];
  for (const project of sortedProjects) {
    if (!project.isPublished && project.panoramaCount > 0) {
      attentionItems.push({
        id: `${project.id}-draft-ready`,
        tone: 'info',
        title: `${project.name} jest gotowy do publikacji`,
        description: 'Projekt ma panoramy, ale nadal jest szkicem.',
        href: projectHref(project.id),
      });
    }

    if (project.panoramaCount > 0 && !project.thumbnailUrl) {
      attentionItems.push({
        id: `${project.id}-missing-thumbnail`,
        tone: 'warning',
        title: `${project.name} nie ma miniatury`,
        description: 'Wygeneruj miniaturę, żeby lista projektów była czytelna.',
        href: projectHref(project.id),
      });
    }

    const share = shareByProjectId.get(project.id);
    if (share?.isActive && share.pinHash) {
      attentionItems.push({
        id: `${project.id}-pin-share`,
        tone: 'info',
        title: `${project.name} ma aktywny link z PIN`,
        description: 'Sprawdź PIN przed wysłaniem prezentacji klientowi.',
        href: projectHref(project.id),
      });
    }
  }

  const activityItems = sortedProjects.slice(0, 5).map((project) => ({
    id: `${project.id}-updated`,
    title: `${project.name} zaktualizowany`,
    description: project.isPublished ? 'Projekt opublikowany' : 'Projekt w szkicu',
    at: project.updatedAt,
  }));

  return {
    summary: {
      totalProjects: projects.length,
      publishedProjects: projects.filter((project) => project.isPublished).length,
      draftProjects: projects.filter((project) => !project.isPublished).length,
      totalPanoramas: projects.reduce(
        (total, project) => total + project.panoramaCount,
        0
      ),
      activeShareLinks: shareLinks.filter((link) => link.isActive).length,
      pinProtectedShareLinks: shareLinks.filter((link) => Boolean(link.pinHash))
        .length,
    },
    projects: rows,
    quickActions: [...quickActions],
    attentionItems: attentionItems.slice(0, 5),
    activityItems,
  };
}
