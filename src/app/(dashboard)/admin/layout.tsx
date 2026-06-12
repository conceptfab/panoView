import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { Button } from '@/components/ui/button';
import { ShieldX } from 'lucide-react';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  if (session.role !== 'admin' && session.role !== 'editor') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <ShieldX className="size-16 text-amber-500 mb-4" />
        <h1 className="text-2xl font-semibold text-center mb-2">Brak uprawnień</h1>
        <p className="text-muted-foreground text-center mb-6 max-w-md">
          Ten panel jest dostępny tylko dla administratorów i edytorów.
        </p>
        <Button asChild>
          <Link href="/gallery">Przejdź do galerii</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
