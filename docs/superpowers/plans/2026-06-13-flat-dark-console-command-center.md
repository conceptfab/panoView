# Flat Dark Console Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first redesign slice: a flat dark console shell plus a new command-first signed-in Command Center for project operations.

**Architecture:** Add a pure `command-center` view-model helper for testable summaries, then add focused console UI components under `src/components/console/`. Replace the dashboard layout chrome with `ConsoleShell`, and change signed-in/admin redirects to land on a new `/command-center` route.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4 utility classes, shadcn/ui primitives where useful, lucide-react icons, Vitest for pure helper tests.

---

## File Structure

Create:

- `src/lib/command-center.ts`: pure data shaping for Command Center summaries, project rows, quick actions, attention items, and activity rows.
- `tests/command-center.test.ts`: Vitest coverage for `buildCommandCenterModel`.
- `src/components/console/ConsoleShell.tsx`: authenticated dashboard shell with sidebar/topbar/mobile nav.
- `src/components/console/CommandBar.tsx`: flat command/search affordance.
- `src/components/console/ConsoleSection.tsx`: thin bordered section primitive for flat console layout.
- `src/components/console/ProjectOperationsTable.tsx`: recent project operational list/table.
- `src/components/console/QuickActionList.tsx`: right-side command actions.
- `src/components/console/AttentionList.tsx`: right-side attention items.
- `src/components/console/ActivityList.tsx`: right-side activity summary.
- `src/app/(dashboard)/command-center/page.tsx`: new default operational landing page.

Modify:

- `src/app/(dashboard)/layout.tsx`: replace `DashboardNav` usage with `ConsoleShell`.
- `src/app/page.tsx`: redirect signed-in admins/editors to `/command-center`, and regular users to `/gallery`.
- `src/app/(dashboard)/admin/page.tsx`: redirect `/admin` to `/command-center`.
- `src/components/admin/DashboardNav.tsx`: keep temporarily for any untouched imports, but do not use it in the dashboard layout after this plan.

Do not modify:

- `src/components/editor/HotspotEditor.tsx`
- `src/components/viewer/PanoViewer.tsx`
- `src/app/(dashboard)/admin/projects/[id]/page.tsx`

Those are later phases from the spec.

---

### Task 1: Command Center View Model

**Files:**

- Create: `tests/command-center.test.ts`
- Create: `src/lib/command-center.ts`

- [ ] **Step 1: Write failing tests for summary, rows, attention, and actions**

