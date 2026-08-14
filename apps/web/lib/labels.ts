// Code is English, the interface is Spanish (es-CO). Every enum a person sees
// gets its wording here, so a round never shows up as "qualification" in one
// screen and "Clasificatoria" in another.

// Las dos palabras, siempre juntas y en este orden. En el gimnasio se dice
// "boulder" y "lead"; en la inscripción de una liga se lee "bloque" y
// "dificultad". Quien solo conoce una de las dos igual se ubica, y nadie tiene
// que adivinar que son lo mismo. Nunca "búlder" castellanizado.
// 'speed' / 'velocidad' entra aquí el día que la modalidad exista — hoy está
// aplazada, ver el comentario de `disciplineEnum` en packages/db.
export const DISCIPLINE_LABEL: Record<string, string> = {
  boulder: 'Boulder / Bloque',
  lead: 'Lead / Dificultad',
};

// El titular de la portada. Vive aquí porque sale en tres sitios —el h1, el
// `openGraph.description` y la tarjeta que se dibuja al compartir el enlace— y
// que los tres digan cosas distintas es el defecto que se cuela solo.
// "Pegue" es la palabra que se usa en el gimnasio; escribirla es la señal de
// que esto lo hizo alguien que escala, no un proveedor de software.
// Se guarda partido en frases, no como una cadena: son tres golpes y la
// portada necesita poder darle una línea a cada uno. Calibrar un `max-width`
// en `ch` para conseguir el mismo corte depende de las métricas de la fuente y
// se rompe al cambiarla.
export const HEADLINE_LINES = ['Todos los bloques.', 'Todos los pegues.', 'Una sola tabla.'];

export const HEADLINE = HEADLINE_LINES.join(' ');

export const ROUND_TYPE_LABEL: Record<string, string> = {
  qualification: 'Clasificatoria',
  semifinal: 'Semifinal',
  final: 'Final',
};

export const SCORING_FORMAT_LABEL: Record<string, string> = {
  ifsc_boulder: 'Puntos IFSC de bloque',
  classic_tops_zones: 'Conteo clásico de tops y zonas',
  league_points: 'Puntos por bloque, estilo liga local',
  max_height: 'Altura máxima en dificultad',
};

export const GENDER_LABEL: Record<string, string> = {
  male: 'Masculino',
  female: 'Femenino',
  mixed: 'Mixta',
};

export function labelFor(map: Record<string, string>, value: string): string {
  return map[value] ?? value;
}

// En el código todo es `Problem`, pero en el gimnasio nadie llama "bloque" a una
// vía de cuerda. Boulder tiene bloques; todo lo que se escala con cuerda tiene
// rutas. Aquí sí va una sola palabra: la unidad puntuable se nombra decenas de
// veces por pantalla y "bloque / ruta" en cada una sería ruido.
export function problemUnit(discipline: string): { singular: string; plural: string; article: string } {
  // El artículo va aquí y no en la pantalla: "el bloque 1" y "la ruta 1" son la
  // misma frase, y sin esto cada rótulo que la arme termina escribiendo "el
  // ruta 1".
  return discipline === 'boulder'
    ? { singular: 'bloque', plural: 'bloques', article: 'el' }
    : { singular: 'ruta', plural: 'rutas', article: 'la' };
}

// Vocabulario de puntaje. En el gimnasio nadie dice "toparon" — se dice que
// alguien "hizo top", y un top a primer intento es un flash, no "un top a
// primer intento". La tabla y las gráficas comparten estas palabras, así que
// viven aquí y no sueltas en cada pantalla.
export const SCORE_TERM = {
  top: 'Top',
  zone: 'Zona',
  noTop: 'Sin top',
  flash: 'flash',
} as const;

/** "11 flash", "1 flash" — la palabra no cambia en plural. */
export function flashCount(count: number): string {
  return `${count} ${SCORE_TERM.flash}`;
}

/**
 * Lo que hizo un competidor en un bloque, en una frase. La tabla pública y el
 * perfil del competidor tienen que decirlo con las mismas palabras: si en una
 * pantalla se lee "Top en 3 · Zona en 1" y en la otra otra cosa, parecen dos
 * datos distintos.
 */
export function attemptSummary(
  cell:
    | { top: boolean; topAttempts: number | null; zone: boolean; zoneAttempts: number | null; height: number | null }
    | undefined,
  isHeight: boolean,
): string {
  if (!cell) {
    return 'Sin registro';
  }
  if (cell.top) {
    // Un top pasa por la zona en el camino, así que el detalle dice las dos
    // cosas: es lo que suman las dos columnas de intentos de la tabla, y sin la
    // segunda el número de zonas no reconciliaba con nada. Si el juez no anotó
    // la zona aparte, cuenta en el mismo intento del top — que es exactamente
    // lo que hace el scoring.
    return isHeight
      ? 'Llegó al top'
      : `${SCORE_TERM.top} en ${cell.topAttempts ?? 1} · ${SCORE_TERM.zone} en ${cell.zoneAttempts ?? cell.topAttempts ?? 1}`;
  }
  if (cell.zone) {
    return `${SCORE_TERM.zone} en ${cell.zoneAttempts ?? 1}`;
  }
  if (cell.height !== null) {
    return `${cell.height} m`;
  }
  return 'Sin zona';
}

/**
 * Ordinal en español: "1.º", "12.º". Con punto antes de la o volada, que es
 * como se escribe en es-CO — ni "1°" (que es grado) ni "1er".
 */
export function ordinal(place: number): string {
  return `${place}.º`;
}

/** Reads a date-only column (yyyy-mm-dd) without letting the local timezone shift the day. */
export function formatEventDate(date: string | null): string | null {
  if (!date) {
    return null;
  }
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
