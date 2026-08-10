import { describe, expect, it } from 'vitest';
import { parseHeight } from './height';

describe('parseHeight', () => {
  it('acepta coma como separador decimal', () => {
    // El caso que se cayó en el teléfono: el teclado en español da coma.
    expect(parseHeight('18,5')).toBe(18.5);
    expect(parseHeight('18.5')).toBe(18.5);
  });

  it('acepta enteros y espacios alrededor', () => {
    expect(parseHeight('12')).toBe(12);
    expect(parseHeight('  20  ')).toBe(20);
    expect(parseHeight('0')).toBe(0);
  });

  it('rechaza lo que no es una altura en vez de inventarse un número', () => {
    for (const raw of ['', '   ', 'abc', '18,5,5', '18..5', '1e3', '0x10', '-4', '.5', '5.']) {
      expect(parseHeight(raw), raw).toBeNull();
    }
  });
});