Create `tests/command-center.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Project, ShareLink } from '@/types';
import { buildCommandCenterModel } from '@/lib/command-center';

const baseProject = {
  configPath: '',
  createdAt: '2026-06-01T10:00:00.000Z',
  createdBy: 'admin',
  groupIds: [],
  thumbnailUrl: '',
} satisfies Partial<Project>;

function project(overrides: Partial<Project> & Pick<Project, 'id' | 'name'>): Project {
  return {
    ...baseProject,
    id: overrides.id,
    name: overrides.name,
    description: overrides.description ?? '',
    updatedAt: overrides.updatedAt ?? '2026-06-12T12:00:00.000Z',
    isPublished: overrides.isPublished ?? false,
    panoramaCount: overrides.panoramaCount ?? 0,
    thumbnailUrl: overrides.thumbnailUrl ?? '',
    configPath: overrides.configPath ?? '',
    createdAt: overrides.createdAt ?? baseProject.createdAt!,
    createdBy: overrides.createdBy ?? baseProject.createdBy!,
    groupIds: overrides.groupIds ?? [],
  };
}

function share(overrides: Partial<ShareLink> & Pick<ShareLink, 'projectId'>): ShareLink {
  return {
    projectId: overrides.projectId,
    token: overrides.token ?? `token-${overrides.projectId}`,
    isActive: overrides.isActive ?? false,
    pinHash: overrides.pinHash ?? null,
    createdAt: overrides.createdAt ?? '2026-06-01T10:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-06-12T12:00:00.000Z',
  };
}

describe('buildCommandCenterModel', () => {
  it('builds totals and orders recent projects by updated date descending', () => {
    const model = buildCommandCenterModel({
      projects: [
        project({
          id: 'older',
          name: 'Older',
          isPublished: true,
          panoramaCount: 2,
          updatedAt: '2026-06-10T12:00:00.000Z',
        }),
        project({
          id: 'newer',
          name: 'Newer',
          isPublished: false,
          panoramaCount: 5,
          updatedAt: '2026-06-12T12:00:00.000Z',
        }),
      ],
      shareLinks: [share({ projectId: 'older', isActive: true, pinHash: 'hash' })],
    });

    expect(model.summary).toEqual({
      totalProjects: 2,
      publishedProjects: 1,
      draftProjects: 1,
      totalPanoramas: 7,
      activeShareLinks: 1,
      pinProtectedShareLinks: 1,
    });
    expect(model.projects.map((p) => p.id)).toEqual(['newer', 'older']);
  });

  it('marks project share state and next action', () => {
    const model = buildCommandCenterModel({
      projects: [
        project({
          id: 'published-with-share',
          name: 'Published',
          isPublished: true,
          panoramaCount: 3,
        }),
        project({
          id: 'draft-ready',
          name: 'Draft Ready',
          isPublished: false,
          panoramaCount: 4,
        }),
        project({
          id: 'empty-draft',
          name: 'Empty Draft',
          isPublished: false,
          panoramaCount: 0,
        }),
      ],
      shareLinks: [
        share({ projectId: 'published-with-share', isActive: true }),
        share({ projectId: 'draft-ready', isActive: false }),
      ],
    });

    expect(model.projects.map((p) => [p.id, p.shareState, p.nextAction])).toEqual([
      ['published-with-share', 'active', 'Otwórz Studio'],
      ['draft-ready', 'inactive', 'Opublikuj'],
      ['empty-draft', 'none', 'Dodaj panoramy'],
    ]);
  });

  it('surfaces attention items for draft-ready projects, missing thumbnails, and PIN links', () => {
    const model = buildCommandCenterModel({
      projects: [
        project({
          id: 'draft-ready',
          name: 'Draft Ready',
          isPublished: false,
          panoramaCount: 4,
          thumbnailUrl: '',
        }),
        project({
          id: 'published-pin',
          name: 'Published PIN',
          isPublished: true,
          panoramaCount: 2,
          thumbnailUrl: '/thumb.webp',
        }),
      ],
      shareLinks: [share({ projectId: 'published-pin', isActive: true, pinHash: 'hash' })],
    });

    expect(model.attentionItems.map((item) => item.title)).toEqual([
      'Draft Ready jest gotowy do publikacji',
      'Draft Ready nie ma miniatury',
      'Published PIN ma aktywny link z PIN',
    ]);
  });

  it('exposes the fixed quick actions used by the console', () => {
    const model = buildCommandCenterModel({ projects: [], shareLinks: [] });

    expect(model.quickActions.map((action) => action.label)).toEqual([
      'Importuj projekt ZIP',
      'Nowy projekt',
      'Otwórz Studio',
      'Pobierz backup',
      'Przebuduj metadane',
    ]);
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- tests/command-center.test.ts
```

Expected: fail with an import error because `src/lib/command-center.ts` does not exist.

- [ ] **Step 3: Implement the pure view model**

Create `src/lib/command-center.ts`:

```ts
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
        href: `/pano/${project.id}`,
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
    quickActions,
    attentionItems: attentionItems.slice(0, 5),
    activityItems,
  };
}
```

- [ ] **Step 4: Run the view-model test**

Run:

```bash
npm test -- tests/command-center.test.ts
```

Expected: pass, with 4 tests passing.

- [ ] **Step 5: Commit the view-model slice**

Run:

