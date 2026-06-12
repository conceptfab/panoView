import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { DataFileExplorer } from '@/components/admin/DataFileExplorer';

export default async function AdminFilesPage() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    redirect('/');
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extralight">Pliki</h1>
        <p className="text-muted-foreground mt-1">
          Menedżer plików – edycja i praca na plikach danych aplikacji
        </p>
      </div>

      <div className="border rounded-lg p-4 bg-card">
        <DataFileExplorer />
      </div>
    </div>
  );
}
