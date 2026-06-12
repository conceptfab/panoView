// OTP store w pliku (data/otp-store.json) – działa po restarcie i przy wielu instancjach
// Kody wygasają po 10 minutach

import { randomInt } from 'crypto';
import { readJsonFileWithDefault, writeJsonFile } from '@/lib/db/json-store';

interface OTPEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

type OtpStore = Record<string, OTPEntry>;

const OTP_STORE_FILE = 'otp-store.json';
const MAX_ATTEMPTS = 3;
const OTP_EXPIRATION_MS = 10 * 60 * 1000; // 10 minut

async function readStore(): Promise<OtpStore> {
  const store = await readJsonFileWithDefault<OtpStore>(OTP_STORE_FILE, {});
  const now = Date.now();
  const pruned: OtpStore = {};
  for (const [email, entry] of Object.entries(store)) {
    if (entry.expiresAt >= now) pruned[email] = entry;
  }
  if (Object.keys(pruned).length !== Object.keys(store).length) {
    await writeJsonFile(OTP_STORE_FILE, pruned);
  }
  return pruned;
}

export function generateOTP(): string {
  return randomInt(100000, 1000000).toString();
}

export async function storeOTP(email: string, code: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const store = await readStore();
  store[normalizedEmail] = {
    code,
    expiresAt: Date.now() + OTP_EXPIRATION_MS,
    attempts: 0,
  };
  await writeJsonFile(OTP_STORE_FILE, store);
}

export async function verifyOTP(
  email: string,
  code: string
): Promise<{ valid: boolean; error?: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const store = await readStore();
  const entry = store[normalizedEmail];

  if (!entry) {
    return { valid: false, error: 'Nie znaleziono kodu. Poproś o nowy kod.' };
  }

  if (entry.expiresAt < Date.now()) {
    delete store[normalizedEmail];
    await writeJsonFile(OTP_STORE_FILE, store);
    return { valid: false, error: 'Kod wygasł. Poproś o nowy kod.' };
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    delete store[normalizedEmail];
    await writeJsonFile(OTP_STORE_FILE, store);
    return {
      valid: false,
      error: 'Przekroczono limit prób. Poproś o nowy kod.',
    };
  }

  if (entry.code !== code) {
    entry.attempts++;
    await writeJsonFile(OTP_STORE_FILE, store);
    return {
      valid: false,
      error: `Nieprawidłowy kod. Pozostało prób: ${
        MAX_ATTEMPTS - entry.attempts
      }`,
    };
  }

  delete store[normalizedEmail];
  await writeJsonFile(OTP_STORE_FILE, store);
  return { valid: true };
}

export async function deleteOTP(email: string): Promise<void> {
  const store = await readStore();
  const key = email.toLowerCase().trim();
  if (key in store) {
    delete store[key];
    await writeJsonFile(OTP_STORE_FILE, store);
  }
}
