import type { Attempt } from '@crux/core';
import { resolveCurrentAttempts } from './resolve-attempts';
import { assignRanks } from './rank-assignment';
import type { LeaguePointsResult, RoundScoringConfig } from './types';

interface Aggregate {
  registrationId: string;
  score: number;
}

function problemScore(
  attempt: Attempt,
  points: { topPoints: number; zonePoints: number | null } | undefined,
): number {
  if (attempt.top) {
    return points?.topPoints ?? 0;
  }
  if (attempt.zone && points?.zonePoints != null) {
    return points.zonePoints;
  }
  return 0;
}

function aggregate(
  registrationId: string,
  currentAttempts: Attempt[],
  problemPoints: RoundScoringConfig['problemPoints'],
): Aggregate {
  const score = currentAttempts
    .filter((a) => a.registrationId === registrationId)
    .reduce((total, attempt) => total + problemScore(attempt, problemPoints?.[attempt.problemId]), 0);
  return { registrationId, score };
}

function compareAggregates(a: Aggregate, b: Aggregate): number {
  return b.score - a.score;
}

export function scoreLeaguePoints(
  attempts: Attempt[],
  config: RoundScoringConfig,
): LeaguePointsResult[] {
  const problemIds = new Set(config.problemIds);
  const currentAttempts = resolveCurrentAttempts(attempts, problemIds);

  const aggregates = config.registrationIds
    .map((registrationId) => aggregate(registrationId, currentAttempts, config.problemPoints))
    .sort(compareAggregates);

  const ranks = assignRanks(aggregates, (a, b) => compareAggregates(a, b) === 0);

  return aggregates.map((current, index) => ({
    format: 'league_points',
    rank: ranks[index]!.rank,
    tied: ranks[index]!.tied,
    registrationId: current.registrationId,
    score: current.score,
  }));
}
