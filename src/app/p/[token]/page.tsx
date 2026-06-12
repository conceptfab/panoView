import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { getShareLinkByToken } from '@/lib/db/share-links';
import { getProjectById, getProjectConfig } from '@/lib/db/projects';
import { verifyShareUnlockToken } from '@/lib/auth/share-unlock';
import { buildShareAssetBasePath } from '@/lib/share-assets';
import { PanoViewer } from '@/components/viewer/PanoViewer';
import { SharePinGate } from '@/components/viewer/SharePinGate';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shared Panorama',
  description: 'Public panorama presentation',
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PresentationPage({ params }: PageProps) {
  const { token } = await params;

  const link = await getShareLinkByToken(token);
  if (!link || !link.isActive) notFound();

  const project = await getProjectById(link.projectId);
  if (!project || !project.isPublished) notFound();

  if (link.pinHash !== null) {
    const cookieStore = await cookies();
    const c = cookieStore.get(`pano-share-${token}`);
    const unlocked = c ? await verifyShareUnlockToken(c.value, token) : false;
    if (!unlocked) {
      return <SharePinGate token={token} projectName={project.name} />;
    }
  }

  const config = await getProjectConfig(link.projectId);
  if (!config || config.panoramas.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <p className="text-white/60">Ten projekt nie ma jeszcze panoram</p>
      </div>
    );
  }

  const basePath = buildShareAssetBasePath(token);

  return (
    <div className="fixed inset-0 z-50 bg-gray-950">
      <PanoViewer
        config={config}
        basePath={basePath}
        isAdmin={false}
        projectId={link.projectId}
        publicMode
        shareToken={token}
      />
    </div>
  );
}
