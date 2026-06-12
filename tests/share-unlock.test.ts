import { describe, it, expect } from 'vitest';
import {
  createShareUnlockToken,
  verifyShareUnlockToken,
} from '@/lib/auth/share-unlock';

describe('share-unlock token', () => {
  it('round-trips for the same share token', async () => {
    const v = await createShareUnlockToken('abc');
    expect(await verifyShareUnlockToken(v, 'abc')).toBe(true);
  });

  it('fails for a different share token', async () => {
    const v = await createShareUnlockToken('abc');
    expect(await verifyShareUnlockToken(v, 'xyz')).toBe(false);
  });

  it('fails for garbage input', async () => {
    expect(await verifyShareUnlockToken('garbage', 'abc')).toBe(false);
  });
});
