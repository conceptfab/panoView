import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { appendEvent, getDateString } from '@/lib/db/stats';
import type { StatsEvent, SystemInfo } from '@/types/stats';

const systemInfoSchema = z.object({
  userAgent: z.string(),
  language: z.string(),
  languages: z.array(z.string()).optional(),
  platform: z.string(),
  screenWidth: z.number(),
  screenHeight: z.number(),
  windowWidth: z.number(),
  windowHeight: z.number(),
  devicePixelRatio: z.number().optional(),
  timezone: z.string().optional(),
});

const payloadSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('login'),
    system: systemInfoSchema,
  }),
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
  type: z.enum(['login', 'view_start', 'view_end', 'screenshot']),
  payload: payloadSchema,
});

function toEvent(payload: z.infer<typeof payloadSchema>): StatsEvent {
  const at = new Date().toISOString();
  switch (payload.type) {
    case 'login':
      return { type: 'login', at, system: payload.system as SystemInfo };
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
    default:
      throw new Error('Unknown event type');
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const event = toEvent(parsed.data.payload);
    const dateStr = getDateString();
    await appendEvent(session.userId, dateStr, event);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Stats POST error:', error);
    return NextResponse.json(
      { error: 'Failed to record stats' },
      { status: 500 }
    );
  }
}
