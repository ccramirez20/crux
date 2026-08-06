import { describe, expect, it } from 'vitest';
import { scoreIfscBoulder } from './ifsc-boulder';
import { makeAttempt } from './test-support';

describe('scoreIfscBoulder', () => {
  it('scores a first-attempt top as 35 (25 top + 10 zone), additive', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: 1 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a'] };

    const result = scoreIfscBoulder(attempts, config);

    expect(result[0]).toMatchObject({ registrationId: 'reg-a', score: 35 });
  });

  it('deducts 0.1 per extra attempt from the top score, independent of the zone score', () => {
    const attempts = [
      makeAttempt({
        registrationId: 'reg-a', problemId: 'p1', sequence: 1,
        top: true, topAttempts: 3, zone: true, zoneAttempts: 1,
      }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a'] };

    const result = scoreIfscBoulder(attempts, config);

    // top: 25 - 0.2 = 24.8; zone: 10 - 0 = 10; total 34.8
    expect(result[0]).toMatchObject({ score: 34.8 });
  });

  it('scores zone-only (no top) using just the zone formula', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, zone: true, zoneAttempts: 2 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a'] };

    const result = scoreIfscBoulder(attempts, config);

    // zone: 10 - 0.1 = 9.9; no top score
    expect(result[0]).toMatchObject({ score: 9.9 });
  });

  it('scores neither top nor zone as 0', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a'] };

    const result = scoreIfscBoulder(attempts, config);

    expect(result[0]).toMatchObject({ score: 0 });
  });

  it('floors a component at 0 when attempts are high enough to exceed its value', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: 300 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a'] };

    const result = scoreIfscBoulder(attempts, config);

    // top floored at 0 (300 attempts far exceeds 25/0.1=250 break-even); zone credited via top-implies-zone at topAttempts fallback, also floored at 0
    expect(result[0]).toMatchObject({ score: 0 });
  });

  it('sums scores across multiple problems for one registration', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: 1 }),
      makeAttempt({ registrationId: 'reg-a', problemId: 'p2', sequence: 2, zone: true, zoneAttempts: 1 }),
    ];
    const config = { problemIds: ['p1', 'p2'], registrationIds: ['reg-a'] };

    const result = scoreIfscBoulder(attempts, config);

    // p1: 35 (top+zone), p2: 10 (zone only) = 45
    expect(result[0]).toMatchObject({ score: 45 });
  });

  it('gives a real tie the same rank', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: 1 }),
      makeAttempt({ registrationId: 'reg-b', problemId: 'p1', sequence: 2, top: true, topAttempts: 1 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a', 'reg-b'] };

    const result = scoreIfscBoulder(attempts, config);

    expect(result.map((r) => [r.rank, r.tied])).toEqual([[1, true], [1, true]]);
  });

  it('ranks a registration with zero attempts last, scoring 0', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: 1 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a', 'reg-dns'] };

    const result = scoreIfscBoulder(attempts, config);

    expect(result.map((r) => r.registrationId)).toEqual(['reg-a', 'reg-dns']);
    expect(result[1]).toMatchObject({ score: 0 });
  });
});
