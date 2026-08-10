import type { Attempt } from '@crux/core';
import { resolveCurrentAttempts } from './resolve-attempts';
import { assignRanks } from './rank-assignment';
import type { MaxHeightResult, RoundScoringConfig } from './types';

interface Aggregate {
  registrationId: string;
  height: number;
  top: boolean;
}

function aggregate(registrationId: string, currentAttempts: Attempt[]): Aggregate {
  const mine = currentAttempts.filter((a) => a.registrationId === registrationId);
  return {
    registrationId,
    height: mine.reduce((max, attempt) => Math.max(max, attempt.height ?? 0), 0),
    top: mine.some((attempt) => attempt.top),
  };
}

// Terminar la via gana sobre cualquier altura. El juez no captura la altura
// del final — la vive el muro, no la planilla — asi que un top con altura en
// blanco tiene que superar igual a quien se quedo a un movimiento. Entre dos
// tops hay empate: desempatarlos exige tiempos, que la etapa 1 no captura.
function compareAggregates(a: Aggregate, b: Aggregate): number {
  if (a.top !== b.top) {
    return a.top ? -1 : 1;
  }
  if (a.top && b.top) {
    return 0;
  }
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
    top: current.top,
  }));
}
