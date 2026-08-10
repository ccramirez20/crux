// Code is English, the interface is Spanish (es-CO). Every enum a person sees
// gets its wording here, so a round never shows up as "qualification" in one
// screen and "Clasificatoria" in another.

export const DISCIPLINE_LABEL: Record<string, string> = {
  boulder: 'Búlder',
  lead: 'Dificultad',
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
