import type { Attempt } from '@crux/core';
import { resolveCurrentAttempts } from './resolve-attempts';
import { assignRanks } from './rank-assignment';
import type { MaxHeightResult, RoundScoringConfig } from './types';

interface Aggregate {
  registrationId: string;
  height: number;
}

function aggregate(registrationId: string, currentAttempts: Attempt[]): Aggregate {
  const height = currentAttempts
    .filter((a) => a.registrationId === registrationId)
    .reduce((max, attempt) => Math.max(max, attempt.height ?? 0), 0);
  return { registrationId, height };
}

function compareAggregates(a: Aggregate, b: Aggregate): number {
  return b.height - a.height;
}

export function scoreMaxHeight(
  attempts: Attempt[],
  config: RoundScoringConfig,
): MaxHeightResult[] {
  const problemIds = new Set(config.problemIds);
  const currentAttempts = resolveCurrentAttempts(attempts, problemIds);

  const aggregates = config.registrationIds
    .map((registrationId) => aggregate(registrationId, currentAttempts))
    .sort(compareAggregates);

  const ranks = assignRanks(aggregates, (a, b) => compareAggregates(a, b) === 0);

  return aggregates.map((current, index) => ({
    format: 'max_height',
    rank: ranks[index]!.rank,
    tied: ranks[index]!.tied,
    registrationId: current.registrationId,
    height: current.height,
  }));
}
