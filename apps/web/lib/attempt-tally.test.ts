import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearTally, readTally, writeTally } from './attempt-tally';

// Un localStorage de mentira: lo que importa es la aritmética y que nada
// reviente, no la implementación del navegador.
function fakeStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    size: () => store.size,
  };
}

describe('attempt tally', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeStorage());
  });

  it('empieza en cero y cuenta por bloque y competidor', () => {
    expect(readTally('p1', 'reg-1')).toBe(0);
    writeTally('p1', 'reg-1', 3);
    expect(readTally('p1', 'reg-1')).toBe(3);
    // Otro competidor del mismo bloque lleva su propia cuenta.
    expect(readTally('p1', 'reg-2')).toBe(0);
    // Y el mismo competidor en otro bloque, también.
    expect(readTally('p2', 'reg-1')).toBe(0);
  });

  it('borrar deja el almacenamiento limpio, no un cero guardado', () => {
    const storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);
    writeTally('p1', 'reg-1', 2);
    expect(storage.size()).toBe(1);
    clearTally('p1', 'reg-1');
    expect(readTally('p1', 'reg-1')).toBe(0);
    // Si se quedaran las claves en cero, un evento de 25 personas por 5 bloques
    // deja 125 entradas muertas en el celular del juez.
    expect(storage.size()).toBe(0);
  });

  it('un valor corrupto se lee como cero en vez de propagarse', () => {
    localStorage.setItem('crux-tally:p1:reg-1', 'muchos');
    expect(readTally('p1', 'reg-1')).toBe(0);
  });

  it('no revienta si el almacenamiento falla', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
      removeItem: () => {
        throw new Error('bloqueado');
      },
    });
    expect(readTally('p1', 'reg-1')).toBe(0);
    expect(() => writeTally('p1', 'reg-1', 2)).not.toThrow();
  });
});
