import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createTestDb, type TestDb } from './test-db';
import { shareLinks, projects } from '@/lib/db/schema';

let testDb: TestDb;

vi.mock('@/lib/db/client', () => ({
  getDb: () => testDb,
}));

vi.mock('@/lib/storage/blob', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/storage/blob')>();
  return {
    ...original,
    resolveBlobUrl: vi.fn(async (pathname: string) =>
      pathname === 'projects/project-1/panoramas/pano.webp'
        ? `https://test.public.blob.vercel-storage.com/${pathname}`
        : null
    ),
  };
});

const { GET } = await import('@/app/api/p/[token]/assets/[...path]/route');
const { setShareActive } = await import('@/lib/db/share-links');

beforeAll(async () => {
  testDb = await createTestDb();
});

beforeEach(async () => {
  await testDb.delete(shareLinks);
  await testDb.delete(projects);
});

async function insertProject(id: string, isPublished = true) {
  await testDb.insert(projects).values({
    id,
    name: 'Project 1',
    description: '',
    thumbnailUrl: '',
    createdAt: '2026-05-21T00:00:00.000Z',
    updatedAt: '2026-05-21T00:00:00.000Z',
    createdBy: 'admin',
    isPublished,
    panoramaCount: 1,
    config: {
      version: '1.0',
      projectName: 'Project 1',
      description: '',
      createdAt: '2026-05-21T00:00:00.000Z',
      updatedAt: '2026-05-21T00:00:00.000Z',
      settings: {
        autoRotate: true,
        autoRotateSpeed: 0.5,
        autoRotateDelay: 30000,
        cameraFov: 55,
        optimizePanoramaForScreen: false,
        controlBar: false,
        splashDuration: 3000,
        fadeDuration: 2000,
      },
      panoramas: [],
      metadata: { author: '', client: '', tags: [] },
    },
  });
}

describe('share asset route', () => {
  it('redirects to the blob URL for an active published share link without a session', async () => {
    const projectId = 'project-1';
    await insertProject(projectId);

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

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe(
      'https://test.public.blob.vercel-storage.com/projects/project-1/panoramas/pano.webp'
    );
  });

  it('returns 404 for an inactive link', async () => {
    const projectId = 'project-1';
    await insertProject(projectId);

    const link = await setShareActive(projectId, false);
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

    expect(response.status).toBe(404);
  });

  it('serves project config from the database', async () => {
    const projectId = 'project-1';
    await insertProject(projectId);

    const link = await setShareActive(projectId, true);
    const response = await GET(
      new NextRequest(
        `http://localhost/api/p/${link.token}/assets/config.json`
      ),
      {
        params: Promise.resolve({
          token: link.token,
          path: ['config.json'],
        }),
      }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.projectName).toBe('Project 1');
  });
});
