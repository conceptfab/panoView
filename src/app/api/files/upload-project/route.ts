// oxlint-disable react-doctor/server-hoist-static-io react-doctor/async-parallel react-doctor/async-await-in-loop
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import extract from 'extract-zip';
import { requireAdminOrEditor } from '@/lib/auth/session';
import { createProject, updateProjectConfig } from '@/lib/db/projects';
import { getUserById } from '@/lib/db/users';
import { getDataRoot } from '@/lib/data-root';
import { projectConfigSchema } from '@/utils/validation';
import { ensureDir } from '@/lib/db/json-store';
import type { ProjectConfig } from '@/types';

/**
 * W configu po imporcie: ustawia nową nazwę/opis i zamienia ścieżki projektu na nowy katalog.
 */
function configForImportedProject(
  config: ProjectConfig,
  newProjectId: string,
  newProjectName: string,
  newDescription: string
): ProjectConfig {
  const pathRegex = /(\/?)uploads\/projects\/[^/"\s]+/g;
  const replacePath = (s: string) =>
    s.replace(
      pathRegex,
      (_, leading) => (leading || '') + 'uploads/projects/' + newProjectId
    );

  function replaceStrings(obj: unknown): unknown {
    if (typeof obj === 'string') return replacePath(obj);
    if (Array.isArray(obj)) return obj.map(replaceStrings);
    if (obj !== null && typeof obj === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) out[k] = replaceStrings(v);
      return out;
    }
    return obj;
  }

  const withPaths = replaceStrings(config) as ProjectConfig;
  return {
    ...withPaths,
    projectName: newProjectName,
    description: newDescription,
  };
}

export async function POST(request: NextRequest) {
  let tempDir: string | null = null;

  try {
    const session = await requireAdminOrEditor();
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'Wybierz plik ZIP z gotowym projektem' },
        { status: 400 }
      );
    }

    const name = file.name.toLowerCase();
    if (!name.endsWith('.zip')) {
      return NextResponse.json(
        { error: 'Dozwolony format: plik .zip' },
        { status: 400 }
      );
    }

    tempDir = path.join(os.tmpdir(), `pano-import-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    const zipPath = path.join(tempDir, 'upload.zip');
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(zipPath, buffer);

    await extract(zipPath, { dir: tempDir });
    await fs.unlink(zipPath);

    const configPath = path.join(tempDir, 'config.json');
    try {
      await fs.access(configPath);
    } catch {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      return NextResponse.json(
        { error: 'W archiwum brakuje pliku config.json w głównym katalogu' },
        { status: 400 }
      );
    }

    const configContent = await fs.readFile(configPath, 'utf-8');
    let config: unknown;
    try {
      config = JSON.parse(configContent);
    } catch {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      return NextResponse.json(
        { error: 'Nieprawidłowy format config.json' },
        { status: 400 }
      );
    }

    const validated = projectConfigSchema.safeParse(config);
    if (!validated.success) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      return NextResponse.json(
        { error: 'Nieprawidłowa struktura projektu w config.json' },
        { status: 400 }
      );
    }

    const projectConfig = validated.data;
    const createdBy = session.userId;

    let groupIds: string[] = [];
    if (session.role === 'editor') {
      const user = await getUserById(session.userId);
      if (!user || user.groupIds.length === 0) {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        return NextResponse.json(
          { error: 'Edytor musi być przypisany do co najmniej jednej grupy' },
          { status: 403 }
        );
      }
      groupIds = user.groupIds;
    }

    const importName = (formData.get('name') as string | null)?.trim();
    const projectName = importName || projectConfig.projectName;
    const projectDescription =
      (formData.get('description') as string | null)?.trim() ??
      projectConfig.description;

    const project = await createProject(
      projectName,
      projectDescription,
      createdBy,
      groupIds
    );

    const root = getDataRoot();
    const projectDir = path.join(root, 'uploads', 'projects', project.id);
    const panoramasSrc = path.join(tempDir, 'panoramas');
    const thumbnailsSrc = path.join(tempDir, 'thumbnails');
    const panoramasDst = path.join(projectDir, 'panoramas');
    const thumbnailsDst = path.join(projectDir, 'thumbnails');

    if (await exists(panoramasSrc)) {
      await ensureDir(panoramasDst);
      const files = await fs.readdir(panoramasSrc);
      for (const f of files) {
        const src = path.join(panoramasSrc, f);
        const stat = await fs.stat(src);
        if (stat.isFile()) {
          await fs.copyFile(src, path.join(panoramasDst, f));
        }
      }
    }

    if (await exists(thumbnailsSrc)) {
      await ensureDir(thumbnailsDst);
      const files = await fs.readdir(thumbnailsSrc);
      for (const f of files) {
        const src = path.join(thumbnailsSrc, f);
        const stat = await fs.stat(src);
        if (stat.isFile()) {
          await fs.copyFile(src, path.join(thumbnailsDst, f));
        }
      }
    }

    const updatedConfig = configForImportedProject(
      projectConfig,
      project.id,
      project.name,
      project.description
    );
    await updateProjectConfig(project.id, updatedConfig);

    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        panoramaCount: projectConfig.panoramas.length,
      },
    });
  } catch (error) {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Wymagane uprawnienia admin lub edytor' },
        { status: 403 }
      );
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Upload project error:', error);
    return NextResponse.json(
      { error: 'Nie udało się zaimportować projektu' },
      { status: 500 }
    );
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
