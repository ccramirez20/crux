import { describe, expect, it } from 'vitest';
import { shortName } from './short-name';

describe('shortName', () => {
  it('un solo nombre se queda igual, sin punto', () => {
    expect(shortName('Madonna')).toBe('Madonna');
  });

  it('dos tokens: nombre + inicial', () => {
    expect(shortName('Laura Sarabria')).toBe('Laura S.');
  });

  it('tres tokens: nombre + dos iniciales', () => {
    expect(shortName('Andrés Felipe Torres')).toBe('Andrés F. T.');
  });

  it('cuatro o más tokens: nunca pasa de tres palabras', () => {
    expect(shortName('María Fernanda Restrepo Villalobos')).toBe('María F. R.');
  });
});
