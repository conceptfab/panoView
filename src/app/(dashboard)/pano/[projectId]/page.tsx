import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getProjectById, getProjectConfig } from '@/lib/db/projects';
import { getUserById } from '@/lib/db/users';
import { PanoViewer } from '@/components/viewer/PanoViewer';

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function PanoPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) {
    notFound();
  }

  const { projectId } = await params;

  // ZOPTYMALIZOWANE: równoległe pobieranie projektu i użytkownika
  const [project, user] = await Promise.all([
    getProjectById(projectId),
    session.role !== 'admin' ? getUserById(session.userId) : Promise.resolve(null),
  ]);

  if (!project) {
    notFound();
  }

  // Sprawdź dostęp PRZED pobraniem konfiguracji
  if (session.role !== 'admin') {
    if (!user) notFound();

    const hasAccess =
      project.isPublished &&
      project.groupIds.some((gid) => user.groupIds.includes(gid));

    if (!hasAccess) {
      notFound();
    }
  }

  // Pobierz config tylko po weryfikacji dostępu
  const config = await getProjectConfig(projectId);
  if (!config || config.panoramas.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-muted-foreground">
            Ten projekt nie ma jeszcze panoram
          </p>
        </div>
      </div>
    );
  }

  const basePath = `/uploads/projects/${projectId}`;
  const isAdmin = session.role === 'admin';

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 -m-[inherit]">
      <PanoViewer
        config={config}
        basePath={basePath}
        isAdmin={isAdmin}
        projectId={projectId}
      />
    </div>
  );
}
