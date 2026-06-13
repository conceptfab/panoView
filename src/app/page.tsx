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
