// Aritmética pura para dibujar una grilla de mes. Todo en UTC a propósito:
// construir un `Date` desde un string 'yyyy-mm-dd' y leerlo con getters
// locales corre el riesgo clásico de perder un día según la zona del
// navegador. Aquí nunca se pasa por un `Date` local — el valor de entrada se
// parte a mano y la grilla se calcula con `Date.UTC`.

export interface CalendarCell {
  year: number;
  month: number; // 0-11
  day: number;
  iso: string;
}

export function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
}

export function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function daysInMonth(year: number, month: number): number {
  // El día 0 del mes siguiente es el último día de este mes.
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** 0 = lunes … 6 = domingo, para que la grilla empiece la semana en lunes. */
export function firstWeekdayOfMonth(year: number, month: number): number {
  const sundayFirst = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return (sundayFirst + 6) % 7;
}

/** Celdas vacías (relleno antes del día 1) más una por cada día del mes. */
export function buildMonthGrid(year: number, month: number): (CalendarCell | null)[] {
  const cells: (CalendarCell | null)[] = new Array(firstWeekdayOfMonth(year, month)).fill(null);
  for (let day = 1; day <= daysInMonth(year, month); day++) {
    cells.push({ year, month, day, iso: toIsoDate(year, month, day) });
  }
  return cells;
}
