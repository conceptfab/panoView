import { NextRequest, NextResponse } from 'next/server';
import { getSession, requireAdminOrEditor } from '@/lib/auth/session';
import {
  getProjects,
  getProjectsForUser,
  getProjectsByGroupId,
  createProject,
} from '@/lib/db/projects';
import { getUserById } from '@/lib/db/users';
import { z } from 'zod';

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).default(''),
  groupIds: z.array(z.string()).default([]),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const published = searchParams.get('published');

    // Admin can see all projects
    if (session.role === 'admin') {
      let projects = await getProjects();

      if (groupId) {
        projects = await getProjectsByGroupId(groupId);
      }

      if (published === 'true') {
        projects = projects.filter((p) => p.isPublished);
      }

      return NextResponse.json({ projects });
    }

    const user = await getUserById(session.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Edytor widzi projekty ze swoich grup (wszystkie, nie tylko opublikowane)
    if (session.role === 'editor') {
      const allProjects = await getProjects();
      const projects = allProjects.filter((p) =>
        p.groupIds.some((gid) => user.groupIds.includes(gid))
      );
      return NextResponse.json({ projects });
    }

    // Zwykły użytkownik – tylko opublikowane projekty ze swoich grup
    const projects = await getProjectsForUser(user.groupIds);
    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Get projects error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminOrEditor();

    const body = await request.json();
    const parsed = createProjectSchema.parse(body);
    const { name, description } = parsed;
    let groupIds = parsed.groupIds;

    if (session.role === 'editor') {
      const user = await getUserById(session.userId);
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      if (groupIds.length === 0) {
        groupIds = user.groupIds;
      }
      const allowed = groupIds.every((gid) => user.groupIds.includes(gid));
      if (!allowed || groupIds.length === 0) {
        return NextResponse.json(
          {
            error:
              'Projekt musi być przypisany do co najmniej jednej z Twoich grup',
          },
          { status: 403 }
        );
      }
    }

    const project = await createProject(
      name,
      description,
      session.userId,
      groupIds
    );

    return NextResponse.json({ project }, { status: 201 });
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
    console.error('Create project error:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
