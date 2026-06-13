import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getProjectsWithExistingFolders } from '@/lib/db/projects';
import { getShareLinks } from '@/lib/db/share-links';
import { getUserById } from '@/lib/db/users';
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
  if (session.role !== 'admin' && session.role !== 'editor') {
    redirect('/gallery');
  }

  const [projects, shareLinks] = await Promise.all([
    getProjectsWithExistingFolders(),
    getShareLinks(),
  ]);
  const editorUser =
    session.role === 'editor' ? await getUserById(session.userId) : null;
  const scopedProjects =
    session.role === 'editor'
      ? editorUser
        ? projects.filter((project) =>
            project.groupIds.some((groupId) =>
              editorUser.groupIds.includes(groupId)
            )
          )
        : []
      : projects;
  const scopedProjectIds = new Set(scopedProjects.map((project) => project.id));
  const scopedShareLinks = shareLinks.filter((link) =>
    scopedProjectIds.has(link.projectId)
  );
  const model = buildCommandCenterModel({
    projects: scopedProjects,
    shareLinks: scopedShareLinks,
  });

  const counters = [
    ['Projects', model.summary.totalProjects],
    ['Published', model.summary.publishedProjects],
    ['Drafts', model.summary.draftProjects],
    ['Panoramas', model.summary.totalPanoramas],
    ['Active links', model.summary.activeShareLinks],
    ['PIN links', model.summary.pinProtectedShareLinks],
  ] as const;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#050505]">
      <div className="border-b border-white/10">
        <div className="flex flex-col gap-4 px-3.5 py-4 lg:px-[18px]">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-end">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-normal text-zinc-100">
                Command Center
              </h1>
              <p className="mt-1 text-xs text-zinc-500">
                Panoramy, publikacje, linki i operacje projektów.
              </p>
            </div>
            <CommandBar />
          </div>

          <div className="grid gap-px overflow-hidden rounded border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {counters.map(([label, value]) => (
              <div key={label} className="bg-[#080809] px-3.5 py-2.5">
                <div className="text-[11px] uppercase tracking-normal text-zinc-500">
                  {label}
                </div>
                <div className="mt-1 text-lg font-semibold text-zinc-100">
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid min-h-0 grid-cols-1 border-b border-white/10 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ConsoleSection
          title="Recent Projects"
          meta={`${model.projects.length} projektów`}
          action={
            <Link
              href="/admin/projects"
              className="text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-100"
            >
              View all →
            </Link>
          }
          className="min-w-0 rounded-none border-0 border-b border-white/10 bg-transparent xl:border-b-0 xl:border-r"
        >
          <ProjectOperationsTable projects={model.projects} />
        </ConsoleSection>

        <div className="grid self-start">
          <ConsoleSection
            title="Actions"
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
        </div>
      </div>
    </div>
  );
}
