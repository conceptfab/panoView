import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  requireAdminOrEditor,
  editorCanEditProject,
} from '@/lib/auth/session';
import { getProjectById, cloneProject } from '@/lib/db/projects';
import { getUserById } from '@/lib/db/users';

const cloneProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const [{ id }, session] = await Promise.all([
      params,
      requireAdminOrEditor(),
    ]);

    const project = await getProjectById(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (session.role === 'editor') {
      const user = await getUserById(session.userId);
      if (!user || !editorCanEditProject(project.groupIds, user.groupIds)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const payload = await request.json().catch(() => ({}));
    const parsed = cloneProjectSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Niepoprawne dane' },
        { status: 400 }
      );
    }

    const cloned = await cloneProject(id, {
      name: parsed.data.name,
      description: parsed.data.description,
      createdBy: session.userId,
      groupIds: project.groupIds,
    });

    return NextResponse.json({
      project: cloned,
      message: `Projekt „${project.name}” został sklonowany jako „${cloned.name}”.`,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Wymagane uprawnienia admin lub edytor' },
        { status: 403 }
      );
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (error instanceof Error && error.message === 'Config not found') {
      return NextResponse.json(
        { error: 'Konfiguracja projektu nie została znaleziona' },
        { status: 500 }
      );
    }
    if (error instanceof Error && error.message === 'Project name cannot be empty') {
      return NextResponse.json(
        { error: 'Nazwa projektu nie może być pusta' },
        { status: 400 }
      );
    }
    console.error('Clone project error:', error);
    return NextResponse.json(
      { error: 'Nie udało się sklonować projektu' },
      { status: 500 }
    );
  }
}
