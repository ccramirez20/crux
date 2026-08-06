import { describe, expect, it } from 'vitest';
import { scoreIfscBoulder } from './ifsc-boulder';
import { makeAttempt } from './test-support';

describe('scoreIfscBoulder', () => {
  it('scores a first-try top as 25 (top value only, not summed with zone)', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: 1 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a'] };

    const result = scoreIfscBoulder(attempts, config);

    // topAttemptsUsed = 1 -> 250 - (1-1)*1 = 250 tenths = 25.0
    expect(result[0]).toMatchObject({ registrationId: 'reg-a', score: 25 });
  });

  it('deducts 0.1 per extra attempt from a topped problem', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: 3 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a'] };

    const result = scoreIfscBoulder(attempts, config);

    // topAttemptsUsed = 3 -> 250 - (3-1)*1 = 248 tenths = 24.8
    expect(result[0]).toMatchObject({ score: 24.8 });
  });

  it('scores a zone-only (not topped) problem using the zone formula on its own', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, zone: true, zoneAttempts: 2 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a'] };

    const result = scoreIfscBoulder(attempts, config);

    // zoneAttemptsUsed = 2 -> 100 - (2-1)*1 = 99 tenths = 9.9
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

  it('floors a topped problem at 0 when attempts are high enough to exceed its value', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: 300 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a'] };

    const result = scoreIfscBoulder(attempts, config);

    // topAttemptsUsed = 300 -> 250 - 299 = -49 -> floored to 0
    expect(result[0]).toMatchObject({ score: 0 });
  });

  it('floors a zone-only problem at 0 when attempts are high enough to exceed its value', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, zone: true, zoneAttempts: 200 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a'] };

    const result = scoreIfscBoulder(attempts, config);

    // zoneAttemptsUsed = 200 -> 100 - 199 = -99 -> floored to 0
    expect(result[0]).toMatchObject({ score: 0 });
  });

  it('sums scores across multiple problems for one registration', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: 1 }),
      makeAttempt({ registrationId: 'reg-a', problemId: 'p2', sequence: 2, zone: true, zoneAttempts: 1 }),
    ];
    const config = { problemIds: ['p1', 'p2'], registrationIds: ['reg-a'] };

    const result = scoreIfscBoulder(attempts, config);

    // p1 (topped, 1 attempt): 25.0; p2 (zone-only, 1 attempt): 10.0; total 35.0
    expect(result[0]).toMatchObject({ score: 35 });
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

  it('ranks a registration with zero attempts (DNS) last, scoring 0', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: 1 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a', 'reg-dns'] };

    const result = scoreIfscBoulder(attempts, config);

    expect(result.map((r) => r.registrationId)).toEqual(['reg-a', 'reg-dns']);
    expect(result[1]).toMatchObject({ score: 0 });
  });
});
