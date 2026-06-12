import { SignJWT, jwtVerify } from 'jose';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET environment variable must be set (min 32 chars)');
}
const KEY = new TextEncoder().encode(jwtSecret);
const TTL = '12h';

/** Podpisany token odblokowania konkretnego linku (claim `share`). */
export async function createShareUnlockToken(shareToken: string): Promise<string> {
  return new SignJWT({ share: shareToken })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(KEY);
}

/** True, gdy ciasteczko jest ważne i dotyczy właśnie tego linku. */
export async function verifyShareUnlockToken(
  value: string,
  shareToken: string
): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(value, KEY);
    return payload.share === shareToken;
  } catch {
    return false;
  }
}
