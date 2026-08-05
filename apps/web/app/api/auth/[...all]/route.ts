import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '@/lib/auth';

// ponytail: not the docs' `export const { POST, GET } = toNextJsHandler(auth)`
// pattern — that evaluates getAuth() at module scope, the same eager-init bug
// commit 8a0ffef fixed for getDb(). Calling getAuth() per-request keeps init lazy.
export function GET(request: Request) {
  return toNextJsHandler(getAuth()).GET(request);
}

export function POST(request: Request) {
  return toNextJsHandler(getAuth()).POST(request);
}
