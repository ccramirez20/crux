import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REGISTRATION_MAX,
  REGISTRATION_WINDOW_MS,
  clientKey,
  isRateLimited,
  recordAttempt,
  resetRateLimits,
} from './rate-limit';

describe('rate limit del código de juez', () => {
  beforeEach(() => {
    resetRateLimits();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('deja pasar hasta el quinto fallo y bloquea el siguiente', () => {
    for (let i = 0; i < 4; i += 1) {
      recordAttempt('1.2.3.4');
      expect(isRateLimited('1.2.3.4')).toBe(false);
    }
    recordAttempt('1.2.3.4');
    expect(isRateLimited('1.2.3.4')).toBe(true);
  });

  it('no bloquea a otro teléfono por los fallos del primero', () => {
    for (let i = 0; i < 5; i += 1) {
      recordAttempt('1.2.3.4');
    }
    expect(isRateLimited('5.6.7.8')).toBe(false);
  });

  it('se libera al pasar la ventana', () => {
    for (let i = 0; i < 5; i += 1) {
      recordAttempt('1.2.3.4');
    }
    vi.advanceTimersByTime(5 * 60_000 + 1);
    expect(isRateLimited('1.2.3.4')).toBe(false);

    // Y el primer fallo después de la ventana empieza a contar de cero, no
    // sobre el conteo viejo.
    recordAttempt('1.2.3.4');
    expect(isRateLimited('1.2.3.4')).toBe(false);
  });

  it('toma la primera IP de x-forwarded-for y cae a local sin proxy', () => {
    const proxied = new Request('http://x/api', {
      headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' },
    });
    expect(clientKey(proxied.headers)).toBe('9.9.9.9');
    expect(clientKey(new Request('http://x/api').headers)).toBe('local');
  });
});

// La inscripción usa el mismo contador con otra ventana y otro tope. Lo que se
// prueba aquí es justo eso: que el tope suelto no arrastre al del juez, y que la
// ventana larga sobreviva a la corta.
describe('freno de la inscripción pública', () => {
  beforeEach(() => {
    resetRateLimits();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('deja pasar el tope de inscripciones y bloquea la siguiente', () => {
    for (let i = 0; i < REGISTRATION_MAX; i += 1) {
      expect(isRateLimited('reg:1.2.3.4', REGISTRATION_MAX)).toBe(false);
      recordAttempt('reg:1.2.3.4', REGISTRATION_WINDOW_MS);
    }
    expect(isRateLimited('reg:1.2.3.4', REGISTRATION_MAX)).toBe(true);
  });

  it('no frena al juez de la misma IP, ni al revés', () => {
    for (let i = 0; i < REGISTRATION_MAX; i += 1) {
      recordAttempt('reg:1.2.3.4', REGISTRATION_WINDOW_MS);
    }
    expect(isRateLimited('1.2.3.4')).toBe(false);
  });

  it('sigue frenada pasada la ventana corta del juez', () => {
    for (let i = 0; i < REGISTRATION_MAX; i += 1) {
      recordAttempt('reg:1.2.3.4', REGISTRATION_WINDOW_MS);
    }
    vi.advanceTimersByTime(5 * 60_000 + 1);
    expect(isRateLimited('reg:1.2.3.4', REGISTRATION_MAX)).toBe(true);

    vi.advanceTimersByTime(REGISTRATION_WINDOW_MS);
    expect(isRateLimited('reg:1.2.3.4', REGISTRATION_MAX)).toBe(false);
  });
});
