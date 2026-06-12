import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getShareLinkByToken } from '@/lib/db/share-links';
import { getProjectById } from '@/lib/db/projects';
import { verifyPin } from '@/lib/auth/share-pin';
import { createShareUnlockToken } from '@/lib/auth/share-unlock';

interface RouteParams {
  params: Promise<{ token: string }>;
}

const bodySchema = z.object({ pin: z.string().min(1).max(64) });

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;

    const link = await getShareLinkByToken(token);
    if (!link || !link.isActive) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const project = await getProjectById(link.projectId);
    if (!project || !project.isPublished) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (link.pinHash === null) {
      return NextResponse.json({ ok: true });
    }

    const { pin } = bodySchema.parse(await request.json());
    if (!verifyPin(pin, link.pinHash)) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
    }

    const cookieValue = await createShareUnlockToken(token);
    const cookieStore = await cookies();
    cookieStore.set(`pano-share-${token}`, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 12,
      path: '/',
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Unlock error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
