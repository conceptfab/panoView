import { readJsonFileWithDefault, writeJsonFile } from '../db/json-store';
import { AccessControl, AccessRule, PendingAccessRequest } from '@/types';
import { generateId, formatDate, matchEmailPattern } from '@/utils/helpers';
import { accessControlSchema } from '@/utils/validation';
import { generateOTP, storeOTP } from '@/lib/auth/otp';
import { sendOTPEmail } from '@/lib/email/resend';
import { getUserByEmail } from '@/lib/db/users';

const ACCESS_CONTROL_FILE = 'access-control.json';

const DEFAULT_ACCESS_CONTROL: AccessControl = {
  whitelist: [],
  blacklist: [],
  pending: [],
};

export async function getAccessControl(): Promise<AccessControl> {
  const data = await readJsonFileWithDefault<AccessControl>(
    ACCESS_CONTROL_FILE,
    DEFAULT_ACCESS_CONTROL
  );
  const pending: PendingAccessRequest[] = Array.isArray(data.pending)
    ? data.pending
    : [];
  const normalized = {
    whitelist: data.whitelist,
    blacklist: data.blacklist,
    pending,
  } as AccessControl;
  return accessControlSchema.parse(normalized) as AccessControl;
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
  const data = await getAccessControl();
  const normalized = email.toLowerCase().trim();
  if (data.pending.some((p) => p.email.toLowerCase() === normalized)) {
    return;
  }
  data.pending.push({
    email: normalized,
    requestedAt: formatDate(new Date()),
  });
  await writeJsonFile(ACCESS_CONTROL_FILE, data);
}

export async function removeFromPending(email: string): Promise<boolean> {
  const data = await getAccessControl();
  const normalized = email.toLowerCase().trim();
  const before = data.pending.length;
  data.pending = data.pending.filter(
    (p) => p.email.toLowerCase() !== normalized
  );
  if (data.pending.length === before) return false;
  await writeJsonFile(ACCESS_CONTROL_FILE, data);
  return true;
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

export async function addToWhitelist(
  pattern: string,
  notes: string = ''
): Promise<AccessRule> {
  const data = await getAccessControl();

  const newRule: AccessRule = {
    id: generateId('wl'),
    pattern,
    isActive: true,
    createdAt: formatDate(new Date()),
    notes,
  };

  data.whitelist.push(newRule);
  await writeJsonFile<AccessControl>(ACCESS_CONTROL_FILE, data);

  return newRule;
}

export async function addToBlacklist(
  pattern: string,
  notes: string = ''
): Promise<AccessRule> {
  const data = await getAccessControl();

  const newRule: AccessRule = {
    id: generateId('bl'),
    pattern,
    isActive: true,
    createdAt: formatDate(new Date()),
    notes,
  };

  data.blacklist.push(newRule);
  await writeJsonFile<AccessControl>(ACCESS_CONTROL_FILE, data);

  return newRule;
}

export async function removeAccessRule(id: string): Promise<boolean> {
  const data = await getAccessControl();

  const wlIndex = data.whitelist.findIndex((r) => r.id === id);
  if (wlIndex !== -1) {
    data.whitelist.splice(wlIndex, 1);
    await writeJsonFile<AccessControl>(ACCESS_CONTROL_FILE, data);
    return true;
  }

  const blIndex = data.blacklist.findIndex((r) => r.id === id);
  if (blIndex !== -1) {
    data.blacklist.splice(blIndex, 1);
    await writeJsonFile<AccessControl>(ACCESS_CONTROL_FILE, data);
    return true;
  }

  return false;
}

export async function toggleAccessRule(id: string): Promise<boolean> {
  const data = await getAccessControl();

  const wlRule = data.whitelist.find((r) => r.id === id);
  if (wlRule) {
    wlRule.isActive = !wlRule.isActive;
    await writeJsonFile<AccessControl>(ACCESS_CONTROL_FILE, data);
    return true;
  }

  const blRule = data.blacklist.find((r) => r.id === id);
  if (blRule) {
    blRule.isActive = !blRule.isActive;
    await writeJsonFile<AccessControl>(ACCESS_CONTROL_FILE, data);
    return true;
  }

  return false;
}
