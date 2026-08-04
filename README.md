# crux

Plataforma de competencias deportivas, empezando por escalada

## Arranque

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local      # completar DATABASE_URL
cp packages/db/.env.example packages/db/.env      # completar DATABASE_URL
pnpm db:migrate
pnpm dev
```

Alcance por etapas, convenciones y reglas de arquitectura: `CLAUDE.md`.
Contexto de negocio: `docs/00-tesis.md`.
