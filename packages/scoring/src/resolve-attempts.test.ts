import { describe, expect, it } from 'vitest';
import { resolveCurrentAttempts } from './resolve-attempts';
import { makeAttempt } from './test-support';

describe('resolveCurrentAttempts', () => {
  it('keeps only the highest-sequence row per (registrationId, problemId)', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: false }),
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 2, top: true, topAttempts: 3 }),
    ];

    const result = resolveCurrentAttempts(attempts, new Set(['p1']));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ sequence: 2, top: true, topAttempts: 3 });
  });

  it('drops attempts for problems outside the given set', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true }),
      makeAttempt({ registrationId: 'reg-a', problemId: 'other-round', sequence: 2, top: true }),
    ];

    const result = resolveCurrentAttempts(attempts, new Set(['p1']));

    expect(result).toHaveLength(1);
    expect(result[0]?.problemId).toBe('p1');
  });
});
