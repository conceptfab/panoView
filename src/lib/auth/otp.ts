// OTP store w Neon Postgres (tabela otp_codes) – działa po restarcie i przy wielu instancjach.
// Kody wygasają po 10 minutach.

import { randomInt } from 'crypto';
import { eq, lt } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { otpCodes } from '@/lib/db/schema';

const MAX_ATTEMPTS = 3;
const OTP_EXPIRATION_MS = 10 * 60 * 1000; // 10 minut

export function generateOTP(): string {
  return randomInt(100000, 1000000).toString();
}

async function pruneExpired(): Promise<void> {
  await getDb().delete(otpCodes).where(lt(otpCodes.expiresAt, Date.now()));
}

export async function storeOTP(email: string, code: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const db = getDb();
  await pruneExpired();
  await db
    .insert(otpCodes)
    .values({
      email: normalizedEmail,
      code,
      expiresAt: Date.now() + OTP_EXPIRATION_MS,
      attempts: 0,
    })
    .onConflictDoUpdate({
      target: otpCodes.email,
      set: {
        code,
        expiresAt: Date.now() + OTP_EXPIRATION_MS,
        attempts: 0,
      },
    });
}

export async function verifyOTP(
  email: string,
  code: string
): Promise<{ valid: boolean; error?: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const db = getDb();

  const rows = await db
    .select()
    .from(otpCodes)
    .where(eq(otpCodes.email, normalizedEmail))
    .limit(1);
  const entry = rows[0];

  if (!entry) {
    return { valid: false, error: 'Nie znaleziono kodu. Poproś o nowy kod.' };
  }

  if (entry.expiresAt < Date.now()) {
    await db.delete(otpCodes).where(eq(otpCodes.email, normalizedEmail));
    return { valid: false, error: 'Kod wygasł. Poproś o nowy kod.' };
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    await db.delete(otpCodes).where(eq(otpCodes.email, normalizedEmail));
    return {
      valid: false,
      error: 'Przekroczono limit prób. Poproś o nowy kod.',
    };
  }

  if (entry.code !== code) {
    const attempts = entry.attempts + 1;
    await db
      .update(otpCodes)
      .set({ attempts })
      .where(eq(otpCodes.email, normalizedEmail));
    return {
      valid: false,
      error: `Nieprawidłowy kod. Pozostało prób: ${MAX_ATTEMPTS - attempts}`,
    };
  }

  await db.delete(otpCodes).where(eq(otpCodes.email, normalizedEmail));
  return { valid: true };
}

async function deleteOTP(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  await getDb().delete(otpCodes).where(eq(otpCodes.email, normalizedEmail));
}
