import { describe, expect, it } from 'vitest';
import { buildMonthGrid, daysInMonth, firstWeekdayOfMonth, parseIsoDate, toIsoDate } from './calendar-grid';

describe('parseIsoDate', () => {
  it('parte un yyyy-mm-dd válido en año/mes (0-11)/día', () => {
    expect(parseIsoDate('2026-03-15')).toEqual({ year: 2026, month: 2, day: 15 });
  });

  it('no acepta nada que no calce con el formato', () => {
    expect(parseIsoDate('')).toBeNull();
    expect(parseIsoDate('15/03/2026')).toBeNull();
  });
});

describe('daysInMonth', () => {
  it('sabe de años bisiestos', () => {
    expect(daysInMonth(2024, 1)).toBe(29); // febrero 2024
    expect(daysInMonth(2023, 1)).toBe(28); // febrero 2023
  });
});

describe('buildMonthGrid', () => {
  it('rellena con celdas vacías antes del día 1 y arma el resto en UTC', () => {
    const grid = buildMonthGrid(2026, 2); // marzo 2026
    const offset = firstWeekdayOfMonth(2026, 2);
    expect(grid.slice(0, offset).every((cell) => cell === null)).toBe(true);
    expect(grid.length).toBe(offset + daysInMonth(2026, 2));
    expect(grid[offset]).toEqual({ year: 2026, month: 2, day: 1, iso: '2026-03-01' });
    expect(grid.at(-1)).toEqual({ year: 2026, month: 2, day: 31, iso: '2026-03-31' });
  });

  it('toIsoDate rellena con ceros', () => {
    expect(toIsoDate(2026, 0, 5)).toBe('2026-01-05');
  });
});
