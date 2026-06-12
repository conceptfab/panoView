/**
 * Seed bazy Neon Postgres: konto administratora + wpis na whitelist.
 * Zastępuje dawny init-data.js (model OTP – bez hasła).
 *
 * Uruchomienie: npm run db:seed
 * (wymaga DATABASE_URL i ADMIN_EMAIL w .env.local)
 */
import { eq } from 'drizzle-orm';
import { getDb } from '../src/lib/db/client';
import { users, accessRules } from '../src/lib/db/schema';
import { generateId, formatDate } from '../src/utils/helpers';

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  if (!adminEmail || adminEmail === 'admin@example.com') {
    console.error(
      'Ustaw ADMIN_EMAIL w .env.local (prawdziwy adres administratora).'
    );
    process.exit(1);
  }

  const db = getDb();
  const now = formatDate(new Date());

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);

  if (existing.length > 0) {
    console.log(`Użytkownik ${adminEmail} już istnieje (${existing[0].role}).`);
  } else {
    const id = generateId('user');
    await db.insert(users).values({
      id,
      email: adminEmail,
      role: 'admin',
      isActive: true,
      createdAt: now,
      lastLoginAt: null,
    });
    console.log(`Utworzono administratora: ${adminEmail} (${id})`);
  }

  const rules = await db.select().from(accessRules);
  const hasWhitelistEntry = rules.some(
    (r) => r.listType === 'whitelist' && r.pattern === adminEmail
  );
  if (hasWhitelistEntry) {
    console.log('Wpis whitelist dla administratora już istnieje.');
  } else {
    await db.insert(accessRules).values({
      id: generateId('wl'),
      listType: 'whitelist',
      pattern: adminEmail,
      isActive: true,
      createdAt: now,
      notes: 'Initial admin (seed)',
    });
    console.log(`Dodano ${adminEmail} do whitelist.`);
  }

  console.log('Seed zakończony.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
