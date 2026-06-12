import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { editorCanEditProject } from '@/lib/auth/session';
import {
  getProjectById,
  getProjectConfig,
  getProjectSize,
} from '@/lib/db/projects';
import { getGroups } from '@/lib/db/groups';
import { getUserById } from '@/lib/db/users';
import { ProjectEditForm } from '@/components/admin/ProjectEditForm';
import { FileUploader } from '@/components/admin/FileUploader';
import { PanoramaList } from '@/components/editor/PanoramaList';
import { ProjectDownloadCard } from '@/components/admin/ProjectDownloadCard';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectEditPage({ params }: PageProps) {
  const session = await getSession();
  if (!session || (session.role !== 'admin' && session.role !== 'editor')) {
    redirect('/');
  }

  const { id } = await params;
  const [project, config, groups, size] = await Promise.all([
    getProjectById(id),
    getProjectConfig(id),
    getGroups(),
    getProjectSize(id),
  ]);

  if (!project) {
    notFound();
  }

  let editorGroupIds: string[] | undefined;
  if (session.role === 'editor') {
    const user = await getUserById(session.userId);
    if (!user || !editorCanEditProject(project.groupIds, user.groupIds)) {
      redirect('/admin/projects');
    }
    editorGroupIds = user.groupIds;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <ProjectEditForm
        project={project}
        groups={groups}
        initialOptimizePanoramaForScreen={
          config?.settings.optimizePanoramaForScreen ?? true
        }
        editorGroupIds={editorGroupIds}
        groupsReadOnly={session.role === 'editor'}
      />

      <FileUploader projectId={id} />

      {config && config.panoramas.length > 0 && (
        <PanoramaList projectId={id} panoramas={config.panoramas} />
      )}

      {session.role === 'admin' && (
        <ProjectDownloadCard project={project} size={size} />
      )}
    </div>
  );
}
