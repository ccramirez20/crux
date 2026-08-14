import { describe, expect, it } from 'vitest';
import { isRegistrationOpen, todayIn } from './registration-window';

// La zona importa: Bogotá es UTC-5, así que a las 02:00 UTC del día 31 en
// Bogotá todavía son las 21:00 del 30. Un cierre "el 30" no puede echar a
// alguien que se inscribe cuando en el gimnasio aún es 30.
const BOGOTA = 'America/Bogota';

describe('isRegistrationOpen', () => {
  it('sin fecha límite no cierra nunca', () => {
    expect(isRegistrationOpen(null, BOGOTA, new Date('2030-01-01T00:00:00Z'))).toBe(true);
  });

  it('el día de la fecha límite sigue abierto', () => {
    // Mediodía en Bogotá del propio 30.
    expect(isRegistrationOpen('2026-08-30', BOGOTA, new Date('2026-08-30T17:00:00Z'))).toBe(true);
  });

  it('cierra al pasar el día', () => {
    // Mediodía en Bogotá del 31.
    expect(isRegistrationOpen('2026-08-30', BOGOTA, new Date('2026-08-31T17:00:00Z'))).toBe(false);
  });

  it('usa la zona del evento y no la del servidor', () => {
    // 02:00 UTC del 31 = 21:00 del 30 en Bogotá. En UTC ya pasó el límite;
    // en el gimnasio no. Manda el gimnasio.
    const instante = new Date('2026-08-31T02:00:00Z');
    expect(isRegistrationOpen('2026-08-30', BOGOTA, instante)).toBe(true);
    expect(isRegistrationOpen('2026-08-30', 'UTC', instante)).toBe(false);
  });

  it('sigue abierto días antes', () => {
    expect(isRegistrationOpen('2026-08-30', BOGOTA, new Date('2026-08-01T17:00:00Z'))).toBe(true);
  });
});

describe('todayIn', () => {
  it('devuelve la fecha en formato yyyy-mm-dd', () => {
    expect(todayIn(BOGOTA, new Date('2026-08-31T02:00:00Z'))).toBe('2026-08-30');
    expect(todayIn('UTC', new Date('2026-08-31T02:00:00Z'))).toBe('2026-08-31');
  });
});
