# 0001 — Stack base

Fecha: 2026-08-04 · Estado: aceptada

## Contexto
Una persona, tres productos en paralelo. El costo dominante es el cambio de
contexto, no el rendimiento del runtime.

## Decision
Node 22 + TypeScript estricto, Next.js 15, Postgres + Drizzle, Tailwind +
shadcn/ui, pnpm workspaces + Turborepo. El mismo stack en los tres repos.

## Alternativas descartadas
- Stack distinto por proyecto: mejor ajuste puntual, costo de mantenimiento y
  de contexto inasumible para una persona.
- Monorepo unico para los tres: acopla despliegues de negocios sin relacion y
  degrada la calidad de los agentes por tamano de contexto.
- Prisma en vez de Drizzle: mas comodo, pero esconde el SQL justo donde hay que
  afinarlo (concurrencia, agregados, capacidad de produccion).

## Consecuencias
- Config duplicada entre los tres repos; se acepta el drift, no se construye
  un generador de plantillas.
- TypeScript en todo obliga a sacar cualquier trabajo de modelos a un servicio
  aparte si algun dia hace falta.
