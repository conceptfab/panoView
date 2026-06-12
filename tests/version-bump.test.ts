import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseVersionInput } = require('../scripts/lib/version-bump');

describe('parseVersionInput', () => {
  const current = '0.1.54-beta';

  it('pusty input = bez zmiany', () => {
    expect(parseVersionInput('', current)).toEqual({
      packageVersion: current,
      displayVersion: current,
      changed: false,
    });
  });

  it('akceptuje semver z pre-release', () => {
    expect(parseVersionInput('0.1.55-beta', current)).toEqual({
      packageVersion: '0.1.55-beta',
      displayVersion: '0.1.55-beta',
      changed: true,
    });
  });

  it('akceptuje format beta 0.1.55', () => {
    expect(parseVersionInput('beta 0.1.55', current)).toEqual({
      packageVersion: '0.1.55-beta',
      displayVersion: 'β 0.1.55',
      changed: true,
    });
  });

  it('akceptuje format β 0.1.55', () => {
    expect(parseVersionInput('β 0.1.55', current)).toEqual({
      packageVersion: '0.1.55-beta',
      displayVersion: 'β 0.1.55',
      changed: true,
    });
  });

  it('ta sama wersja = changed: false', () => {
    expect(parseVersionInput('0.1.54-beta', current)?.changed).toBe(false);
  });

  it('odrzuca nieprawidłowy format', () => {
    expect(parseVersionInput('v1', current)).toBeNull();
    expect(parseVersionInput('abc', current)).toBeNull();
  });
});
