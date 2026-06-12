import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { createTestDb, type TestDb } from './test-db';
import { shareLinks, projects } from '@/lib/db/schema';

let testDb: TestDb;

vi.mock('@/lib/db/client', () => ({
  getDb: () => testDb,
}));

const {
  setShareActive,
  setSharePin,
  getShareLinkByProject,
  getShareLinkByToken,
  deleteShareLink,
} = await import('@/lib/db/share-links');
const { verifyPin } = await import('@/lib/auth/share-pin');

beforeAll(async () => {
  testDb = await createTestDb();
});

beforeEach(async () => {
  await testDb.delete(shareLinks);
  await testDb.delete(projects);
  // share_links ma FK do projects – wstaw projekt bazowy
  await testDb.insert(projects).values({
    id: 'proj-1',
    name: 'Projekt 1',
    description: '',
    thumbnailUrl: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'admin',
    isPublished: true,
    panoramaCount: 0,
    config: {
      version: '1.0',
      projectName: 'Projekt 1',
      description: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      settings: {
        autoRotate: true,
        autoRotateSpeed: 0.5,
        autoRotateDelay: 30000,
        cameraFov: 55,
        optimizePanoramaForScreen: true,
        controlBar: false,
        splashDuration: 3000,
        fadeDuration: 2000,
      },
      panoramas: [],
      metadata: { author: '', client: '', tags: [] },
    },
  });
});

describe('share-links db', () => {
  it('creates a link with a token on first enable', async () => {
    const link = await setShareActive('proj-1', true);
    expect(link.token).toBeTruthy();
    expect(link.isActive).toBe(true);
    expect(link.pinHash).toBeNull();
  });

  it('keeps the same token across toggles', async () => {
    const a = await setShareActive('proj-1', true);
    const b = await setShareActive('proj-1', false);
    expect(b.token).toBe(a.token);
    expect(b.isActive).toBe(false);
  });

  it('looks up by token and by project', async () => {
    const a = await setShareActive('proj-1', true);
    expect((await getShareLinkByToken(a.token))?.projectId).toBe('proj-1');
    expect((await getShareLinkByProject('proj-1'))?.token).toBe(a.token);
  });

  it('sets and clears a PIN', async () => {
    await setShareActive('proj-1', true);
    const withPin = await setSharePin('proj-1', '1234');
    expect(withPin.pinHash).not.toBeNull();
    expect(verifyPin('1234', withPin.pinHash!)).toBe(true);
    const cleared = await setSharePin('proj-1', null);
    expect(cleared.pinHash).toBeNull();
  });

  it('deletes a link', async () => {
    await setShareActive('proj-1', true);
    expect(await deleteShareLink('proj-1')).toBe(true);
    expect(await getShareLinkByProject('proj-1')).toBeNull();
  });

  it('returns null for an unknown token', async () => {
    expect(await getShareLinkByToken('nope')).toBeNull();
  });
});
