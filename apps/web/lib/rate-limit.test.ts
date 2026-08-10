import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clientKey, isRateLimited, recordFailure, resetRateLimits } from './rate-limit';

describe('rate limit del código de juez', () => {
  beforeEach(() => {
    resetRateLimits();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('deja pasar hasta el décimo fallo y bloquea el siguiente', () => {
    for (let i = 0; i < 9; i += 1) {
      recordFailure('1.2.3.4');
      expect(isRateLimited('1.2.3.4')).toBe(false);
    }
    recordFailure('1.2.3.4');
    expect(isRateLimited('1.2.3.4')).toBe(true);
  });

  it('no bloquea a otro teléfono por los fallos del primero', () => {
    for (let i = 0; i < 10; i += 1) {
      recordFailure('1.2.3.4');
    }
    expect(isRateLimited('5.6.7.8')).toBe(false);
  });

  it('se libera al pasar la ventana', () => {
    for (let i = 0; i < 10; i += 1) {
      recordFailure('1.2.3.4');
    }
    vi.advanceTimersByTime(5 * 60_000 + 1);
    expect(isRateLimited('1.2.3.4')).toBe(false);

    // Y el primer fallo después de la ventana empieza a contar de cero, no
    // sobre el conteo viejo.
    recordFailure('1.2.3.4');
    expect(isRateLimited('1.2.3.4')).toBe(false);
  });

  it('toma la primera IP de x-forwarded-for y cae a local sin proxy', () => {
    const proxied = new Request('http://x/api', {
      headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' },
    });
    expect(clientKey(proxied)).toBe('9.9.9.9');
    expect(clientKey(new Request('http://x/api'))).toBe('local');
  });
});