```bash
git add src/lib/command-center.ts tests/command-center.test.ts
git commit -m "feat: add command center model"
```

Expected: commit succeeds.

---

### Task 2: Flat Console Shell Components

**Files:**

- Create: `src/components/console/ConsoleShell.tsx`
- Create: `src/components/console/CommandBar.tsx`
- Create: `src/components/console/ConsoleSection.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create `CommandBar`**

Create `src/components/console/CommandBar.tsx`:

```tsx
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommandBarProps {
  placeholder?: string;
  className?: string;
}

export function CommandBar({
  placeholder = 'Szukaj projektu lub wpisz akcję...',
  className,
}: CommandBarProps) {
  return (
    <div
      className={cn(
        'grid h-10 grid-cols-[2rem_minmax(0,1fr)_auto] items-center rounded border border-white/10 bg-[#080809] px-2 text-sm text-zinc-500',
        className
      )}
      role="search"
      aria-label="Szukaj projektu lub akcji"
    >
      <Search className="size-4 text-zinc-500" aria-hidden />
      <span className="truncate text-zinc-400">{placeholder}</span>
      <kbd className="rounded border border-white/10 bg-[#101012] px-1.5 py-0.5 text-[11px] font-semibold text-zinc-500">
        ⌘ K
      </kbd>
    </div>
  );
}
```

- [ ] **Step 2: Create `ConsoleSection`**

Create `src/components/console/ConsoleSection.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ConsoleSectionProps {
  title: string;
  meta?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ConsoleSection({
  title,
  meta,
  action,
  children,
  className,
}: ConsoleSectionProps) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded border border-white/10 bg-[#080809]',
        className
      )}
    >
      <div className="flex h-11 items-center justify-between border-b border-white/10 bg-[#070708] px-3.5">
        <div className="min-w-0">
          <span className="text-xs font-semibold text-zinc-100">{title}</span>
          {meta && (
            <span className="ml-2 text-[11px] text-zinc-600">{meta}</span>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}
```

- [ ] **Step 3: Create `ConsoleShell`**

Create `src/components/console/ConsoleShell.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  Database,
  FolderOpen,
  Grid2X2,
  LayoutDashboard,
  Link2,
  LogOut,
  Tags,
  Users,
} from 'lucide-react';

interface ConsoleShellProps {
  children: ReactNode;
  userRole: 'admin' | 'user' | 'editor';
  userEmail: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  roles: Array<'admin' | 'user' | 'editor'>;
}

