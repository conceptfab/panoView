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
