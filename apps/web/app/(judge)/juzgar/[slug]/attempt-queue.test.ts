import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { newClientAttemptId, syncOutcome, type SyncOutcome } from './attempt-queue';

// El mismo esquema con el que el servidor valida la llave en
// app/api/attempts/route.ts. Un id que no pase por aqui se vuelve un 400, y un
// 400 saca el intento de la cola: la captura se pierde sin ruido.
const uuidSchema = z.string().uuid();

describe('newClientAttemptId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('usa crypto.randomUUID cuando el contexto es seguro', () => {
    vi.stubGlobal('crypto', { randomUUID: () => '11111111-2222-4333-8444-555555555555' });

    expect(newClientAttemptId()).toBe('11111111-2222-4333-8444-555555555555');
  });

  // Este es el camino que corre de verdad el dia del evento: el juez entra por
  // http a una IP de LAN, no hay contexto seguro, y crypto.randomUUID no
  // existe. Es el unico de los dos que armamos a mano, asi que es el unico que
  // puede estar mal.
  it('arma un v4 valido sin crypto.randomUUID', () => {
    const getRandomValues = crypto.getRandomValues.bind(crypto);
    vi.stubGlobal('crypto', { getRandomValues });

    for (let i = 0; i < 100; i++) {
      const id = newClientAttemptId();
      expect(uuidSchema.safeParse(id).success).toBe(true);
      // Los dos nibbles que el respaldo fija a mano: version en la posicion 14,
      // variante en la 19. Sin ellos sale hex aleatorio que parece un UUID y no
      // lo es.
      expect(id[14]).toBe('4');
      expect('89ab').toContain(id[19]);
    }
  });

  // La llave es lo unico que hace idempotente el reenvio: dos capturas con el
  // mismo id serian una sola fila en la base.
  it('no repite', () => {
    const ids = new Set(Array.from({ length: 500 }, () => newClientAttemptId()));

    expect(ids.size).toBe(500);
  });
});

describe('syncOutcome', () => {
  const cases: [number | 'offline', SyncOutcome][] = [
    [200, 'delivered'],
    [201, 'delivered'],
    [400, 'rejected'],
    [403, 'ask-for-code'],
    ['offline', 'stop'],
    [500, 'stop'],
    [502, 'stop'],
  ];

  it.each(cases)('%s da %s', (status, expected) => {
    expect(syncOutcome(status)).toBe(expected);
  });

  // El unico caso donde el servidor y el cliente tienen que estar de acuerdo o
  // se pierden capturas reales: la ruta contesta 429 y no 403 justamente para
  // que el freno sea temporal. Si alguien lo pasa al lado terminal, la cola de
  // un juez frenado se vacia sin que nada haya llegado.
  it('trata el 429 como temporal y deja los intentos en la cola', () => {
    expect(syncOutcome(429)).toBe('stop');
  });
});
