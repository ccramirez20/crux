import { describe, expect, it } from 'vitest';
import { slugify } from './slug';

describe('slugify', () => {
  it('quita las tildes en vez de tratarlas como separador', () => {
    // El caso que motivó la función: antes salía "liga-p-ramo", y ese texto
    // termina impreso en los QR pegados a la pared.
    expect(slugify('Liga Páramo')).toBe('liga-paramo');
    expect(slugify('Copa Nariño')).toBe('copa-narino');
    expect(slugify('Sesión Única')).toBe('sesion-unica');
  });

  it('junta separadores y no deja guiones sueltos en las puntas', () => {
    expect(slugify('  Copa   Suesca  ')).toBe('copa-suesca');
    expect(slugify('Liga Páramo · Fecha 2')).toBe('liga-paramo-fecha-2');
    expect(slugify('¡Copa!')).toBe('copa');
  });

  it('devuelve vacío cuando no queda nada utilizable', () => {
    // Quien reciba esto tiene que rechazarlo: un evento sin enlace no se puede
    // compartir, y el nombre es lo único que lo genera.
    expect(slugify('¡¡¡')).toBe('');
    expect(slugify('   ')).toBe('');
  });
});
