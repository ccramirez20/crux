export interface RankedItem {
  rank: number;
  tied: boolean;
}

export function assignRanks<T>(
  sorted: T[],
  isTiedWithPrevious: (current: T, previous: T) => boolean,
): RankedItem[] {
  const ranks: number[] = [];
  for (let index = 0; index < sorted.length; index++) {
    const tiedWithPrevious = index > 0 && isTiedWithPrevious(sorted[index]!, sorted[index - 1]!);
    ranks.push(tiedWithPrevious ? ranks[index - 1]! : index + 1);
  }

  return ranks.map((rank, index) => {
    const sharesRankWithPrevious = index > 0 && rank === ranks[index - 1];
    const sharesRankWithNext = index < ranks.length - 1 && rank === ranks[index + 1];
    return { rank, tied: sharesRankWithPrevious || sharesRankWithNext };
  });
}
