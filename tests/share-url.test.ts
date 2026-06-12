import { afterEach, describe, expect, it } from 'vitest';
import { buildShareUrl } from '@/lib/share-url';

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (originalAppUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  }
});

describe('share url', () => {
  it('uses configured public app URL instead of the request origin', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://pano.conceptfab.com';

    const url = buildShareUrl('https://localhost:8080', 'share-token');

    expect(url).toBe('https://pano.conceptfab.com/p/share-token');
  });

  it('falls back to the request origin when public app URL is not configured', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    const url = buildShareUrl('http://localhost:3000', 'share-token');

    expect(url).toBe('http://localhost:3000/p/share-token');
  });
});
