import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { getDb } from './client';
import { shareLinks } from './schema';
import { ShareLink } from '@/types';
import { formatDate } from '@/utils/helpers';
import { hashPin } from '@/lib/auth/share-pin';

/** Losowy token linku (base64url, 192 bity entropii). */
export function generateShareToken(): string {
  return randomBytes(24).toString('base64url');
}

type ShareLinkRow = typeof shareLinks.$inferSelect;

function toShareLink(row: ShareLinkRow): ShareLink {
  return {
    projectId: row.projectId,
    token: row.token,
    isActive: row.isActive,
    pinHash: row.pinHash,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getShareLinks(): Promise<ShareLink[]> {
  const rows = await getDb().select().from(shareLinks);
  return rows.map(toShareLink);
}

export async function getShareLinkByToken(
  token: string
): Promise<ShareLink | null> {
  if (!token) return null;
  const rows = await getDb()
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.token, token))
    .limit(1);
  return rows.length > 0 ? toShareLink(rows[0]) : null;
}

export async function getShareLinkByProject(
  projectId: string
): Promise<ShareLink | null> {
  const rows = await getDb()
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.projectId, projectId))
    .limit(1);
  return rows.length > 0 ? toShareLink(rows[0]) : null;
}

/** Włącza/wyłącza link. Pierwsze włączenie tworzy wpis i generuje token. */
export async function setShareActive(
  projectId: string,
  isActive: boolean
): Promise<ShareLink> {
  const db = getDb();
  const now = formatDate(new Date());
  const existing = await getShareLinkByProject(projectId);
  if (!existing) {
    const link: ShareLink = {
      projectId,
      token: generateShareToken(),
      isActive,
      pinHash: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(shareLinks).values(link);
    return link;
  }
  const updated = await db
    .update(shareLinks)
    .set({ isActive, updatedAt: now })
    .where(eq(shareLinks.projectId, projectId))
    .returning();
  return toShareLink(updated[0]);
}

/** Ustawia PIN (string) lub czyści go (null/''). Tworzy wpis, jeśli nie istnieje. */
export async function setSharePin(
  projectId: string,
  pin: string | null
): Promise<ShareLink> {
  const db = getDb();
  const now = formatDate(new Date());
  const nextHash = pin ? hashPin(pin) : null;
  const existing = await getShareLinkByProject(projectId);
  if (!existing) {
    const link: ShareLink = {
      projectId,
      token: generateShareToken(),
      isActive: false,
      pinHash: nextHash,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(shareLinks).values(link);
    return link;
  }
  const updated = await db
    .update(shareLinks)
    .set({ pinHash: nextHash, updatedAt: now })
    .where(eq(shareLinks.projectId, projectId))
    .returning();
  return toShareLink(updated[0]);
}

export async function deleteShareLink(projectId: string): Promise<boolean> {
  const deleted = await getDb()
    .delete(shareLinks)
    .where(eq(shareLinks.projectId, projectId))
    .returning({ projectId: shareLinks.projectId });
  return deleted.length > 0;
}
