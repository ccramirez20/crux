import { afterEach, describe, expect, it, vi } from 'vitest';
import { authBaseURL, trustedOrigins } from './auth';

function withOrigin(origin: string): Request {
  return new Request('http://localhost:3000/api/auth/sign-in/email', {
    headers: { origin },
  });
}

describe('authBaseURL', () => {
  // Una ruta en BETTER_AUTH_URL se vuelve el basePath de Better Auth y deja
  // toda la API de autenticación en 404 con cuerpo vacío. Producción,
  // 2026-08-15.
  it('se queda con el origen y descarta cualquier ruta', () => {
    expect(authBaseURL('https://cruxcompetencias.com')).toBe('https://cruxcompetencias.com');
    expect(authBaseURL('https://cruxcompetencias.com/')).toBe('https://cruxcompetencias.com');
    expect(authBaseURL('https://cruxcompetencias.com/panel')).toBe('https://cruxcompetencias.com');
    expect(authBaseURL('https://cruxcompetencias.com/api/auth')).toBe('https://cruxcompetencias.com');
  });

  it('ignora lo que no es una URL, para caer en la deducción por VERCEL_URL', () => {
    expect(authBaseURL('cruxcompetencias.com')).toBeUndefined();
    expect(authBaseURL('  ')).toBeUndefined();
    expect(authBaseURL(undefined)).toBeUndefined();
  });
});

describe('trustedOrigins', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('confía en la IP de LAN desde la que entra el teléfono, en desarrollo', () => {
    expect(trustedOrigins(withOrigin('http://192.168.2.14:3000'))).toContain(
      'http://192.168.2.14:3000',
    );
    expect(trustedOrigins(withOrigin('http://10.0.0.5:3000'))).toContain('http://10.0.0.5:3000');
  });

  it('no confía en un origen público aunque parezca privado', () => {
    // El ancla del final del patrón es lo que impide que un dominio que
    // *empieza* por una IP privada se cuele.
    expect(trustedOrigins(withOrigin('https://evil.example.com'))).toEqual([]);
    expect(trustedOrigins(withOrigin('http://192.168.2.14.evil.com'))).toEqual([]);
    expect(trustedOrigins(withOrigin('http://172.32.0.1:3000'))).toEqual([]);
  });

  it('en producción solo vale la lista configurada, no el header del cliente', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BETTER_AUTH_TRUSTED_ORIGINS', 'https://crux.example.com');
    const allowed = trustedOrigins(withOrigin('http://192.168.2.14:3000'));
    expect(allowed).toEqual(['https://crux.example.com']);
  });
});
