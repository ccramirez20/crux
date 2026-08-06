import { describe, expect, it } from 'vitest';
import { assignRanks } from './rank-assignment';

describe('assignRanks', () => {
  it('ranks a fully distinct sorted list 1, 2, 3', () => {
    const sorted = [10, 8, 5];
    const result = assignRanks(sorted, (a, b) => a === b);
    expect(result).toEqual([
      { rank: 1, tied: false },
      { rank: 2, tied: false },
      { rank: 3, tied: false },
    ]);
  });

  it('gives a 2-member tie the same rank and skips the next rank by the group size', () => {
    const sorted = [10, 10, 5];
    const result = assignRanks(sorted, (a, b) => a === b);
    expect(result).toEqual([
      { rank: 1, tied: true },
      { rank: 1, tied: true },
      { rank: 3, tied: false },
    ]);
  });

  it('gives a 3-member tie the same rank and skips the next rank by the group size', () => {
    const sorted = [10, 10, 10, 5];
    const result = assignRanks(sorted, (a, b) => a === b);
    expect(result).toEqual([
      { rank: 1, tied: true },
      { rank: 1, tied: true },
      { rank: 1, tied: true },
      { rank: 4, tied: false },
    ]);
  });
});
