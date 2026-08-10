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
export function problemUnit(discipline: string): { singular: string; plural: string } {
  return discipline === 'boulder'
    ? { singular: 'bloque', plural: 'bloques' }
    : { singular: 'ruta', plural: 'rutas' };
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
