import { NextRequest, NextResponse } from 'next/server';
import {
  requireAdminOrEditor,
  editorCanEditProject,
} from '@/lib/auth/session';
import { getProjectById } from '@/lib/db/projects';
import { getUserById } from '@/lib/db/users';
import {
  getShareLinkByProject,
  setShareActive,
  setSharePin,
} from '@/lib/db/share-links';
import { buildShareUrl } from '@/lib/share-url';
import { Project, ShareLink } from '@/types';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

type AuthResult =
  | { ok: false; response: NextResponse }
  | { ok: true; project: Project };

async function authorize(id: string): Promise<AuthResult> {
  const [session, project] = await Promise.all([
    requireAdminOrEditor(),
    getProjectById(id),
  ]);
  if (!project) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      ),
    };
  }
  if (session.role === 'editor') {
    const user = await getUserById(session.userId);
    if (!user || !editorCanEditProject(project.groupIds, user.groupIds)) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Access denied' }, { status: 403 }),
      };
    }
  }
  return { ok: true, project };
}

function buildResponse(request: NextRequest, link: ShareLink | null) {
  if (!link) return { isActive: false, hasPin: false, url: null };
  return {
    isActive: link.isActive,
    hasPin: link.pinHash !== null,
    url: buildShareUrl(request.nextUrl.origin, link.token),
  };
}

function handleErr(error: unknown) {
  if (error instanceof Error && error.message.includes('Forbidden')) {
    return NextResponse.json(
      { error: 'Wymagane uprawnienia admin lub edytor' },
      { status: 403 }
    );
  }
  if (error instanceof Error && error.message === 'Unauthorized') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  console.error('Share API error:', error);
  return NextResponse.json({ error: 'Failed' }, { status: 500 });
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const auth = await authorize(id);
    if (!auth.ok) return auth.response;
    const link = await getShareLinkByProject(id);
    return NextResponse.json(buildResponse(request, link));
  } catch (error) {
    return handleErr(error);
  }
}

const putSchema = z.object({
  isActive: z.boolean().optional(),
  pin: z.string().min(1).max(64).nullable().optional(),
});

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const auth = await authorize(id);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const updates = putSchema.parse(body);

    if (updates.pin !== undefined) {
      await setSharePin(id, updates.pin);
    }
    if (updates.isActive !== undefined) {
      await setShareActive(id, updates.isActive);
    }

    const link = await getShareLinkByProject(id);
    return NextResponse.json(buildResponse(request, link));
  } catch (error) {
    return handleErr(error);
  }
}
