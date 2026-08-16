import { describe, expect, it } from 'vitest';
import { resolveSelectedOrganization } from './organizations';

const paramo = { id: 'a', name: 'Gimnasio Páramo' };
const crux = { id: 'b', name: 'Crux Competencias' };

describe('resolveSelectedOrganization', () => {
  it('devuelve la que nombra la cookie', () => {
    expect(resolveSelectedOrganization([paramo, crux], 'b')).toBe(crux);
  });

  it('sin cookie se queda con la primera', () => {
    expect(resolveSelectedOrganization([paramo, crux], undefined)).toBe(paramo);
  });

  it('una cookie que nombra una organización ajena no deja el panel vacío', () => {
    // Es el caso que importa: la cookie sobrevive a cambiar de cuenta, y si se
    // respetara a ciegas el panel filtraría por una organización que no es de
    // quien entró y no mostraría ningún evento.
    expect(resolveSelectedOrganization([paramo], 'b')).toBe(paramo);
  });

  it('sin organizaciones no inventa ninguna', () => {
    expect(resolveSelectedOrganization([], 'b')).toBeUndefined();
  });
});
