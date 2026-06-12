import { describe, it, expect } from 'vitest';
import { generateShareToken } from '@/lib/db/share-links';

describe('generateShareToken', () => {
  it('produces a URL-safe token of expected length', () => {
    const t = generateShareToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThanOrEqual(32);
  });

  it('produces unique tokens', () => {
    expect(generateShareToken()).not.toBe(generateShareToken());
  });
});
