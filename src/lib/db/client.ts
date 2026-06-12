import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Lazy init – top-level neon() wywaliłby `next build`, gdy env nie jest jeszcze ustawiony.
let _db: NeonHttpDatabase<typeof schema> | null = null;

export function getDb(): NeonHttpDatabase<typeof schema> {
  if (!_db) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) {
      throw new Error('DATABASE_URL (lub POSTGRES_URL) is not set');
    }
    const sql = neon(url);
    _db = drizzle(sql, { schema });
  }
  return _db;
}
