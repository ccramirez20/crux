import { describe, expect, it } from 'vitest';
import { createDb } from './client';

describe('createDb', () => {
  it('throws when databaseUrl is empty', () => {
    expect(() => createDb('')).toThrow(
      'DATABASE_URL is required to create a database client',
    );
  });

  // postgres.js connects lazily on first query, so this never touches the network.
  it('returns a drizzle client for a valid connection string', () => {
    const db = createDb('postgresql://user:pass@localhost:5432/test');
    expect(typeof db.execute).toBe('function');
  });
});
