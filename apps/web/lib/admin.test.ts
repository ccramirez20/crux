import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAdmin } from './admin';

describe('isAdmin', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sin ADMIN_EMAIL configurada, nadie es administrador', () => {
    vi.stubEnv('ADMIN_EMAIL', '');
    // Lo que este caso cuida: sin el chequeo de "está puesta", una sesión sin
    // correo compararía undefined contra undefined y entraría.
    expect(isAdmin(undefined)).toBe(false);
    expect(isAdmin('cualquiera@example.com')).toBe(false);
  });

  it('reconoce al administrador sin importar mayúsculas ni espacios', () => {
    vi.stubEnv('ADMIN_EMAIL', 'Jefe@Example.com ');
    expect(isAdmin('jefe@example.com')).toBe(true);
    expect(isAdmin('JEFE@EXAMPLE.COM')).toBe(true);
  });

  it('no deja pasar a otro correo', () => {
    vi.stubEnv('ADMIN_EMAIL', 'jefe@example.com');
    expect(isAdmin('otro@example.com')).toBe(false);
    expect(isAdmin('jefe@example.com.evil.com')).toBe(false);
  });
});
