import { SignJWT, jwtVerify, JWTPayload } from 'jose';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET environment variable must be set (min 32 chars)');
}
const JWT_SECRET = new TextEncoder().encode(jwtSecret);

const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '7d';

export interface TokenPayload extends JWTPayload {
  userId: string;
  email: string;
  role: 'admin' | 'user' | 'editor';
}

export async function createSessionToken(
  payload: Omit<TokenPayload, 'iat' | 'exp'>
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRATION)
    .sign(JWT_SECRET);
}

export async function verifySessionToken(
  token: string
): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as TokenPayload;
  } catch {
    return null;
  }
}
