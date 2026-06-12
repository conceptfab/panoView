import { SignJWT, jwtVerify } from 'jose';
import { getJwtKey } from './jwt-key';

const TTL = '12h';

/** Podpisany token odblokowania konkretnego linku (claim `share`). */
export async function createShareUnlockToken(shareToken: string): Promise<string> {
  return new SignJWT({ share: shareToken })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(getJwtKey());
}

/** True, gdy ciasteczko jest ważne i dotyczy właśnie tego linku. */
export async function verifyShareUnlockToken(
  value: string,
  shareToken: string
): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(value, getJwtKey());
    return payload.share === shareToken;
  } catch {
    return false;
  }
}
