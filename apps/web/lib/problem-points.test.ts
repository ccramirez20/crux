import { describe, expect, it } from 'vitest';
import { leagueBlockNeedsPoints } from './problem-points';

describe('leagueBlockNeedsPoints', () => {
  it('rechaza un bloque de liga sin puntos de top', () => {
    expect(leagueBlockNeedsPoints('league_points', undefined)).toBe(true);
  });

  it('acepta cero, que es un valor y no una ausencia', () => {
    // Un bloque de calentamiento que no suma es una decisión legítima del
    // organizador. Confundirlo con "se le olvidó" le quitaría la opción.
    expect(leagueBlockNeedsPoints('league_points', 0)).toBe(false);
  });

  it('acepta un bloque de liga con puntos', () => {
    expect(leagueBlockNeedsPoints('league_points', 600)).toBe(false);
  });

  it('no le exige puntos a los formatos que no puntúan por bloque', () => {
    // En estos tres el campo ni siquiera se dibuja: exigirlo dejaría al
    // organizador sin poder crear un bloque.
    expect(leagueBlockNeedsPoints('classic_tops_zones', undefined)).toBe(false);
    expect(leagueBlockNeedsPoints('ifsc_boulder', undefined)).toBe(false);
    expect(leagueBlockNeedsPoints('max_height', undefined)).toBe(false);
  });
});
