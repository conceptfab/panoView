import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { accessRules, accessPending } from '@/lib/db/schema';
import { AccessControl, AccessRule } from '@/types';
import { generateId, formatDate, matchEmailPattern } from '@/utils/helpers';
import { generateOTP, storeOTP } from '@/lib/auth/otp';
import { sendOTPEmail } from '@/lib/email/mail';
import { getUserByEmail } from '@/lib/db/users';

type AccessRuleRow = typeof accessRules.$inferSelect;

function toRule(row: AccessRuleRow): AccessRule {
  return {
    id: row.id,
    pattern: row.pattern,
    isActive: row.isActive,
    createdAt: row.createdAt,
    notes: row.notes,
  };
}

export async function getAccessControl(): Promise<AccessControl> {
  const db = getDb();
  const [rules, pending] = await Promise.all([
    db.select().from(accessRules).orderBy(accessRules.createdAt),
    db.select().from(accessPending).orderBy(accessPending.requestedAt),
  ]);
  return {
    whitelist: rules.filter((r) => r.listType === 'whitelist').map(toRule),
    blacklist: rules.filter((r) => r.listType === 'blacklist').map(toRule),
    pending: pending.map((p) => ({
      email: p.email,
      requestedAt: p.requestedAt,
    })),
  };
}

/** Tylko osoby na whitelist mają dostęp. Pusta whitelist = nikt nie dostaje kodu (idą do poczekalni). */
export async function isEmailAllowed(email: string): Promise<boolean> {
  const { whitelist, blacklist } = await getAccessControl();

  for (const rule of blacklist) {
    if (rule.isActive && matchEmailPattern(email, rule.pattern)) {
      return false;
    }
  }

  const activeWhitelist = whitelist.filter((r) => r.isActive);
  for (const rule of activeWhitelist) {
    if (matchEmailPattern(email, rule.pattern)) {
      return true;
    }
  }

  return false;
}

export async function addToPending(email: string): Promise<void> {
  const normalized = email.toLowerCase().trim();
  await getDb()
    .insert(accessPending)
    .values({ email: normalized, requestedAt: formatDate(new Date()) })
    .onConflictDoNothing();
}

export async function removeFromPending(email: string): Promise<boolean> {
  const normalized = email.toLowerCase().trim();
  const deleted = await getDb()
    .delete(accessPending)
    .where(eq(accessPending.email, normalized))
    .returning({ email: accessPending.email });
  return deleted.length > 0;
}

/** Zatwierdź: dodaj do whitelist, wyślij kod na email, usuń z poczekalni. */
export async function approvePending(
  email: string
): Promise<{ sent: boolean }> {
  const normalized = email.toLowerCase().trim();
  await addToWhitelist(normalized, 'Zatwierdzony z poczekalni');
  const code = generateOTP();
  await storeOTP(normalized, code);
  const user = await getUserByEmail(normalized);
  const result = await sendOTPEmail(normalized, code, {
    isAdmin: user?.role === 'admin',
  });
  await removeFromPending(normalized);
  return { sent: result.success };
}

async function addRule(
  listType: 'whitelist' | 'blacklist',
  pattern: string,
  notes: string
): Promise<AccessRule> {
  const newRule: AccessRule = {
    id: generateId(listType === 'whitelist' ? 'wl' : 'bl'),
    pattern,
    isActive: true,
    createdAt: formatDate(new Date()),
    notes,
  };
  await getDb().insert(accessRules).values({ ...newRule, listType });
  return newRule;
}

export async function addToWhitelist(
  pattern: string,
  notes: string = ''
): Promise<AccessRule> {
  return addRule('whitelist', pattern, notes);
}

export async function addToBlacklist(
  pattern: string,
  notes: string = ''
): Promise<AccessRule> {
  return addRule('blacklist', pattern, notes);
}

export async function removeAccessRule(id: string): Promise<boolean> {
  const deleted = await getDb()
    .delete(accessRules)
    .where(eq(accessRules.id, id))
    .returning({ id: accessRules.id });
  return deleted.length > 0;
}

export async function toggleAccessRule(id: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select()
    .from(accessRules)
    .where(eq(accessRules.id, id))
    .limit(1);
  if (rows.length === 0) return false;
  await db
    .update(accessRules)
    .set({ isActive: !rows[0].isActive })
    .where(eq(accessRules.id, id));
  return true;
}
