import { NextRequest, NextResponse } from 'next/server';
import {
  getSession,
  requireAdminOrEditor,
  editorCanEditProject,
} from '@/lib/auth/session';
import {
  getProjectById,
  getProjectConfig,
  updateProject,
  updateProjectConfig,
  deleteProject,
  renameProjectAndId,
} from '@/lib/db/projects';
import { getUserById } from '@/lib/db/users';
import { ensurePanoramaVariantsForProject } from '@/lib/panorama-variants-server';
import { z } from 'zod';

const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  groupIds: z.array(z.string()).optional(),
  isPublished: z.boolean().optional(),
  optimizePanoramaForScreen: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await getProjectById(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (session.role !== 'admin' && session.role !== 'editor') {
      const user = await getUserById(session.userId);
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      const hasAccess =
        project.isPublished &&
        project.groupIds.some((gid) => user.groupIds.includes(gid));
      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    } else if (session.role === 'editor') {
      const user = await getUserById(session.userId);
      if (!user || !editorCanEditProject(project.groupIds, user.groupIds)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Get project error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const [{ id }, session] = await Promise.all([
      params,
      requireAdminOrEditor(),
    ]);

    const body = await request.json();
    const updates = updateProjectSchema.parse(body);
    const { optimizePanoramaForScreen, ...projectUpdates } = updates;

    const project = await getProjectById(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (session.role === 'editor') {
      const user = await getUserById(session.userId);
      if (!user || !editorCanEditProject(project.groupIds, user.groupIds)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      if (updates.groupIds !== undefined) {
        const allowed = updates.groupIds.every((gid) =>
          user.groupIds.includes(gid)
        );
        if (!allowed || updates.groupIds.length === 0) {
          return NextResponse.json(
            { error: 'Projekt musi być w co najmniej jednej z Twoich grup' },
            { status: 403 }
          );
        }
      }
    }

    const updated = await updateProject(id, projectUpdates);
    if (!updated) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const configNeedsUpdate =
      updates.name !== undefined ||
      updates.description !== undefined ||
      optimizePanoramaForScreen !== undefined;

    if (configNeedsUpdate) {
      const config = await getProjectConfig(id);
      if (!config) {
        return NextResponse.json({ error: 'Config not found' }, { status: 404 });
      }

      if (updates.name !== undefined) {
        config.projectName = updates.name;
      }
      if (updates.description !== undefined) {
        config.description = updates.description;
      }

      if (optimizePanoramaForScreen !== undefined) {
        config.settings.optimizePanoramaForScreen = optimizePanoramaForScreen;
        if (optimizePanoramaForScreen) {
          await ensurePanoramaVariantsForProject(id, config);
        }
      }

      const saved = await updateProjectConfig(id, config);
      if (!saved) {
        return NextResponse.json(
          { error: 'Failed to update config' },
          { status: 500 }
        );
      }
    }

    let finalProject = updated;
    if (updates.name !== undefined && updates.name !== project.name) {
      const renamed = await renameProjectAndId(id, updates.name, updates.description ?? project.description);
      if (renamed) {
        finalProject = renamed;
      }
    }

    return NextResponse.json({ project: finalProject });
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
    console.error('Update project error:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    const success = await deleteProject(id);
    if (!success) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
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
    console.error('Delete project error:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
