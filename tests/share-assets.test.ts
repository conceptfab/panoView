import { describe, expect, it } from 'vitest';
import {
  buildShareAssetBasePath,
  resolveShareAssetPath,
} from '@/lib/share-assets';

describe('share assets', () => {
  it('builds an asset base path scoped by share token', () => {
    expect(buildShareAssetBasePath('share-token')).toBe(
      '/api/p/share-token/assets'
    );
  });

  it('resolves project asset paths to a blob key under the linked project', () => {
    const resolved = resolveShareAssetPath('project-1', [
      'panoramas',
      'pano.webp',
    ]);

    expect(resolved.valid).toBe(true);
    if (resolved.valid) {
      expect(resolved.blobKey).toBe('projects/project-1/panoramas/pano.webp');
    }
  });

  it('rejects path traversal outside the linked project directory', () => {
    const resolved = resolveShareAssetPath('project-1', [
      '..',
      'project-2',
      'panoramas',
      'pano.webp',
    ]);

    expect(resolved.valid).toBe(false);
  });

  it('rejects empty segment lists', () => {
    expect(resolveShareAssetPath('project-1', []).valid).toBe(false);
  });
});
