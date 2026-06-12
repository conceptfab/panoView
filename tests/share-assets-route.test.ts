import { beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/p/[token]/assets/[...path]/route';
import { setShareActive } from '@/lib/db/share-links';
import type { ProjectsData } from '@/types';

beforeEach(() => {
  const root = process.env.PANO_DATA_DIR!;
  rmSync(path.join(root, 'data', 'share-links.json'), { force: true });
  rmSync(path.join(root, 'data', 'projects.json'), { force: true });
  rmSync(path.join(root, 'uploads'), { recursive: true, force: true });
});

describe('share asset route', () => {
  it('serves a project panorama for an active published share link without a session', async () => {
    const root = process.env.PANO_DATA_DIR!;
    const projectId = 'project-1';
    const panoramaPath = path.join(
      root,
      'uploads',
      'projects',
      projectId,
      'panoramas'
    );
    mkdirSync(path.join(root, 'data'), { recursive: true });
    mkdirSync(panoramaPath, { recursive: true });
    writeFileSync(path.join(panoramaPath, 'pano.webp'), 'image-bytes');

    const projects: ProjectsData = {
      projects: [
        {
          id: projectId,
          name: 'Project 1',
          description: '',
          thumbnailUrl: '',
          configPath: `/uploads/projects/${projectId}/config.json`,
          createdAt: '2026-05-21T00:00:00.000Z',
          updatedAt: '2026-05-21T00:00:00.000Z',
          createdBy: 'admin',
          groupIds: [],
          isPublished: true,
          panoramaCount: 1,
        },
      ],
    };
    writeFileSync(
      path.join(root, 'data', 'projects.json'),
      JSON.stringify(projects)
    );

    const link = await setShareActive(projectId, true);
    const response = await GET(
      new NextRequest(
        `http://localhost/api/p/${link.token}/assets/panoramas/pano.webp`
      ),
      {
        params: Promise.resolve({
          token: link.token,
          path: ['panoramas', 'pano.webp'],
        }),
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/webp');
    expect(await response.text()).toBe('image-bytes');
  });
});
