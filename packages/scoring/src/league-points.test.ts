import { describe, expect, it } from 'vitest';
import { scoreLeaguePoints } from './league-points';
import { makeAttempt } from './test-support';

describe('scoreLeaguePoints', () => {
  it('scores a topped problem using its configured topPoints', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true }),
    ];
    const config = {
      problemIds: ['p1'],
      registrationIds: ['reg-a'],
      problemPoints: { p1: { topPoints: 500, zonePoints: null } },
    };

    const result = scoreLeaguePoints(attempts, config);

    expect(result[0]).toMatchObject({ score: 500 });
  });

  it('scores a zoned-not-topped problem using zonePoints when set', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, zone: true }),
    ];
    const config = {
      problemIds: ['p1'],
      registrationIds: ['reg-a'],
      problemPoints: { p1: { topPoints: 500, zonePoints: 100 } },
    };

    const result = scoreLeaguePoints(attempts, config);

    expect(result[0]).toMatchObject({ score: 100 });
  });

  it('scores a zoned-not-topped problem as 0 when zonePoints is null (toggle off)', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, zone: true }),
    ];
    const config = {
      problemIds: ['p1'],
      registrationIds: ['reg-a'],
      problemPoints: { p1: { topPoints: 500, zonePoints: null } },
    };

    const result = scoreLeaguePoints(attempts, config);

    expect(result[0]).toMatchObject({ score: 0 });
  });

  it('does not additionally award zonePoints when the problem was topped (not additive)', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true }),
    ];
    const config = {
      problemIds: ['p1'],
      registrationIds: ['reg-a'],
      problemPoints: { p1: { topPoints: 500, zonePoints: 100 } },
    };

    const result = scoreLeaguePoints(attempts, config);

    expect(result[0]).toMatchObject({ score: 500 });
  });

  it('scores a problem missing from problemPoints as 0 regardless of top/zone', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a'], problemPoints: {} };

    const result = scoreLeaguePoints(attempts, config);

    expect(result[0]).toMatchObject({ score: 0 });
  });

  it('scores a zoned-not-topped problem missing from problemPoints as 0', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, zone: true }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a'], problemPoints: {} };

    const result = scoreLeaguePoints(attempts, config);

    expect(result[0]).toMatchObject({ score: 0 });
  });

  it('sums scores across multiple problems', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true }),
      makeAttempt({ registrationId: 'reg-a', problemId: 'p2', sequence: 2, zone: true }),
    ];
    const config = {
      problemIds: ['p1', 'p2'],
      registrationIds: ['reg-a'],
      problemPoints: {
        p1: { topPoints: 500, zonePoints: null },
        p2: { topPoints: 300, zonePoints: 50 },
      },
    };

    const result = scoreLeaguePoints(attempts, config);

    expect(result[0]).toMatchObject({ score: 550 });
  });

  it('gives a real tie the same rank', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true }),
      makeAttempt({ registrationId: 'reg-b', problemId: 'p1', sequence: 2, top: true }),
    ];
    const config = {
      problemIds: ['p1'],
      registrationIds: ['reg-a', 'reg-b'],
      problemPoints: { p1: { topPoints: 500, zonePoints: null } },
    };

    const result = scoreLeaguePoints(attempts, config);

    expect(result.map((r) => [r.rank, r.tied])).toEqual([[1, true], [1, true]]);
  });

  it('ranks a registration with zero attempts last, scoring 0', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true }),
    ];
    const config = {
      problemIds: ['p1'],
      registrationIds: ['reg-a', 'reg-dns'],
      problemPoints: { p1: { topPoints: 500, zonePoints: null } },
    };

    const result = scoreLeaguePoints(attempts, config);

    expect(result.map((r) => r.registrationId)).toEqual(['reg-a', 'reg-dns']);
    expect(result[1]).toMatchObject({ score: 0 });
  });
});
