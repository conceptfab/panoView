import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getShareLinkByToken } from '@/lib/db/share-links';
import { getProjectById } from '@/lib/db/projects';
import { verifyShareUnlockToken } from '@/lib/auth/share-unlock';
import { appendEvent, getDateString } from '@/lib/db/stats';
import type { StatsEvent } from '@/types/stats';

interface RouteParams {
  params: Promise<{ token: string }>;
}

const payloadSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('view_start'),
    projectId: z.string(),
    projectName: z.string().optional(),
  }),
  z.object({
    type: z.literal('view_end'),
    projectId: z.string(),
    durationSeconds: z.number(),
  }),
  z.object({
    type: z.literal('screenshot'),
    projectId: z.string(),
    projectName: z.string().optional(),
  }),
]);

const bodySchema = z.object({
  type: z.enum(['view_start', 'view_end', 'screenshot']),
  payload: payloadSchema,
});

function toEvent(payload: z.infer<typeof payloadSchema>): StatsEvent {
  const at = new Date().toISOString();
  switch (payload.type) {
    case 'view_start':
      return {
        type: 'view_start',
        at,
        projectId: payload.projectId,
        projectName: payload.projectName,
      };
    case 'view_end':
      return {
        type: 'view_end',
        at,
        projectId: payload.projectId,
        durationSeconds: payload.durationSeconds,
      };
    case 'screenshot':
      return {
        type: 'screenshot',
        at,
        projectId: payload.projectId,
        projectName: payload.projectName,
      };
  }
}

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

    if (link.pinHash !== null) {
      const cookieStore = await cookies();
      const c = cookieStore.get(`pano-share-${token}`);
      if (!c || !(await verifyShareUnlockToken(c.value, token))) {
        return NextResponse.json({ error: 'Locked' }, { status: 401 });
      }
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    if (parsed.data.payload.projectId !== link.projectId) {
      return NextResponse.json({ error: 'Project mismatch' }, { status: 400 });
    }

    await appendEvent('share', getDateString(), toEvent(parsed.data.payload));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Share stats error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
