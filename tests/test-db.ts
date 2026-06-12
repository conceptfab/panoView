import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { pushSchema } from 'drizzle-kit/api';
import * as schema from '@/lib/db/schema';

/**
 * Baza Postgres w pamięci (PGlite) ze schematem aplikacji – do testów
 * warstwy danych bez połączenia z Neon.
 */
export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  const { apply } = await pushSchema(
    schema,
    db as unknown as Parameters<typeof pushSchema>[1]
  );
  await apply();
  return db;
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;
