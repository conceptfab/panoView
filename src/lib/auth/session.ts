import { cookies } from 'next/headers';
import { createSessionToken, verifySessionToken, TokenPayload } from './jwt';
import { User } from '@/types';

const SESSION_COOKIE_NAME = 'panorama-session';

export async function createSession(user: User): Promise<string> {
  const [token, cookieStore] = await Promise.all([
    createSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    }),
    cookies(),
  ]);
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });

  return token;
}

export async function getSession(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) return null;

  return verifySessionToken(token);
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function requireAuth(): Promise<TokenPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function requireAdmin(): Promise<TokenPayload> {
  const session = await requireAuth();
  if (session.role !== 'admin') {
    throw new Error('Forbidden: Admin access required');
  }
  return session;
}

/** Admin lub edytor – do zarządzania projektami (edytor tylko w obrębie swoich grup). */
export async function requireAdminOrEditor(): Promise<TokenPayload> {
  const session = await requireAuth();
  if (session.role !== 'admin' && session.role !== 'editor') {
    throw new Error('Forbidden: Admin or Editor access required');
  }
  return session;
}

/** Czy edytor może edytować projekt (projekt należy do co najmniej jednej grupy użytkownika). */
export function editorCanEditProject(
  projectGroupIds: string[],
  userGroupIds: string[]
): boolean {
  return projectGroupIds.some((gid) => userGroupIds.includes(gid));
}
