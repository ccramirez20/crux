import 'dotenv/config';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { z } from 'zod';
import { account, session, user, verification } from '@crux/db';
import { getDb } from './db';

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
          // Fail closed: if the env var is ever unset, `undefined !== undefined`
          // would otherwise let sign-up through ungated.
          if (!process.env.ORGANIZER_ACCESS_CODE || accessCode !== process.env.ORGANIZER_ACCESS_CODE) {
            throw new APIError('BAD_REQUEST', {
              message: 'Código de acceso inválido.',
            });
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
