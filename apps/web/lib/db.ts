import { createDb, type Db } from '@crux/db';

// ponytail: cached on globalThis, not a module-scope let, because Next's dev
// server re-evaluates this module on every HMR reload — a module-scope
// singleton would open a fresh postgres.js pool per edit without closing
// the old one.
const globalForDb = globalThis as unknown as { db?: Db };

export function getDb(): Db {
  if (!globalForDb.db) {
    globalForDb.db = createDb(process.env.DATABASE_URL ?? '');
  }
  return globalForDb.db;
}
