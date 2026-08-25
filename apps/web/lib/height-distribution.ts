import type { LeaderboardRound } from './leaderboard';

/**
 * Dónde se quedó, por ruta, quien no topó — el análogo en lead de "intentos
 * al top": ahí no hay un intento que se repita sobre la misma ruta, pero sí
 * queda la altura que alcanzó cada quien.
 *
 * Sin longitud de ruta guardada en la base, la única referencia disponible es
 * relativa: la altura más alta que registró cualquiera en esa ruta (topeara
 * o no). Tres tramos contra esa referencia: `buckets[0]` cerca de la cima
 * (≥66%), `buckets[1]` a mitad de vía (33-66%), `buckets[2]` en la parte baja
 * de la ruta (<33%) — sin juzgar el intento, solo dice dónde se quedó.
 *
 * Con menos de dos alturas registradas entre quienes no toparon, o si cubren
 * menos de la mitad de ellos (jueces que solo marcan top/no-top sin número),
 * el bloque cae a `'top-only'` — sin inventar detalle con uno o dos datos
 * sueltos.
 */
export interface HeightBuckets {
  problemId: string;
  mode: 'buckets';
  /** [cerca de la cima, a mitad de vía, parte baja de la ruta] */
  buckets: [number, number, number];
}

export interface HeightTopOnly {
  problemId: string;
  mode: 'top-only';
}

export type ProblemHeightDist = HeightBuckets | HeightTopOnly;

export function heightDistribution(round: LeaderboardRound): ProblemHeightDist[] {
  return round.problems.map((problem) => {
    const cells = round.rows.flatMap((row) => row.cells.filter((cell) => cell.problemId === problem.id));
    const rest = cells.filter((cell) => !cell.top);
    const withHeight = rest.filter((cell) => cell.height !== null && cell.height > 0);

    if (withHeight.length < 2 || withHeight.length / rest.length < 0.5) {
      return { problemId: problem.id, mode: 'top-only' };
    }

    const reference = Math.max(...cells.flatMap((cell) => (cell.height ? [cell.height] : [])));
    const buckets: [number, number, number] = [0, 0, 0];
    for (const cell of withHeight) {
      const ratio = cell.height! / reference;
      buckets[ratio >= 0.66 ? 0 : ratio >= 0.33 ? 1 : 2]++;
    }
    return { problemId: problem.id, mode: 'buckets', buckets };
  });
}
