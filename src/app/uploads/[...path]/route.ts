import { NextRequest, NextResponse } from 'next/server';
import { serveUploadsAsset } from '@/lib/storage/serve';

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { path: pathSegments } = await params;
    return await serveUploadsAsset(pathSegments);
  } catch (error) {
    console.error('File serve error:', error);
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 });
  }
}
