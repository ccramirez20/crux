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
export function roundHighlights(round: LeaderboardRound, unit: string, isHeight: boolean): Highlight[] {
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

  const out: Highlight[] = [];
  if (crux) {
    out.push({
      key: 'crux',
      label: `El ${unit} más duro`,
      what: `Cuál fue el ${unit} que menos gente pudo hacer`,
      value: `${unit.slice(0, 1).toUpperCase()}${crux.number}`,
      detail: `${problemName(crux.problemId) ?? 'Sin nombre'} · le hicieron top ${crux.tops} de ${crux.field}`,
    });
  }
  if (!isHeight) {
    out.push({
      key: 'flashes',
      label: 'Flashes de la ronda',
      what: 'De todos los tops, cuántos salieron al primer intento',
      value: totalTops > 0 ? `${Math.round((totalFlashes / totalTops) * 100)}%` : '—',
      detail: `${flashCount(totalFlashes)} de ${totalTops} tops en la ronda`,
    });
  }
  if (bestClimb && bestClimb.delta > 0) {
    out.push({
      key: 'climb',
      label: 'Mayor ascenso en la tabla',
      what: `Quién más puestos ascendió desde el primer ${unit}`,
      value: `+${bestClimb.delta}`,
      detail: `${bestClimb.name} subió ${bestClimb.delta} puestos en la tabla de posiciones`,
    });
  }

  // Siempre tres. En una final de cuatro personas nadie "asciende" —los cuatro
  // llegaron ahí y el orden apenas se mueve— y la fila se quedaba con dos
  // cifras estiradas en el ancho de tres. Los tops de la ronda existen siempre
  // y dicen algo que las otras dos no: cuánto se escaló en total.
  if (out.length < 3 && !isHeight) {
    // Un porcentaje y no una fracción: "6/16" obliga a preguntarse de dónde
    // sale el 16, y la respuesta —cada quien podía topar cada bloque— es una
    // multiplicación que nadie hace de pie en un gimnasio. El porcentaje se
    // entiende sin cuentas y el renglón de abajo explica el denominador en
    // palabras, por si alguien se lo pregunta.
    const posibles = round.rows.length * round.problems.length;
    const plural = round.problems.length === 1 ? unit : `${unit}s`;
    const conTop = stats.filter((stat) => stat.tops > 0).length;
    out.push({
      key: 'tops',
      // "Cuánto se topó" no: el verbo suena raro escrito. El sustantivo es el
      // que se usa en el gimnasio y es el que está en toda la pantalla.
      label: 'Tops logrados',
      what: 'De todos los tops que se podían hacer, cuántos se lograron',
      value: posibles > 0 ? `${Math.round((totalTops / posibles) * 100)}%` : '—',
      // En cuántos bloques cayó **algún** top es otra cosa que el porcentaje no
      // dice: un 38% puede ser mucha gente topando dos bloques fáciles o poca
      // gente repartida por todos. Con las dos cifras juntas se sabe cuál de
      // las dos ronda fue.
      // El renglón cambia con el momento del evento, que es lo que lo hace
      // útil en una pared: al empezar no hay ninguno, luego dice en cuántos ya
      // hay y en cuántos todavía no, y cuando todos tienen al menos uno lo
      // dice. Sin ese cambio, la misma frase serviría para las tres cosas y no
      // informaría de ninguna.
      detail:
        conTop === 0
          ? `Todavía no hay top en ninguno de los ${round.problems.length} ${plural} · ${posibles} posibles`
          : conTop === round.problems.length
            ? `${totalTops} tops · ya hubo top en los ${round.problems.length} ${plural}`
            : `${totalTops} tops · hay top en ${conTop} de ${round.problems.length} ${plural}, en ${round.problems.length - conTop} todavía no`,
    });
  }
  return out;
}

