// oxlint-disable react-doctor/server-sequential-independent-await
import { describe, it, expect, beforeEach } from 'vitest';
import { rmSync } from 'node:fs';
import path from 'node:path';
import {
  setShareActive,
  setSharePin,
  getShareLinkByProject,
  getShareLinkByToken,
  deleteShareLink,
} from '@/lib/db/share-links';
import { verifyPin } from '@/lib/auth/share-pin';

beforeEach(() => {
  rmSync(path.join(process.env.PANO_DATA_DIR!, 'data', 'share-links.json'), {
    force: true,
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
