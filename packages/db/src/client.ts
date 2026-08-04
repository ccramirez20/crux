import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export function createDb(databaseUrl: string) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to create a database client');
  }
  return drizzle(postgres(databaseUrl));
}

export type Db = ReturnType<typeof createDb>;
