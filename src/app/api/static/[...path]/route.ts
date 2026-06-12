import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { serveUploadsAsset } from '@/lib/storage/serve';

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    // Autoryzacja - tylko zalogowani użytkownicy
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { path: pathSegments } = await params;
    return await serveUploadsAsset(pathSegments);
  } catch (error) {
    console.error('Static file error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