const navItems: NavItem[] = [
  {
    href: '/command-center',
    label: 'Command Center',
    icon: LayoutDashboard,
    roles: ['admin', 'editor'],
  },
  {
    href: '/admin/projects',
    label: 'Projects',
    icon: FolderOpen,
    roles: ['admin', 'editor'],
  },
  {
    href: '/gallery',
    label: 'Gallery',
    icon: Grid2X2,
    roles: ['admin', 'editor', 'user'],
  },
  {
    href: '/admin/groups',
    label: 'Groups',
    icon: Tags,
    roles: ['admin'],
  },
  {
    href: '/admin/users',
    label: 'Users',
    icon: Users,
    roles: ['admin'],
  },
  {
    href: '/admin/stats',
    label: 'Stats',
    icon: BarChart3,
    roles: ['admin'],
  },
  {
    href: '/admin/projects',
    label: 'Data',
    icon: Database,
    roles: ['admin'],
  },
  {
    href: '/admin/projects',
    label: 'Share Links',
    icon: Link2,
    roles: ['admin', 'editor'],
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === '/command-center') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ConsoleShell({
  children,
  userRole,
  userEmail,
}: ConsoleShellProps) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const initials = userEmail.slice(0, 2).toUpperCase();
  const visibleNavItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  );

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-zinc-100 focus:px-3 focus:py-2 focus:text-zinc-950"
      >
        Przejdź do treści
      </a>

      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/10 bg-[#080809] lg:flex lg:flex-col">
          <div className="flex h-14 items-center gap-2.5 border-b border-white/10 px-3.5">
            <div className="grid size-6 place-items-center rounded border border-white/10 bg-[#101012] text-[10px] font-bold">
              CF
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold">
                CONCEPTFAB Pano
              </div>
              <div className="mt-0.5 text-[11px] text-zinc-600">
                v: {process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0'}
              </div>
            </div>
          </div>

          <nav className="grid gap-0.5 border-b border-white/10 p-2">
            <div className="px-2 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-600">
              Console
            </div>
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = isActivePath(pathname, item.href);
              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  className={cn(
                    'flex h-8 items-center gap-2 rounded px-2 text-xs text-zinc-400 transition-colors hover:bg-[#101012] hover:text-zinc-100',
                    isActive && 'bg-[#121214] text-zinc-100'
                  )}
                >
                  <Icon className="size-4 text-zinc-500" aria-hidden />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-white/10 p-3.5 text-[11px] leading-5 text-zinc-600">
            Production workspace
            <br />
            Flat dark console
          </div>
        </aside>

        <div className="grid min-w-0 grid-rows-[3.5rem_minmax(0,1fr)]">
          <header className="flex h-14 items-center justify-between border-b border-white/10 bg-[#060606] px-3.5 lg:px-[18px]">
            <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-600">
              <span>Workspace</span>
              <span>/</span>
              <span className="truncate font-semibold text-zinc-100">
                {pathname === '/command-center'
                  ? 'Command Center'
                  : pathname.split('/').filter(Boolean).at(-1) ?? 'Console'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLogout}
                className="hidden h-8 items-center gap-2 rounded border border-white/10 px-2.5 text-xs font-semibold text-zinc-500 hover:text-zinc-100 sm:flex"
              >
                <LogOut className="size-3.5" aria-hidden />
                Wyloguj
              </button>
              <div className="grid size-7 place-items-center rounded border border-white/10 bg-[#101012] text-[11px] font-semibold">
                {initials}
              </div>
            </div>
          </header>

          <main id="main-content" className="min-w-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Replace dashboard layout chrome**

Modify `src/app/(dashboard)/layout.tsx` to:

```tsx
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { ConsoleShell } from '@/components/console/ConsoleShell';
import { StatsReporter } from '@/components/stats/StatsReporter';

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <ConsoleShell userRole={session.role} userEmail={session.email}>
      <StatsReporter />
      {children}
    </ConsoleShell>
  );
}
```

- [ ] **Step 5: Run lint**

Run:

```bash
npm run lint
```

Expected: pass, or only pre-existing warnings unrelated to files in this task.

- [ ] **Step 6: Commit shell components**

Run:

```bash
git add src/components/console/CommandBar.tsx src/components/console/ConsoleSection.tsx src/components/console/ConsoleShell.tsx 'src/app/(dashboard)/layout.tsx'
git commit -m "feat: add flat console shell"
```

Expected: commit succeeds.

---

### Task 3: Command Center Page And Operational Components

**Files:**

- Create: `src/components/console/ProjectOperationsTable.tsx`
- Create: `src/components/console/QuickActionList.tsx`
- Create: `src/components/console/AttentionList.tsx`
- Create: `src/components/console/ActivityList.tsx`
- Create: `src/app/(dashboard)/command-center/page.tsx`

- [ ] **Step 1: Create `ProjectOperationsTable`**

Create `src/components/console/ProjectOperationsTable.tsx`:

```tsx
import Image from 'next/image';
import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import { ClientDate } from '@/components/ui/client-date';
import type { CommandCenterProjectRow } from '@/lib/command-center';
import { cn } from '@/lib/utils';

interface ProjectOperationsTableProps {
  projects: CommandCenterProjectRow[];
}

function shareLabel(shareState: CommandCenterProjectRow['shareState']) {
  if (shareState === 'active') return 'link aktywny';
  if (shareState === 'inactive') return 'link wyłączony';
  return 'bez linku';
}

export function ProjectOperationsTable({ projects }: ProjectOperationsTableProps) {
  if (projects.length === 0) {
    return (
      <div className="px-3.5 py-12 text-center text-sm text-zinc-500">
        Brak projektów. Utwórz pierwszy projekt albo zaimportuj ZIP.
      </div>
    );
  }

  return (
    <div className="min-w-0 overflow-hidden">
      <div className="hidden h-8 grid-cols-[110px_minmax(220px,1fr)_112px_88px_120px_38px] items-center gap-3 border-b border-white/[0.06] px-3.5 text-[10px] font-bold uppercase tracking-[0.06em] text-zinc-600 lg:grid">
        <div>Preview</div>
        <div>Project</div>
        <div>Status</div>
        <div>Assets</div>
        <div>Next action</div>
        <div />
      </div>

      {projects.map((project) => (
        <article
          key={project.id}
          className="grid min-h-[5.75rem] grid-cols-[92px_minmax(0,1fr)_2rem] items-center gap-3 border-b border-white/[0.06] px-3.5 py-3 last:border-b-0 hover:bg-white/[0.015] lg:grid-cols-[110px_minmax(220px,1fr)_112px_88px_120px_38px]"
        >
          <Link
            href={`/pano/${project.id}`}
            className="relative h-14 overflow-hidden rounded border border-white/10 bg-[#101012] lg:h-[58px]"
            aria-label={`Otwórz panoramę ${project.name}`}
          >
            {project.thumbnailUrl ? (
              <Image
                src={project.thumbnailUrl}
                alt=""
                fill
                sizes="110px"
                className="object-cover"
              />
            ) : (
              <div className="h-full w-full bg-[linear-gradient(110deg,#6f7a80_0%,#e6ece9_36%,#b7c0c4_58%,#5f6870_100%)]" />
            )}
          </Link>

          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <Link
                href={`/admin/projects/${project.id}`}
                className="truncate text-sm font-semibold text-zinc-100 hover:underline"
              >
                {project.name}
              </Link>
              <span
                className={cn(
                  'hidden h-[21px] items-center gap-1.5 rounded border border-white/10 bg-[#101012] px-2 text-[11px] font-semibold text-zinc-400 sm:inline-flex',
                  project.isPublished && 'text-emerald-100'
                )}
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full bg-zinc-500',
                    project.isPublished ? 'bg-emerald-400' : 'bg-amber-400'
                  )}
                />
                {project.isPublished ? 'Opublikowany' : 'Szkic'}
              </span>
            </div>
            <div className="mt-1 truncate text-xs text-zinc-400">
              {project.description || 'Brak opisu'}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-600">
              <span>
                <ClientDate value={project.updatedAt} />
              </span>
              <span>{shareLabel(project.shareState)}</span>
              {project.hasPin && <span>PIN</span>}
            </div>
          </div>

          <div className="hidden lg:block">
            <span className="inline-flex h-[22px] items-center gap-1.5 rounded border border-white/10 bg-[#101012] px-2 text-[11px] font-semibold text-zinc-400">
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  project.isPublished ? 'bg-emerald-400' : 'bg-amber-400'
                )}
              />
              {project.isPublished ? 'Published' : 'Draft'}
            </span>
          </div>

          <div className="hidden lg:block">
            <div className="text-xs font-semibold text-zinc-200">
              {project.panoramaCount} panoram
            </div>
            <div className="mt-1 text-[11px] text-zinc-600">
              {project.thumbnailUrl ? 'miniatura gotowa' : 'brak miniatury'}
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="text-xs font-semibold text-zinc-200">
              {project.nextAction}
            </div>
            <div className="mt-1 text-[11px] text-zinc-600">
              {project.isPublished ? 'workflow' : 'publikacja'}
            </div>
          </div>

          <Link
            href={`/admin/projects/${project.id}`}
            className="grid size-7 place-items-center rounded text-zinc-600 hover:bg-[#101012] hover:text-zinc-100"
            aria-label={`Więcej akcji dla ${project.name}`}
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </Link>
        </article>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create right-column list components**

Create `src/components/console/QuickActionList.tsx`:

```tsx
import Link from 'next/link';
import {
  Archive,
  FolderPlus,
  RefreshCw,
  Share2,
  Upload,
} from 'lucide-react';
import type { CommandCenterQuickAction } from '@/lib/command-center';

interface QuickActionListProps {
  actions: CommandCenterQuickAction[];
}

const icons = {
  'import-zip': Upload,
  'new-project': FolderPlus,
  'open-studio': Share2,
  'download-backup': Archive,
  'rebuild-metadata': RefreshCw,
};

export function QuickActionList({ actions }: QuickActionListProps) {
  return (
    <div className="grid gap-0.5 p-2">
      {actions.map((action) => {
        const Icon = icons[action.id as keyof typeof icons] ?? Share2;
        return (
          <Link
            key={action.id}
            href={action.href}
            className="grid min-h-11 grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2.5 rounded px-1.5 py-1.5 hover:bg-[#101012]"
          >
            <span className="grid size-7 place-items-center rounded border border-white/10 bg-[#0d0d0e] text-zinc-400">
              <Icon className="size-3.5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-zinc-100">
                {action.label}
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-zinc-600">
                {action.description}
              </span>
            </span>
            <kbd className="rounded border border-white/10 bg-[#101012] px-1.5 py-0.5 text-[11px] font-semibold text-zinc-600">
              {action.shortcut}
            </kbd>
          </Link>
        );
      })}
    </div>
  );
}
```

Create `src/components/console/AttentionList.tsx`:

```tsx
import Link from 'next/link';
import type { CommandCenterAttentionItem } from '@/lib/command-center';
import { cn } from '@/lib/utils';

interface AttentionListProps {
  items: CommandCenterAttentionItem[];
}

export function AttentionList({ items }: AttentionListProps) {
  if (items.length === 0) {
    return (
      <div className="px-3.5 py-6 text-xs text-zinc-600">
        Brak elementów wymagających uwagi.
      </div>
    );
  }

  return (
    <div className="grid gap-2 px-3.5 py-3">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="grid grid-cols-[0.5rem_minmax(0,1fr)] gap-2.5 border-b border-white/[0.06] pb-2.5 last:border-b-0 last:pb-0"
        >
          <span
            className={cn(
              'mt-1.5 size-1.5 rounded-full bg-sky-300',
              item.tone === 'warning' && 'bg-amber-400'
            )}
            aria-hidden
          />
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-zinc-100">
              {item.title}
            </span>
            <span className="mt-1 block text-[11px] leading-5 text-zinc-500">
              {item.description}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
```

Create `src/components/console/ActivityList.tsx`:

```tsx
import { ClientDate } from '@/components/ui/client-date';
import type { CommandCenterActivityItem } from '@/lib/command-center';

interface ActivityListProps {
  items: CommandCenterActivityItem[];
}

export function ActivityList({ items }: ActivityListProps) {
  if (items.length === 0) {
    return (
      <div className="px-3.5 py-6 text-xs text-zinc-600">
        Brak ostatniej aktywności.
      </div>
    );
  }

  return (
    <div className="grid px-3.5 py-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="grid grid-cols-[minmax(0,1fr)_auto] gap-2.5 border-b border-white/[0.06] py-2.5 last:border-b-0"
        >
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-zinc-100">
              {item.title}
            </div>
            <div className="mt-1 truncate text-[11px] text-zinc-600">
              {item.description}
            </div>
          </div>
          <div className="text-[11px] text-zinc-600">
            <ClientDate value={item.at} />
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create the Command Center route**

Create `src/app/(dashboard)/command-center/page.tsx`:

```tsx
import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { getProjectsWithExistingFolders } from '@/lib/db/projects';
import { getShareLinks } from '@/lib/db/share-links';
import { buildCommandCenterModel } from '@/lib/command-center';
import { CommandBar } from '@/components/console/CommandBar';
import { ConsoleSection } from '@/components/console/ConsoleSection';
import { ProjectOperationsTable } from '@/components/console/ProjectOperationsTable';
import { QuickActionList } from '@/components/console/QuickActionList';
import { AttentionList } from '@/components/console/AttentionList';
import { ActivityList } from '@/components/console/ActivityList';

export default async function CommandCenterPage() {
  const session = await getSession();
  if (!session) return null;

  const [projects, shareLinks] = await Promise.all([
    getProjectsWithExistingFolders(),
    getShareLinks(),
  ]);
  const model = buildCommandCenterModel({ projects, shareLinks });

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#050505]">
      <div className="border-b border-white/10 px-3.5 py-4 lg:px-[18px]">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,32.5rem)] lg:items-center">
          <div className="min-w-0">
            <div className="flex items-baseline gap-3">
              <h1 className="text-xl font-semibold tracking-normal text-zinc-100">
                Command Center
              </h1>
              <span className="hidden text-xs text-zinc-600 sm:inline">
                Panoramy, publikacje, linki i operacje projektów.
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-600">
              <span>{model.summary.totalProjects} projektów</span>
              <span>{model.summary.totalPanoramas} panoram</span>
              <span>{model.summary.activeShareLinks} aktywnych linków</span>
            </div>
          </div>
          <CommandBar />
        </div>
      </div>

      <div className="grid min-h-0 grid-cols-1 border-b border-white/10 lg:grid-cols-[minmax(0,1fr)_348px]">
        <div className="min-w-0 border-white/10 lg:border-r">
          <ConsoleSection
            title="Recent Projects"
            meta={`${model.summary.publishedProjects} published · ${model.summary.draftProjects} drafts`}
            action={
              <Link
                href="/admin/projects"
                className="text-xs text-zinc-500 hover:text-zinc-100"
              >
                View all →
              </Link>
            }
            className="rounded-none border-0 border-b border-white/10 bg-transparent"
          >
            <ProjectOperationsTable projects={model.projects} />
          </ConsoleSection>
        </div>

        <aside className="grid min-w-0 grid-rows-[auto_auto_minmax(0,1fr)]">
          <ConsoleSection
            title="Actions"
            meta="⌘ K"
            className="rounded-none border-0 border-b border-white/10 bg-transparent"
          >
            <QuickActionList actions={model.quickActions} />
          </ConsoleSection>

          <ConsoleSection
            title="Needs Attention"
            meta={String(model.attentionItems.length)}
            className="rounded-none border-0 border-b border-white/10 bg-transparent"
          >
            <AttentionList items={model.attentionItems} />
          </ConsoleSection>

          <ConsoleSection
            title="Activity"
            meta="latest"
            className="rounded-none border-0 bg-transparent"
          >
            <ActivityList items={model.activityItems} />
          </ConsoleSection>
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run TypeScript and lint**

Run:

```bash
npm run lint
npx tsc --noEmit
```

Expected: lint passes. TypeScript should pass, unless the repo has pre-existing unrelated errors; if pre-existing errors appear, record them and verify no new errors point to files changed in this task.

- [ ] **Step 5: Commit Command Center page**

Run:

```bash
git add src/components/console/ProjectOperationsTable.tsx src/components/console/QuickActionList.tsx src/components/console/AttentionList.tsx src/components/console/ActivityList.tsx 'src/app/(dashboard)/command-center/page.tsx'
git commit -m "feat: add command center page"
```

Expected: commit succeeds.

---

### Task 4: Redirects And Navigation Defaults

**Files:**

- Modify: `src/app/page.tsx`
- Modify: `src/app/(dashboard)/admin/page.tsx`

- [ ] **Step 1: Update home redirect**

Modify `src/app/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Panorama Platform',
  description: 'Panorama project dashboard',
};

export default async function Home() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  if (session.role === 'admin' || session.role === 'editor') {
    redirect('/command-center');
  }

  redirect('/gallery');
}
```

- [ ] **Step 2: Update `/admin` redirect**

Modify `src/app/(dashboard)/admin/page.tsx`:

```tsx
import { redirect } from 'next/navigation';

export default function AdminPage() {
  redirect('/command-center');
}
```

- [ ] **Step 3: Run smoke checks**

Run:

```bash
npm run lint
npm test -- tests/command-center.test.ts
```

Expected: lint passes and the command-center test passes.

- [ ] **Step 4: Commit redirects**

Run:

```bash
git add src/app/page.tsx 'src/app/(dashboard)/admin/page.tsx'
git commit -m "feat: route users to command center"
```

Expected: commit succeeds.

---

### Task 5: Browser Verification And Visual Pass

**Files:**

- Modify only files from Tasks 2-4 if visual fixes are needed.

- [ ] **Step 1: Start the dev server**

Run:

```bash
npm run dev
```

Expected: Next.js reports a local URL such as `http://localhost:3000`.

- [ ] **Step 2: Open `/command-center` in the browser**

Use the in-app browser or a normal browser at:

```text
http://localhost:3000/command-center
```

Expected:

- The page uses the flat dark console shell.
- There is no old top `DashboardNav`.
- Command Center header is compact, not hero-like.
- The command bar is visible.
- Recent Projects render from real project data.
- Actions, Needs Attention, and Activity render in the right column on desktop.

- [ ] **Step 3: Verify responsive layout**

Check a mobile-width viewport around 390px.

Expected:

- Sidebar is hidden.
- Topbar remains usable.
- Command bar fits width.
- Project rows do not overflow horizontally.
- Right-column sections stack below the project list.

- [ ] **Step 4: Verify existing routes still render**

Open:

```text
http://localhost:3000/gallery
http://localhost:3000/admin/projects
http://localhost:3000/admin/users
```

Expected:

- Routes render inside the new shell.
- Existing page content may still have old internal cards; this is acceptable for phase 1-2.
- Viewer and hotspot editor are not redesigned by this plan.

- [ ] **Step 5: Fix visual regressions within phase scope**

If the verification finds text overflow or unusable spacing in files created by this plan, patch only the relevant console component. Example acceptable fix:

```tsx
className="min-w-0 truncate"
```

Do not redesign `ProjectEditForm`, `HotspotEditor`, or `PanoViewer` during this task.

- [ ] **Step 6: Run final verification**

Run:

```bash
npm run lint
npm test -- tests/command-center.test.ts
```

Expected: both commands pass.

- [ ] **Step 7: Commit visual fixes**

If changes were made in this task, run:

```bash
git add src/components/console 'src/app/(dashboard)/command-center/page.tsx'
git commit -m "fix: polish command center layout"
```

Expected: commit succeeds. If no changes were needed, do not create an empty commit.

---

## Final Verification

Run after all tasks:

```bash
npm run lint
npm test
```

Expected:

- Lint passes.
- Vitest suite passes.

Also verify manually:

- `/` redirects admins and editors to `/command-center`.
- `/command-center` displays real project data.
- `/gallery` still opens for regular users.
- `/pano/<projectId>` remains full-screen viewer behavior.
- `/admin/projects/<id>/editor` still opens the existing hotspot editor.

## Out Of Scope For This Plan

- Reworking `ProjectEditForm` into tabs.
- Reworking `HotspotEditor` into Studio Mode.
- Reworking `PanoViewer` loading/error states.
- Implementing a real interactive command palette.
- Replacing admin project internals with the new table language.
- Adding backend schema or migration changes.
