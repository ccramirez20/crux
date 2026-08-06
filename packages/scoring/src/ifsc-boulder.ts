import type { Attempt } from '@crux/core';
import { resolveCurrentAttempts } from './resolve-attempts';
import { assignRanks } from './rank-assignment';
import type { IfscBoulderResult, RoundScoringConfig } from './types';

const TOP_VALUE_TENTHS = 250; // 25.0 points
const ZONE_VALUE_TENTHS = 100; // 10.0 points
const DEDUCTION_PER_ATTEMPT_TENTHS = 1; // 0.1 points

interface Aggregate {
  registrationId: string;
  scoreTenths: number;
}

function problemScoreTenths(attempt: Attempt): number {
  let scoreTenths = 0;
  if (attempt.top) {
    const topAttemptsUsed = attempt.topAttempts ?? 1;
    scoreTenths += Math.max(0, TOP_VALUE_TENTHS - (topAttemptsUsed - 1) * DEDUCTION_PER_ATTEMPT_TENTHS);
  }
  // Topping a problem necessarily passes the zone hold on the way, so it
  // always counts toward the zone score too, same rule as classic_tops_zones.
  if (attempt.zone || attempt.top) {
    const zoneAttemptsUsed = attempt.zoneAttempts ?? attempt.topAttempts ?? 1;
    scoreTenths += Math.max(0, ZONE_VALUE_TENTHS - (zoneAttemptsUsed - 1) * DEDUCTION_PER_ATTEMPT_TENTHS);
  }
  return scoreTenths;
}

function aggregate(registrationId: string, currentAttempts: Attempt[]): Aggregate {
  const scoreTenths = currentAttempts
    .filter((a) => a.registrationId === registrationId)
    .reduce((total, attempt) => total + problemScoreTenths(attempt), 0);
  return { registrationId, scoreTenths };
}

function compareAggregates(a: Aggregate, b: Aggregate): number {
  return b.scoreTenths - a.scoreTenths;
}

export function scoreIfscBoulder(
  attempts: Attempt[],
  config: RoundScoringConfig,
): IfscBoulderResult[] {
  const problemIds = new Set(config.problemIds);
  const currentAttempts = resolveCurrentAttempts(attempts, problemIds);

  const aggregates = config.registrationIds
    .map((registrationId) => aggregate(registrationId, currentAttempts))
    .sort(compareAggregates);

  const ranks = assignRanks(aggregates, (a, b) => compareAggregates(a, b) === 0);

  return aggregates.map((current, index) => ({
    format: 'ifsc_boulder',
    rank: ranks[index]!.rank,
    tied: ranks[index]!.tied,
    registrationId: current.registrationId,
    score: current.scoreTenths / 10,
  }));
}
