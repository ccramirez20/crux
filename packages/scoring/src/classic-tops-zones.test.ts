import { describe, expect, it } from 'vitest';
import { scoreClassicTopsZones } from './classic-tops-zones';
import { makeAttempt } from './test-support';

describe('scoreClassicTopsZones', () => {
  it('ranks by tops first, more tops wins', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: 1 }),
      makeAttempt({ registrationId: 'reg-a', problemId: 'p2', sequence: 2, top: true, topAttempts: 2 }),
      makeAttempt({ registrationId: 'reg-b', problemId: 'p1', sequence: 3, top: true, topAttempts: 1 }),
      makeAttempt({ registrationId: 'reg-b', problemId: 'p2', sequence: 4, zone: true, zoneAttempts: 1 }),
    ];
    const config = { problemIds: ['p1', 'p2'], registrationIds: ['reg-a', 'reg-b'] };

    const result = scoreClassicTopsZones(attempts, config);

    // reg-a: p1 top (topAttempts 1) + p2 top (topAttempts 2) => tops=2, topAttempts=3;
    // both tops also credit their zone (fallback to topAttempts) => zones=2, zoneAttempts=1+2=3.
    // reg-b: p1 top (topAttempts 1) => tops=1, topAttempts=1, plus its implied zone (1);
    // p2 explicit zone (zoneAttempts 1) => zones=2, zoneAttempts=1+1=2.
    expect(result).toEqual([
      { format: 'classic_tops_zones', rank: 1, tied: false, registrationId: 'reg-a', tops: 2, topAttempts: 3, zones: 2, zoneAttempts: 3 },
      { format: 'classic_tops_zones', rank: 2, tied: false, registrationId: 'reg-b', tops: 1, topAttempts: 1, zones: 2, zoneAttempts: 2 },
    ]);
  });

  it('gives a full tie the same rank and skips the next rank by the group size', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: 1 }),
      makeAttempt({ registrationId: 'reg-b', problemId: 'p1', sequence: 2, top: true, topAttempts: 1 }),
      makeAttempt({ registrationId: 'reg-c', problemId: 'p1', sequence: 3, top: false }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a', 'reg-b', 'reg-c'] };

    const result = scoreClassicTopsZones(attempts, config);

    expect(result.map((r) => [r.registrationId, r.rank, r.tied])).toEqual([
      ['reg-a', 1, true],
      ['reg-b', 1, true],
      ['reg-c', 3, false],
    ]);
  });

  it('gives a 3-way tie the same rank and skips the next rank by the group size', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: 1 }),
      makeAttempt({ registrationId: 'reg-b', problemId: 'p1', sequence: 2, top: true, topAttempts: 1 }),
      makeAttempt({ registrationId: 'reg-c', problemId: 'p1', sequence: 3, top: true, topAttempts: 1 }),
      makeAttempt({ registrationId: 'reg-d', problemId: 'p1', sequence: 4, top: false }),
    ];
    const config = {
      problemIds: ['p1'],
      registrationIds: ['reg-a', 'reg-b', 'reg-c', 'reg-d'],
    };

    const result = scoreClassicTopsZones(attempts, config);

    expect(result.map((r) => [r.registrationId, r.rank, r.tied])).toEqual([
      ['reg-a', 1, true],
      ['reg-b', 1, true],
      ['reg-c', 1, true],
      ['reg-d', 4, false],
    ]);
  });

  it('breaks a tie in tops by fewer attempts to top', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: 3 }),
      makeAttempt({ registrationId: 'reg-b', problemId: 'p1', sequence: 2, top: true, topAttempts: 1 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a', 'reg-b'] };

    const result = scoreClassicTopsZones(attempts, config);

    expect(result.map((r) => r.registrationId)).toEqual(['reg-b', 'reg-a']);
  });

  it('breaks a tie in tops and top-attempts by more zones', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: 1 }),
      makeAttempt({ registrationId: 'reg-a', problemId: 'p2', sequence: 2, zone: true, zoneAttempts: 2 }),
      makeAttempt({ registrationId: 'reg-b', problemId: 'p1', sequence: 3, top: true, topAttempts: 1 }),
    ];
    const config = { problemIds: ['p1', 'p2'], registrationIds: ['reg-a', 'reg-b'] };

    const result = scoreClassicTopsZones(attempts, config);

    expect(result.map((r) => r.registrationId)).toEqual(['reg-a', 'reg-b']);
  });

  it('breaks a tie in tops, top-attempts, and zones by fewer attempts to zone', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, zone: true, zoneAttempts: 3 }),
      makeAttempt({ registrationId: 'reg-b', problemId: 'p1', sequence: 2, zone: true, zoneAttempts: 1 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a', 'reg-b'] };

    const result = scoreClassicTopsZones(attempts, config);

    expect(result.map((r) => r.registrationId)).toEqual(['reg-b', 'reg-a']);
  });

  it('ranks a registration with zero attempts last, as a DNS', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: 1 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a', 'reg-dns'] };

    const result = scoreClassicTopsZones(attempts, config);

    expect(result.map((r) => r.registrationId)).toEqual(['reg-a', 'reg-dns']);
    expect(result[1]).toMatchObject({ tops: 0, topAttempts: 0, zones: 0, zoneAttempts: 0 });
  });

  it('only counts the highest-sequence attempt when a correction supersedes an earlier one', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: false, topAttempts: null }),
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 2, top: true, topAttempts: 4 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a'] };

    const result = scoreClassicTopsZones(attempts, config);

    expect(result[0]).toMatchObject({ tops: 1, topAttempts: 4 });
  });

  it('defaults a missing topAttempts count to 1, not 0', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: null }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a'] };

    const result = scoreClassicTopsZones(attempts, config);

    expect(result[0]).toMatchObject({ tops: 1, topAttempts: 1 });
  });

  it('credits the zone when a problem is topped without an explicit zone flag, falling back to topAttempts for the count', () => {
    const attempts = [
      makeAttempt({
        registrationId: 'reg-a',
        problemId: 'p1',
        sequence: 1,
        top: true,
        topAttempts: 3,
        zone: false,
        zoneAttempts: null,
      }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a'] };

    const result = scoreClassicTopsZones(attempts, config);

    expect(result[0]).toMatchObject({ tops: 1, topAttempts: 3, zones: 1, zoneAttempts: 3 });
  });

  it('ignores attempts for a problem outside the round', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: 1 }),
      makeAttempt({ registrationId: 'reg-a', problemId: 'other-round-problem', sequence: 2, top: true, topAttempts: 1 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a'] };

    const result = scoreClassicTopsZones(attempts, config);

    expect(result[0]).toMatchObject({ tops: 1, topAttempts: 1 });
  });
});
