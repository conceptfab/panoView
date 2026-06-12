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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Przejdź do treści
      </a>
      <StatsReporter />
      <DashboardNav userRole={session.role} userEmail={session.email} />
      <main id="main-content" className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
