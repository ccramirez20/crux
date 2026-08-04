# apps/web Scaffold (Next.js + Tailwind + Drizzle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `apps/web` (Next.js 15 + Tailwind v4) and `packages/db` (Drizzle + Postgres) as a compiling skeleton with zero domain logic, wired end-to-end so a `/api/health` route proves the app can reach `DATABASE_URL`. Closes GitHub issue #2.

**Architecture:** `packages/db` owns the Postgres connection (a pure factory function, no env access) and re-exports Drizzle's `sql` helper so `apps/web` never imports `drizzle-orm` directly. `apps/web` is a standard Next.js App Router project that instantiates the db client once from `process.env.DATABASE_URL` and calls it from one health-check route. No schema, no auth, no UI beyond a placeholder page — those are separate issues (#3 esquema, auth not yet scoped).

**Tech Stack:** Next.js 15.5.x, React 19.2.x, Tailwind CSS v4 (CSS-first config, `@tailwindcss/postcss`), Drizzle ORM 0.45.x with the `postgres` (postgres.js) driver, drizzle-kit 0.31.x, Vitest 4.x for the one package with real logic.

## Global Constraints

- Node 22, TypeScript strict (`tsconfig.base.json` — keep `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, no `any`, no `as`).
- `packages/db` must not import `next`, or contain business logic — persistence only (`CLAUDE.md` dependency rules).
- `apps/web` orchestrates; it must go through `@crux/db`, never `drizzle-orm` or `postgres` directly.
- No new dependency beyond what's listed below — each one is required by the issue (Next, Tailwind, Drizzle) or by the official Drizzle CLI setup (`dotenv`, for `packages/db` only).
- Pin `next` to the 15.x line per `CLAUDE.md`'s stack table (current stable is 16.x — deliberately not used here).
- Money/schema/auth are out of scope for this plan.

---

### Task 1: `packages/db` — Drizzle Postgres client

**Files:**
- Modify: `packages/db/package.json`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/client.test.ts`
- Modify: `packages/db/src/index.ts`
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/.env.example`

**Interfaces:**
- Produces: `createDb(databaseUrl: string): Db` — throws if `databaseUrl` is falsy. `Db = ReturnType<typeof createDb>`. Both exported from `@crux/db`. Also re-exports `sql` from `drizzle-orm` so consumers never import `drizzle-orm` directly.

- [ ] **Step 1: Add dependencies**

Replace `packages/db/package.json`:

```json
{
  "name": "@crux/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "lint": "echo 'sin lint todavia'",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "drizzle-orm": "^0.45.2",
    "postgres": "^3.4.9"
  },
  "devDependencies": {
    "dotenv": "^17.4.2",
    "drizzle-kit": "^0.31.10",
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 2: Install**

Run (from repo root): `pnpm install`
Expected: resolves and writes new entries to `pnpm-lock.yaml` without errors.

- [ ] **Step 3: Write the failing test**

Create `packages/db/src/client.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createDb } from './client';

describe('createDb', () => {
  it('throws when databaseUrl is empty', () => {
    expect(() => createDb('')).toThrow(
      'DATABASE_URL is required to create a database client',
    );
  });

  it('returns a drizzle client for a valid connection string', () => {
    const db = createDb('postgresql://user:pass@localhost:5432/test');
    expect(db).toBeDefined();
  });
});
```

- [ ] **Step 4: Run test, verify it fails**

Run: `pnpm --filter @crux/db test`
Expected: FAIL — `Cannot find module './client'` (file doesn't exist yet).

- [ ] **Step 5: Implement the client**

Create `packages/db/src/client.ts`:

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export function createDb(databaseUrl: string) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to create a database client');
  }
  return drizzle(postgres(databaseUrl));
}

export type Db = ReturnType<typeof createDb>;
```

- [ ] **Step 6: Update the barrel export**

Replace `packages/db/src/index.ts`:

```ts
export { createDb } from './client';
export type { Db } from './client';
export { sql } from 'drizzle-orm';
```

- [ ] **Step 7: Run test, verify it passes**

Run: `pnpm --filter @crux/db test`
Expected: PASS — 2 tests passing.

- [ ] **Step 8: Add the schema placeholder**

Create `packages/db/src/schema.ts`:

```ts
// Tablas Drizzle llegan con el issue #3 (Event, Category, Round, Problem,
// Athlete, Registration, Attempt). Archivo vacio para que drizzle.config.ts
// tenga un target valido mientras tanto.
export {};
```

- [ ] **Step 9: Add drizzle-kit config**

Create `packages/db/drizzle.config.ts`:

```ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 10: Add the package-local env reference**

Create `packages/db/.env.example`:

```
DATABASE_URL="postgresql://postgres:dev@localhost:5432/postgres"
```

- [ ] **Step 11: Typecheck**

Run: `pnpm --filter @crux/db typecheck`
Expected: exits 0, no errors.

- [ ] **Step 12: Commit**

```bash
git add packages/db
git commit -m "feat(db): add Drizzle postgres.js client factory"
```

---

### Task 2: `apps/web` — Next.js 15 + Tailwind v4 scaffold

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next-env.d.ts`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/app/globals.css`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/.env.example`

**Interfaces:**
- Consumes: nothing from Task 1 yet (that's Task 3).
- Produces: a buildable Next.js app at `apps/web`, path alias `@/*` → `apps/web/*`.

- [ ] **Step 1: package.json**

Create `apps/web/package.json`:

```json
{
  "name": "@crux/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "echo 'sin lint todavia'",
    "typecheck": "tsc --noEmit",
    "test": "echo 'sin tests todavia'"
  },
  "dependencies": {
    "next": "^15.5.22",
    "react": "^19.2.8",
    "react-dom": "^19.2.8"
  },
  "devDependencies": {
    "@types/node": "^22.20.1",
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.4",
    "@tailwindcss/postcss": "^4.3.3",
    "postcss": "^8.5.25",
    "tailwindcss": "^4.3.3"
  }
}
```

- [ ] **Step 2: tsconfig**

Create `apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "noEmit": true,
    "incremental": true,
    "allowJs": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Next's type-reference file**

Create `apps/web/next-env.d.ts`:

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

- [ ] **Step 4: Next config**

Create `apps/web/next.config.ts`:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 5: PostCSS config for Tailwind v4**

Create `apps/web/postcss.config.mjs`:

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

- [ ] **Step 6: Global stylesheet**

Create `apps/web/app/globals.css`:

```css
@import "tailwindcss";
```

- [ ] **Step 7: Root layout**

Create `apps/web/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Crux',
  description: 'Plataforma de competencias de escalada',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Placeholder home page**

Create `apps/web/app/page.tsx`:

```tsx
export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-2xl font-semibold">Crux</h1>
    </main>
  );
}
```

- [ ] **Step 9: App-local env reference**

Create `apps/web/.env.example`:

```
DATABASE_URL="postgresql://postgres:dev@localhost:5432/postgres"
```

- [ ] **Step 10: Install**

Run: `pnpm install`
Expected: resolves Next/React/Tailwind, no errors.

- [ ] **Step 11: Typecheck**

Run: `pnpm --filter @crux/web typecheck`
Expected: exits 0.

- [ ] **Step 12: Build**

Run: `pnpm --filter @crux/web build`
Expected: `Compiled successfully`, `.next/` produced.

- [ ] **Step 13: Commit**

```bash
git add apps/web
git commit -m "feat(web): scaffold Next.js 15 + Tailwind v4 app"
```

---

### Task 3: Wire `apps/web` to `@crux/db` via a health-check route

**Files:**
- Modify: `apps/web/package.json` (add `@crux/db` dependency)
- Create: `apps/web/lib/db.ts`
- Create: `apps/web/app/api/health/route.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: `createDb`, `sql` from `@crux/db` (Task 1).
- Produces: `GET /api/health` → `{ ok: true }` when `DATABASE_URL` is reachable; throws (500) otherwise.

- [ ] **Step 1: Add the workspace dependency**

In `apps/web/package.json`, under `dependencies`, add `@crux/db`:

```json
  "dependencies": {
    "@crux/db": "workspace:*",
    "next": "^15.5.22",
    "react": "^19.2.8",
    "react-dom": "^19.2.8"
  },
```

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: links `@crux/db` into `apps/web/node_modules`.

- [ ] **Step 3: Create the db singleton**

Create `apps/web/lib/db.ts`:

```ts
import { createDb } from '@crux/db';

export const db = createDb(process.env.DATABASE_URL!);
```

- [ ] **Step 4: Create the health route**

Create `apps/web/app/api/health/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { sql } from '@crux/db';
import { db } from '@/lib/db';

export async function GET() {
  await db.execute(sql`select 1`);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Typecheck and build**

Run: `pnpm --filter @crux/web typecheck && pnpm --filter @crux/web build`
Expected: both exit 0. (The route only executes its query at request time, so a missing/unreachable database does not fail the build.)

- [ ] **Step 6: Fix the onboarding instructions**

The root `README.md` currently tells developers to create a single root `.env`, but Next.js only reads env files from `apps/web/`, and drizzle-kit only reads from `packages/db/` (its CLI runs with that as its working directory). Replace the `## Arranque` section of `README.md`:

```markdown
## Arranque

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local      # completar DATABASE_URL
cp packages/db/.env.example packages/db/.env      # completar DATABASE_URL
pnpm db:migrate
pnpm dev
```
```

- [ ] **Step 7: Manual verification (not automated — no local Postgres in this environment)**

With a reachable Postgres at the `DATABASE_URL` you configured in step 6:

```bash
pnpm dev
curl http://localhost:3000/api/health
```

Expected: `{"ok":true}`.

- [ ] **Step 8: Full-repo check**

Run: `pnpm typecheck && pnpm build && pnpm test`
Expected: all pass (packages without real code still succeed via their placeholder scripts; `@crux/db`'s Vitest suite from Task 1 runs for real).

- [ ] **Step 9: Commit**

```bash
git add apps/web README.md
git commit -m "feat(web): wire health check to @crux/db, fix env onboarding"
```
