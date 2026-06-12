import { randomBytes } from 'crypto';
import { readJsonFileWithDefault, writeJsonFile } from './json-store';
import { ShareLink, ShareLinksData } from '@/types';
import { formatDate } from '@/utils/helpers';
import { shareLinksDataSchema } from '@/utils/validation';
import { hashPin } from '@/lib/auth/share-pin';

const SHARE_LINKS_FILE = 'share-links.json';
const DEFAULT_DATA: ShareLinksData = { links: [] };

/** Losowy token linku (base64url, 192 bity entropii). */
export function generateShareToken(): string {
  return randomBytes(24).toString('base64url');
}

async function readAll(): Promise<ShareLinksData> {
  const data = await readJsonFileWithDefault<ShareLinksData>(
    SHARE_LINKS_FILE,
    DEFAULT_DATA
  );
  return shareLinksDataSchema.parse(data) as ShareLinksData;
}

export async function getShareLinks(): Promise<ShareLink[]> {
  return (await readAll()).links;
}

export async function getShareLinkByToken(
  token: string
): Promise<ShareLink | null> {
  if (!token) return null;
  const { links } = await readAll();
  return links.find((l) => l.token === token) ?? null;
}

export async function getShareLinkByProject(
  projectId: string
): Promise<ShareLink | null> {
  const { links } = await readAll();
  return links.find((l) => l.projectId === projectId) ?? null;
}

/** Włącza/wyłącza link. Pierwsze włączenie tworzy wpis i generuje token. */
export async function setShareActive(
  projectId: string,
  isActive: boolean
): Promise<ShareLink> {
  const data = await readAll();
  const now = formatDate(new Date());
  let link = data.links.find((l) => l.projectId === projectId);
  if (!link) {
    link = {
      projectId,
      token: generateShareToken(),
      isActive,
      pinHash: null,
      createdAt: now,
      updatedAt: now,
    };
    data.links.push(link);
  } else {
    link.isActive = isActive;
    link.updatedAt = now;
  }
  await writeJsonFile<ShareLinksData>(SHARE_LINKS_FILE, data);
  return link;
}

/** Ustawia PIN (string) lub czyści go (null/''). Tworzy wpis, jeśli nie istnieje. */
export async function setSharePin(
  projectId: string,
  pin: string | null
): Promise<ShareLink> {
  const data = await readAll();
  const now = formatDate(new Date());
  const nextHash = pin ? hashPin(pin) : null;
  let link = data.links.find((l) => l.projectId === projectId);
  if (!link) {
    link = {
      projectId,
      token: generateShareToken(),
      isActive: false,
      pinHash: nextHash,
      createdAt: now,
      updatedAt: now,
    };
    data.links.push(link);
  } else {
    link.pinHash = nextHash;
    link.updatedAt = now;
  }
  await writeJsonFile<ShareLinksData>(SHARE_LINKS_FILE, data);
  return link;
}

export async function deleteShareLink(projectId: string): Promise<boolean> {
  const data = await readAll();
  const before = data.links.length;
  data.links = data.links.filter((l) => l.projectId !== projectId);
  if (data.links.length === before) return false;
  await writeJsonFile<ShareLinksData>(SHARE_LINKS_FILE, data);
  return true;
}
