import { createDb, type Db } from '@crux/db';

let db: Db | undefined;

export function getDb(): Db {
  if (!db) {
    db = createDb(process.env.DATABASE_URL ?? '');
  }
  return db;
}
