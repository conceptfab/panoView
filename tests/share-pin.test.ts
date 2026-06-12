import { describe, it, expect } from 'vitest';
import { hashPin, verifyPin } from '@/lib/auth/share-pin';

describe('share-pin', () => {
  it('verifies a correct PIN', () => {
    const h = hashPin('1234');
    expect(verifyPin('1234', h)).toBe(true);
  });

  it('rejects a wrong PIN', () => {
    const h = hashPin('1234');
    expect(verifyPin('0000', h)).toBe(false);
  });

  it('produces different hashes for the same PIN (random salt)', () => {
    expect(hashPin('1234')).not.toBe(hashPin('1234'));
  });

  it('rejects a malformed stored value', () => {
    expect(verifyPin('1234', 'garbage')).toBe(false);
  });

  it('rejects a crafted empty-hash stored value (no bypass)', () => {
    const salt = '00'.repeat(16);
    expect(verifyPin('anything', `scrypt$${salt}$`)).toBe(false);
  });
});
