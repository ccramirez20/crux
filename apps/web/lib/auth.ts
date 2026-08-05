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
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/sign-up/email') {
          const { accessCode } = signUpBodySchema.parse(ctx.body);
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
