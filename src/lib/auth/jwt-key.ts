let cachedKey: Uint8Array | undefined;

/** Lazy – unikamy rzucania przy imporcie modułu (build Next.js / collect page data). */
export function getJwtKey(): Uint8Array {
  if (!cachedKey) {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET environment variable must be set (min 32 chars)');
    }
    cachedKey = new TextEncoder().encode(secret);
  }
  return cachedKey;
}
