import 'dotenv/config';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { z } from 'zod';
import { account, session, user, verification } from '@crux/db';
import { getDb } from './db';
import { claimInvite, recordInviteUser } from './invites';

const signUpBodySchema = z.object({
  accessCode: z.string().optional(),
});

// A judge's phone reaches the dev server by LAN IP, not localhost, and Better
// Auth rejects any origin that isn't its baseURL — which is what "Invalid
// origin" means when you open the panel from another device on the wifi.
// Private-range origins are trusted in development so that works out of the
// box; a public origin is never trusted here, so a random internet page still
// can't drive your dev session. Production reads an explicit allowlist.
const PRIVATE_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

function configuredTrustedOrigins(): string[] {
  return (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Solo el origen de `BETTER_AUTH_URL`, nunca su ruta.
 *
 * Better Auth deduce su `basePath` de la ruta que traiga `baseURL`. Si esa ruta
 * no es exactamente `/api/auth` —basta con que alguien pegue la dirección de
 * una pantalla cualquiera— deja de reconocer *todos* sus propios endpoints y
 * responde 404 con el cuerpo vacío. Sin mensaje que traducir, la pantalla de
 * entrar solo dice "No se pudo iniciar sesión.", que es el respaldo del
 * respaldo, y no hay nada que apunte a la variable de entorno.
 *
 * Pasó en producción el 2026-08-15 y costó reproducirlo con un build de
 * producción en local. Quedarse con el origen cierra la trampa: la variable
 * sigue sirviendo para fijar el dominio, y la ruta ya no puede romper nada.
 *
 * Un valor que ni siquiera es URL se ignora, que es como se comportaba antes de
 * existir la variable: Better Auth deduce la base de `VERCEL_URL`.
 */
export function authBaseURL(raw = process.env.BETTER_AUTH_URL): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

export function trustedOrigins(request?: Request): string[] {
  const allowed = configuredTrustedOrigins();
  if (!request || process.env.NODE_ENV === 'production') {
    return allowed;
  }
  const origin = request.headers.get('origin');
  return origin && PRIVATE_ORIGIN.test(origin) ? [...allowed, origin] : allowed;
}

function createAuth() {
  return betterAuth({
    baseURL: authBaseURL(),
    database: drizzleAdapter(getDb(), {
      provider: 'pg',
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    trustedOrigins,
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/sign-up/email') {
          // safeParse, not parse: a malformed body (not an object, wrong shape)
          // must fail the access-code check below, not throw a raw ZodError
          // that surfaces as a 500 instead of the intended 400.
          const parsed = signUpBodySchema.safeParse(ctx.body);
          const accessCode = parsed.success ? parsed.data.accessCode : undefined;
          // Fail closed: no code, no lookup. An empty string would otherwise
          // reach the query and match a row someone managed to insert blank.
          const claimed = accessCode ? await claimInvite(getDb(), accessCode) : [];
          if (claimed.length === 0) {
            // Mismo mensaje para código inexistente y código ya usado: separarlos
            // le diría a quien prueba códigos cuáles existen.
            throw new APIError('BAD_REQUEST', {
              message: 'Código de acceso inválido.',
            });
          }
        }
      }),
      // ponytail: el consumo ocurre en el hook `before`, así que un sign-up que
      // falle después (correo repetido, por ejemplo) quema la invitación sin
      // dejar cuenta. Al volumen de esto —CR invitando organizadores uno por
      // uno— generar otra es gratis. Si algún día se invita en lote, el arreglo
      // es mover el consumo entero aquí, con el id del usuario ya creado.
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/sign-up/email') {
          const parsed = signUpBodySchema.safeParse(ctx.body);
          const accessCode = parsed.success ? parsed.data.accessCode : undefined;
          const newUser = ctx.context.newSession?.user;
          if (accessCode && newUser) {
            await recordInviteUser(getDb(), accessCode, newUser.id);
          }
        }
      }),
    },
  });
}

// ponytail: cached on globalThis, not module scope — mirrors apps/web/lib/db.ts's
// getDb(). Next's build-time page-data collection imports route modules without
// DATABASE_URL set (see commit 8a0ffef); a module-scope `betterAuth(...)` call
// would crash `next build` the same way the eager db client did.
const globalForAuth = globalThis as unknown as { auth?: ReturnType<typeof createAuth> };

export function getAuth(): ReturnType<typeof createAuth> {
  if (!globalForAuth.auth) {
    globalForAuth.auth = createAuth();
  }
  return globalForAuth.auth;
}
