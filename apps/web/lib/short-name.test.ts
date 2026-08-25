import { describe, expect, it } from 'vitest';
import { fitName, shortName } from './short-name';

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

describe('fitName', () => {
  it('un solo nombre se queda igual', () => {
    expect(fitName('Madonna')).toBe('Madonna');
  });

  it('dos o tres tokens: se queda igual, sin abreviar nada', () => {
    expect(fitName('Laura Sarabria')).toBe('Laura Sarabria');
    expect(fitName('Andrés Felipe Torres')).toBe('Andrés Felipe Torres');
  });

  it('cuatro tokens: solo el último se abrevia a inicial', () => {
    expect(fitName('María Fernanda Restrepo Villalobos')).toBe('María Fernanda Restrepo V.');
  });

  it('cinco tokens: sigue siendo solo el último', () => {
    expect(fitName('Ana María Del Pilar Restrepo')).toBe('Ana María Del Pilar R.');
  });
});
