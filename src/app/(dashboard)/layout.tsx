import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { DashboardNav } from '@/components/admin/DashboardNav';
import { StatsReporter } from '@/components/stats/StatsReporter';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <StatsReporter />
      <DashboardNav userRole={session.role} userEmail={session.email} />
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
