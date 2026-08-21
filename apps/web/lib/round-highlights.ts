import { flashCount } from './labels';
import type { LeaderboardRound } from './leaderboard';

export interface Highlight {
  key: string;
  label: string;
  what: string;
  value: string;
  detail: string;
}

/**
 * Las tres cifras de la ronda, ya calculadas.
 *
 * Va aparte de la fila de tarjetas porque hay dos presentaciones: las tarjetas
 * de la página y la tira compacta de la pantalla de proyección. El cálculo es
 * el mismo y no puede vivir dos veces — es de lo poco en esta pantalla que
 * podría dar dos respuestas distintas sin que nadie lo note.
 */
// `feminine` porque "ruta" lo es y "bloque" no ("la ruta más dura" vs "el
// bloque más duro"); lo trae quien llama, que ya tiene `unit.article` a la
// mano (`problemUnit` en labels.ts), en vez de adivinarlo aquí por el texto.
export function roundHighlights(
  round: LeaderboardRound,
  unit: string,
  isHeight: boolean,
  feminine: boolean,
): Highlight[] {
  const stats = round.problemStats;
  const crux = [...stats].sort((a, b) => a.tops - b.tops)[0];
  const problemName = (id: string) => round.problems.find((p) => p.id === id)?.name;

  const totalTops = stats.reduce((sum, s) => sum + s.tops, 0);
  const totalFlashes = stats.reduce((sum, s) => sum + s.flashes, 0);

  const first = round.timeline[0];
  const last = round.timeline.at(-1);
  const bestClimb = round.rows
    .map((row) => ({
      name: row.athleteName,
      delta: (first?.ranks[row.registrationId] ?? 0) - (last?.ranks[row.registrationId] ?? 0),
    }))
    .sort((a, b) => b.delta - a.delta)[0];

  // Las mismas cuatro cifras en toda categoría, siempre en el mismo orden.
  // Antes cada una emitía solo si tenía algo que decir, y eso hacía que
  // femenina y masculina mostraran cosas distintas en la misma pantalla — desde
  // el fondo del salón eso se lee como que a una le falta información. Si una
  // no tiene nada que contar, lo dice; no desaparece.
  const posibles = round.rows.length * round.problems.length;
  const plural = round.problems.length === 1 ? unit : `${unit}s`;
  const conTop = stats.filter((stat) => stat.tops > 0).length;

  // `crux` sale de ordenar por tops y tomar el primero: con cero tops en toda
  // la ronda esto sigue dando un bloque (el primero del orden), no `undefined`.
  // Sin el `totalTops > 0` de abajo, una ronda recién creada mostraba "le
  // hicieron top 0 de N" en el bloque que fuera, como si ya hubiera datos.
  const hasCrux = crux !== undefined && totalTops > 0;
  const out: Highlight[] = [];
  out.push({
    key: 'crux',
    label: `${feminine ? 'La' : 'El'} ${unit} más dur${feminine ? 'a' : 'o'}`,
    what: `Cuál fue ${feminine ? 'la' : 'el'} ${unit} que menos gente pudo hacer`,
    value: hasCrux ? `${unit.slice(0, 1).toUpperCase()}${crux!.number}` : '—',
    detail: hasCrux
      ? `${problemName(crux!.problemId) ? `${problemName(crux!.problemId)} · ` : ''}le hicieron top ${crux!.tops} de ${crux!.field}`
      : `Todavía no hay ${plural} capturad${feminine ? 'as' : 'os'}`,
  });
  if (!isHeight) {
    out.push({
      key: 'flashes',
      label: 'Flashes de la ronda',
      what: 'De todos los tops, cuántos salieron al primer intento',
      value: totalTops > 0 ? `${Math.round((totalFlashes / totalTops) * 100)}%` : '—',
      detail:
        totalTops > 0
          ? `${flashCount(totalFlashes)} de ${totalTops} tops en la ronda`
          : 'Todavía no hay tops en la ronda',
    });
  }
  out.push({
    key: 'climb',
    label: 'Mayor ascenso en la tabla',
    what: `Quién más puestos ascendió desde ${feminine ? 'la primera' : 'el primer'} ${unit}`,
    value: bestClimb && bestClimb.delta > 0 ? `+${bestClimb.delta}` : '—',
    detail:
      bestClimb && bestClimb.delta > 0
        ? `${bestClimb.name} subió ${bestClimb.delta} puestos en la tabla de posiciones`
        : 'Nadie ha ganado puestos todavía',
  });
  // Sin nada específico de boulder (a diferencia de "flashes"): topar una ruta
  // cuenta igual que topar un bloque, así que esta sí aplica también en lead —
  // y de paso le da un tercer casillero a la tira de highlights en ese formato.
  out.push({
    key: 'tops',
    label: 'Tops logrados',
    what: 'De todos los tops que se podían hacer, cuántos se lograron',
    value: posibles > 0 ? `${Math.round((totalTops / posibles) * 100)}%` : '—',
    // El renglón cambia con el momento del evento, que es lo que lo hace útil
    // en una pared: al empezar no hay ninguno, luego dice en cuántos ya hay y
    // en cuántos todavía no, y cuando todos tienen al menos uno lo dice.
    detail:
      conTop === 0
        ? `Todavía no hay top en ningun${feminine ? 'a' : 'o'} de l${feminine ? 'as' : 'os'} ${round.problems.length} ${plural} · ${posibles} posibles`
        : conTop === round.problems.length
          ? `${totalTops} tops · ya hubo top en l${feminine ? 'as' : 'os'} ${round.problems.length} ${plural}`
          : `${totalTops} tops · hay top en ${conTop} de ${round.problems.length} ${plural}, en ${round.problems.length - conTop} todavía no`,
  });
  return out;
}

