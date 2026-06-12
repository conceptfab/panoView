import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { getJwtKey } from './jwt-key';

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
    .sign(getJwtKey());
}

export async function verifySessionToken(
  token: string
): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtKey());
    return payload as TokenPayload;
  } catch {
    return null;
  }
}
