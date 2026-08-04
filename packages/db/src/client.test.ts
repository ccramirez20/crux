import { describe, expect, it } from 'vitest';
import { createDb } from './client';

describe('createDb', () => {
  it('throws when databaseUrl is empty', () => {
    expect(() => createDb('')).toThrow(
      'DATABASE_URL is required to create a database client',
    );
  });

  it('returns a drizzle client for a valid connection string', () => {
    const db = createDb('postgresql://user:pass@localhost:5432/test');
    expect(db).toBeDefined();
  });
});
