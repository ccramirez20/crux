import type { Attempt } from '@crux/core';
import { resolveCurrentAttempts } from './resolve-attempts';
import { assignRanks } from './rank-assignment';
import type { ClassicTopsZonesResult, RoundScoringConfig } from './types';

interface Aggregate {
  registrationId: string;
  tops: number;
  topAttempts: number;
  zones: number;
  zoneAttempts: number;
}

function aggregate(registrationId: string, currentAttempts: Attempt[]): Aggregate {
  const forRegistration = currentAttempts.filter((a) => a.registrationId === registrationId);
  let tops = 0;
  let topAttempts = 0;
  let zones = 0;
  let zoneAttempts = 0;
  for (const attempt of forRegistration) {
    if (attempt.top) {
      tops += 1;
      topAttempts += attempt.topAttempts ?? 1;
    }
    // Topping a problem necessarily passes the zone hold on the way, so it
    // always counts toward zones too, even if the judge row didn't also set
    // `zone: true`.
    if (attempt.zone || attempt.top) {
      zones += 1;
      zoneAttempts += attempt.zoneAttempts ?? attempt.topAttempts ?? 1;
    }
  }
  return { registrationId, tops, topAttempts, zones, zoneAttempts };
}

function compareAggregates(a: Aggregate, b: Aggregate): number {
  if (a.tops !== b.tops) return b.tops - a.tops;
  if (a.topAttempts !== b.topAttempts) return a.topAttempts - b.topAttempts;
  if (a.zones !== b.zones) return b.zones - a.zones;
  return a.zoneAttempts - b.zoneAttempts;
}

export function scoreClassicTopsZones(
  attempts: Attempt[],
  config: RoundScoringConfig,
): ClassicTopsZonesResult[] {
  const problemIds = new Set(config.problemIds);
  const currentAttempts = resolveCurrentAttempts(attempts, problemIds);

  const aggregates = config.registrationIds
    .map((registrationId) => aggregate(registrationId, currentAttempts))
    .sort(compareAggregates);

  const ranks = assignRanks(aggregates, (a, b) => compareAggregates(a, b) === 0);

  return aggregates.map((current, index) => ({
    format: 'classic_tops_zones',
    rank: ranks[index]!.rank,
    tied: ranks[index]!.tied,
    registrationId: current.registrationId,
    tops: current.tops,
    topAttempts: current.topAttempts,
    zones: current.zones,
    zoneAttempts: current.zoneAttempts,
  }));
}
