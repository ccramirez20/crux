import { describe, expect, it } from 'vitest';
import { buildTimezoneOptions, offsetFor } from './timezones';

// Fecha fija (fuera de cualquier horario de verano relevante) para que el
// test no dependa del día en que se corra.
const REFERENCE_DATE = new Date('2026-01-15T12:00:00Z');

describe('offsetFor', () => {
  it('da el formato UTC±H usado en la UI, no el GMT± del navegador', () => {
    expect(offsetFor('America/Bogota', REFERENCE_DATE)).toBe('UTC-5');
    expect(offsetFor('Asia/Kolkata', REFERENCE_DATE)).toBe('UTC+5:30');
  });
});

describe('buildTimezoneOptions', () => {
  it('ordena de más atrás a más adelante, no alfabético por continente', () => {
    const options = buildTimezoneOptions(REFERENCE_DATE);
    const offsets = options.map((o) => o.offset);
    const numeric = offsets.map((o) => {
      const match = /^UTC([+-])(\d{1,2})(?::(\d{2}))?$/.exec(o);
      if (!match) return 0;
      return (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] ?? 0));
    });
    expect(numeric).toEqual([...numeric].sort((a, b) => a - b));
  });

  it('incluye Colombia con el offset correcto', () => {
    const options = buildTimezoneOptions(REFERENCE_DATE);
    const colombia = options.find((o) => o.value === 'America/Bogota');
    expect(colombia?.label).toBe('UTC-5 · Colombia');
  });
});
