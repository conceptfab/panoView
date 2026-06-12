import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { editorCanEditProject } from '@/lib/auth/session';
import { getProjectById, getProjectConfig } from '@/lib/db/projects';
import { getUserById } from '@/lib/db/users';
import { HotspotEditor } from '@/components/editor/HotspotEditor';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function HotspotEditorPage({ params }: PageProps) {
  const session = await getSession();
  if (!session || (session.role !== 'admin' && session.role !== 'editor')) {
    redirect('/');
  }

  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) {
    notFound();
  }

  if (session.role === 'editor') {
    const user = await getUserById(session.userId);
    if (!user || !editorCanEditProject(project.groupIds, user.groupIds)) {
      redirect('/admin/projects');
    }
  }

  const config = await getProjectConfig(id);
  if (!config) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">
          Nie znaleziono konfiguracji projektu
        </p>
      </div>
    );
  }

  if (config.panoramas.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">
          Dodaj panoramy do projektu przed edycją hotspotów
        </p>
      </div>
    );
  }

  return (
    <HotspotEditor
      projectId={id}
      projectName={project.name}
      initialConfig={config}
    />
  );
}
