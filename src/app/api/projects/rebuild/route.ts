import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { rebuildProjects } from '@/lib/db/projects';

export async function POST() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await rebuildProjects();
    return NextResponse.json({
      success: true,
      ...result,
      message: `Przebudowano: ${result.projects.length} projektów (zaktualizowano: ${result.updated}, dodano: ${result.added}, usunięto stare wpisy: ${result.removed}).`,
    });
  } catch (error) {
    console.error('Rebuild projects error:', error);
    return NextResponse.json(
      { error: 'Nie udało się przebudować listy projektów' },
      { status: 500 }
    );
  }
}
