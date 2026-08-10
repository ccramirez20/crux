import { describe, expect, it } from 'vitest';
import { scoreMaxHeight } from './max-height';
import { makeAttempt } from './test-support';

describe('scoreMaxHeight', () => {
  it('ranks a higher height first', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, height: 12.5 }),
      makeAttempt({ registrationId: 'reg-b', problemId: 'p1', sequence: 2, height: 8 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a', 'reg-b'] };

    const result = scoreMaxHeight(attempts, config);

    expect(result.map((r) => [r.registrationId, r.height])).toEqual([
      ['reg-a', 12.5],
      ['reg-b', 8],
    ]);
  });

  it('uses the max height across multiple problems in the round, not the sum or the first', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, height: 10 }),
      makeAttempt({ registrationId: 'reg-a', problemId: 'p2', sequence: 2, height: 15 }),
    ];
    const config = { problemIds: ['p1', 'p2'], registrationIds: ['reg-a'] };

    const result = scoreMaxHeight(attempts, config);

    expect(result[0]).toMatchObject({ height: 15 });
  });

  it('treats a missing height as 0', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, height: null }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a'] };

    const result = scoreMaxHeight(attempts, config);

    expect(result[0]).toMatchObject({ height: 0 });
  });

  it('gives a real tie at an identical decimal height the same rank', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, height: 14.5 }),
      makeAttempt({ registrationId: 'reg-b', problemId: 'p1', sequence: 2, height: 14.5 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a', 'reg-b'] };

    const result = scoreMaxHeight(attempts, config);

    expect(result.map((r) => [r.rank, r.tied])).toEqual([[1, true], [1, true]]);
  });

  it('ranks a top above every height, even with no height recorded', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, height: 19.9 }),
      makeAttempt({ registrationId: 'reg-b', problemId: 'p1', sequence: 2, top: true, height: null }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a', 'reg-b'] };

    const result = scoreMaxHeight(attempts, config);

    expect(result.map((r) => [r.registrationId, r.rank, r.tied])).toEqual([
      ['reg-b', 1, false],
      ['reg-a', 2, false],
    ]);
  });

  it('ties two tops even when their recorded heights differ', () => {
    // Uno de los dos jueces anoto altura ademas del top y el otro no. Eso es
    // ruido de captura: los dos terminaron la via.
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, height: 20 }),
      makeAttempt({ registrationId: 'reg-b', problemId: 'p1', sequence: 2, top: true, height: null }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a', 'reg-b'] };

    const result = scoreMaxHeight(attempts, config);

    expect(result.map((r) => [r.rank, r.tied])).toEqual([[1, true], [1, true]]);
  });

  it('keeps a top from an earlier route in the round', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true }),
      makeAttempt({ registrationId: 'reg-a', problemId: 'p2', sequence: 2, height: 4 }),
    ];
    const config = { problemIds: ['p1', 'p2'], registrationIds: ['reg-a'] };

    const result = scoreMaxHeight(attempts, config);

    expect(result[0]).toMatchObject({ top: true, height: 4 });
  });

  it('ranks a registration with zero attempts last, at height 0', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, height: 10 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a', 'reg-dns'] };

    const result = scoreMaxHeight(attempts, config);

    expect(result.map((r) => r.registrationId)).toEqual(['reg-a', 'reg-dns']);
    expect(result[1]).toMatchObject({ height: 0 });
  });
});
