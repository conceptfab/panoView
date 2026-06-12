// oxlint-disable react-doctor/server-hoist-static-io react-doctor/async-parallel react-doctor/async-await-in-loop
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import extract from 'extract-zip';
import { del } from '@vercel/blob';
import { requireAdminOrEditor } from '@/lib/auth/session';
import { createProject, updateProjectConfig } from '@/lib/db/projects';
import { getUserById } from '@/lib/db/users';
import { projectConfigSchema } from '@/utils/validation';
import {
  panoramaKey,
  thumbnailKey,
  putBlob,
  contentTypeForFile,
  downloadBlobFromUrl,
} from '@/lib/storage/blob';
import { isTrustedTmpUploadUrl } from '@/lib/storage/panorama-processing';
import type { ProjectConfig } from '@/types';

export const maxDuration = 300;

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

interface ImportRequestBody {
  url?: string;
  name?: string;
  description?: string;
}

export async function POST(request: NextRequest) {
  let tempDir: string | null = null;
  let zipUrl: string | null = null;

  try {
    const session = await requireAdminOrEditor();
    const body = (await request.json()) as ImportRequestBody;

    if (!body.url || !isTrustedTmpUploadUrl(body.url)) {
      return NextResponse.json(
        { error: 'Wybierz plik ZIP z gotowym projektem' },
        { status: 400 }
      );
    }
    zipUrl = body.url;

    const zipBuffer = await downloadBlobFromUrl(zipUrl);
    if (!zipBuffer) {
      return NextResponse.json(
        { error: 'Nie udało się pobrać pliku ZIP' },
        { status: 400 }
      );
    }

    tempDir = path.join(os.tmpdir(), `pano-import-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    const zipPath = path.join(tempDir, 'upload.zip');
    await fs.writeFile(zipPath, zipBuffer);

    await extract(zipPath, { dir: tempDir });
    await fs.unlink(zipPath);

    const configPath = path.join(tempDir, 'config.json');
    try {
      await fs.access(configPath);
    } catch {
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
      return NextResponse.json(
        { error: 'Nieprawidłowy format config.json' },
        { status: 400 }
      );
    }

    const validated = projectConfigSchema.safeParse(config);
    if (!validated.success) {
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
        return NextResponse.json(
          { error: 'Edytor musi być przypisany do co najmniej jednej grupy' },
          { status: 403 }
        );
      }
      groupIds = user.groupIds;
    }

    const importName = body.name?.trim();
    const projectName = importName || projectConfig.projectName;
    const projectDescription =
      body.description?.trim() || projectConfig.description;

    const project = await createProject(
      projectName,
      projectDescription,
      createdBy,
      groupIds
    );

    await uploadDirToBlob(path.join(tempDir, 'panoramas'), (f) =>
      panoramaKey(project.id, f)
    );
    await uploadDirToBlob(path.join(tempDir, 'thumbnails'), (f) =>
      thumbnailKey(project.id, f)
    );

    const updatedConfig = configForImportedProject(
      projectConfig,
      project.id,
      project.name,
      project.description
    );
    await updateProjectConfig(project.id, updatedConfig);

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        panoramaCount: projectConfig.panoramas.length,
      },
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
    console.error('Upload project error:', error);
    return NextResponse.json(
      { error: 'Nie udało się zaimportować projektu' },
      { status: 500 }
    );
  } finally {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
    if (zipUrl) {
      await del(zipUrl).catch(() => {});
    }
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

async function uploadDirToBlob(
  srcDir: string,
  keyFor: (filename: string) => string
): Promise<void> {
  if (!(await exists(srcDir))) return;
  const files = await fs.readdir(srcDir);
  for (const f of files) {
    const src = path.join(srcDir, f);
    const stat = await fs.stat(src);
    if (!stat.isFile()) continue;
    const content = await fs.readFile(src);
    await putBlob(keyFor(f), content, {
      contentType: contentTypeForFile(f),
    });
  }
}
