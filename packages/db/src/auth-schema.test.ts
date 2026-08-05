import { describe, expect, it } from 'vitest';
import { account, session, user, verification } from './auth-schema';

describe('better-auth generated schema', () => {
  it('exports the four core auth tables', () => {
    expect(user).toBeDefined();
    expect(session).toBeDefined();
    expect(account).toBeDefined();
    expect(verification).toBeDefined();
  });

  it('user requires an email and enforces uniqueness', () => {
    expect(user.email.notNull).toBe(true);
    expect(user.email.isUnique).toBe(true);
  });

  it('session references a user, has an expiry, and a unique token', () => {
    expect(session.userId.notNull).toBe(true);
    expect(session.expiresAt.notNull).toBe(true);
    expect(session.token.isUnique).toBe(true);
  });

  it('account references a user and stores provider identifiers', () => {
    expect(account.userId.notNull).toBe(true);
    expect(account.accountId.notNull).toBe(true);
    expect(account.providerId.notNull).toBe(true);
  });

  it('verification requires an identifier, value and expiry', () => {
    expect(verification.identifier.notNull).toBe(true);
    expect(verification.value.notNull).toBe(true);
    expect(verification.expiresAt.notNull).toBe(true);
  });
});
