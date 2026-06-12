import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { StatsPanel } from '@/components/admin/StatsPanel';

export default async function AdminStatsPage() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    redirect('/');
  }

  return <StatsPanel />;
}
