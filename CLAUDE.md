# CRUX — Plataforma de competencias deportivas

Motor de competencias para deporte amateur, entrando por escalada. Contexto de negocio en `@docs/00-tesis.md`. Este archivo son las reglas que aplican siempre.

## Regla de alcance

Construcción por etapas y **en orden**. Si una petición pertenece a una etapa futura, dilo y no la implementes. Usa `/alcance` para evaluar.

| Etapa | Meses | Qué incluye | Estado |
|---|---|---|---|
| 1 — Competencias | 1-2 | Inscripciones, categorías, captura de intentos, scoring en vivo, tabla pública, historial por competidor | **ACTIVA** |
| 2 — Diagnóstico biomecánico | 3-5 | Análisis de video en el navegador, diagnóstico por fase de movimiento | Bloqueada |
| 3 — Generador de bloques | 6+ | Segmentación de presas por foto, bloques calibrados al nivel, rachas y retos | Bloqueada |

### Etapa 1 — detalle
Un organizador crea un evento con modalidad, categorías y rondas. Publica un enlace de inscripción. Los jueces capturan intentos desde el teléfono. La tabla de resultados es pública y se actualiza sola. Cada competidor acumula historial entre eventos.

**Fuera de alcance en la etapa 1:** pagos en línea, múltiples organizaciones con roles, notificaciones, exportación a formatos federativos, cualquier deporte que no sea escalada.

**Desbloquea la etapa 2 cuando:** un gimnasio real corrió un evento con ≥20 inscritos sin soporte manual del desarrollador el día del evento.

### Etapa 2 — detalle
El escalador sube el video de su intento y recibe **diagnóstico por fase de movimiento**, no métricas sueltas: en qué momento inició mal la extensión, en qué movimiento cargó el pie equivocado. Todo corre en el navegador; el video nunca sale del dispositivo; costo de inferencia cero.

Este es el diferenciador técnico frente a BetterClimber, Cima, Climbalyzer y Belay.ai, que ya existen y producen métricas bonitas sin diagnóstico tipificado. Lanzarlo sin audiencia previa es competir en desventaja; por eso va después de la etapa 1.

**Desbloquea la etapa 3 cuando:** hay entrenadores pagando por la cuenta de diagnóstico.

### Etapa 3 — detalle
Retención y adquisición de consumidor, no ingreso. Solo tiene sentido con base de usuarios ya existente.

**Anti-objetivos actuales:** app móvil nativa, multi-deporte configurable, marketplace de entrenadores, red social, i18n. El motor debe *poder* generalizarse a otros deportes; no se generaliza hasta tener el segundo deporte con usuario real.

## Stack

Node 22, TypeScript estricto, Next.js 15 (App Router), Tailwind + shadcn/ui (shadcn/ui aún no instalado), Postgres + Drizzle, Better Auth, Vitest + Playwright (Playwright aún no instalado; `pnpm test:e2e` no ejecuta nada todavía), pnpm workspaces + Turborepo.

**Sin librería de gráficas.** Las de la tabla pública son SVG y CSS a mano: cuestan 6.5 kB en la pantalla que abre toda la sala al tiempo, contra los 100 kB y pico de una librería. Antes de proponer una, mira `apps/web/app/(public)/resultados/[slug]/leaderboard-charts.tsx`.

Etapa 2 añade: MediaPipe Tasks Vision (PoseLandmarker) sobre WASM/WebGPU, en Web Worker. Etapa 3 añade: onnxruntime-web.

## Estructura

```
crux/
├─ CLAUDE.md
├─ docs/
│  ├─ 00-tesis.md            # negocio, precios, canal, riesgo
│  ├─ 01-etapas.md           # alcance detallado por etapa
│  ├─ 02-dominio.md          # reglas de scoring largas, casos de borde
│  └─ adr/                   # una decisión por archivo, numeradas
├─ apps/
│  └─ web/
│     ├─ app/
│     │  ├─ (public)/        # inscripción (/inscripcion/[slug], SIN auth); tabla de resultados y perfil de competidor — aún no existen
│     │  ├─ (organizer)/     # panel del gimnasio: eventos, categorías, rutas — protegido
│     │  ├─ (judge)/         # captura de intentos, offline-first — aún no existe
│     │  ├─ sign-in/, sign-up/  # páginas de autenticación
│     │  └─ api/
│     │     ├─ auth/[...all]/   # Better Auth (catch-all)
│     │     └─ health/
│     ├─ components/         # elementos visuales compartidos (ej. motivo topográfico)
│     └─ lib/                # getDb(), getAuth() — clientes lazy
├─ packages/
│  ├─ core/                  # dominio puro: tipos y funciones sin IO
│  ├─ scoring/               # estrategias de puntaje — el corazón del sistema
│  ├─ db/                    # esquema Drizzle, migraciones, queries
│  └─ config/                # eslint, tsconfig, tailwind compartidos
└─ .claude/
```

**Reglas de dependencia (no negociables):**
- `packages/core` y `packages/scoring` no importan nada de `db`, `next`, ni de red. Funciones puras, y así se testean.
- `packages/db` no contiene lógica de negocio, solo persistencia y queries.
- `apps/web` orquesta; no reimplementa reglas que viven en `core` o `scoring`.

## Dominio

Código en inglés, UI en español (es-CO).

| Español (UI) | Inglés (código) | Nota |
|---|---|---|
| Evento / competencia | `Event` | Pertenece a una `Organization` |
| Modalidad | `Discipline` | `boulder` \| `lead` \| `speed` |
| Categoría | `Category` | Edad + género + nivel |
| Ronda | `Round` | `qualification` \| `semifinal` \| `final` |
| Bloque / ruta | `Problem` | Unidad puntuable dentro de una ronda |
| Competidor | `Athlete` | Persona; puede existir sin cuenta |
| Inscripción | `Registration` | `Athlete` + `Event` + `Category` |
| Intento | `Attempt` | Registro de un juez: top, zona, número de intentos, altura |
| Puntaje | `Score` | **Siempre derivado**, nunca capturado a mano |
| Zona | `Zone` | Presa intermedia puntuable |
| Tabla de resultados | `Leaderboard` | Vista pública |

### Jerga en pantalla (es-CO)

Decidido el 2026-08-10. Vive en `apps/web/lib/labels.ts`; ninguna pantalla
escribe estas palabras a mano.

- **Modalidad: las dos palabras juntas.** `boulder` → **"Boulder / Bloque"**,
  `lead` → **"Lead / Dificultad"**. Cuando exista, `speed` → "Speed /
  Velocidad". En el gimnasio se dice boulder y lead; en la inscripción de una
  liga se lee bloque y dificultad. Quien conoce solo una de las dos igual se
  ubica. **Nunca "búlder" castellanizado.**
- **Unidad puntuable: una sola palabra, según la modalidad.** En boulder es
  **bloque**; en todo lo que se escala con cuerda es **ruta**. Se usa
  `problemUnit(discipline)`. Aquí no van las dos palabras: el nombre aparece
  decenas de veces por pantalla y "bloque / ruta" en cada una sería ruido.
- En el código todo sigue siendo `Problem` y `Discipline`. La jerga es de la
  interfaz, no del modelo.

## Decisiones de arquitectura vigentes

Ya están tomadas. Si vas a contradecir alguna, dilo explícitamente antes de escribir código.

**1. Los intentos son el hecho; los puntajes son derivados.** Se persiste `Attempt` (append-only). `Score` y `Leaderboard` se calculan. Corregir un error del juez es insertar una corrección, no editar un puntaje. Esto hace auditable un evento y evita la discusión más común del día de la competencia.

**2. El scoring es intercambiable.** `packages/scoring` expone `ScoringStrategy` con una función pura `score(attempts, config) → RankedResult[]`. Registro de formatos: puntos IFSC de bloque, conteo clásico de tops/zonas con desempate, puntos por bloque estilo liga local, altura máxima en dificultad, llaves de velocidad. Cada gimnasio colombiano usa su variante; si el scoring está cableado, cada cliente nuevo es un fork. **Cada estrategia necesita tests con casos de empate reales antes de considerarse terminada.**

**3. La captura de jueces es offline-first.** Los gimnasios tienen wifi malo y el día del evento no hay margen. Intentos en IndexedDB con `clientAttemptId` (UUID del cliente) y cola de sincronización. Endpoint idempotente por `clientAttemptId`. No asumas red en el flujo del juez.

**4. La lectura pública se optimiza para picos.** Todos los asistentes abren la tabla al mismo tiempo. No consultes la base por cliente: recalcula al recibir intentos y difunde. Empieza con polling de 5s sobre respuesta cacheada; sube a SSE solo si hace falta. Sin WebSockets en la etapa 1.

**5. Un atleta puede existir sin cuenta.** El organizador inscribe gente que nunca abrirá la app. `Athlete` y `User` son entidades distintas, vinculables después. Fusionarlas es el error que obliga a rehacer el modelo en el mes 3.

**6. Nada de video sale del dispositivo (etapa 2).** Es promesa de producto y ventaja de costo. Cualquier propuesta que suba video al backend está mal.

## Comandos

```bash
pnpm dev              # apps/web en :3000
pnpm typecheck
pnpm lint
pnpm test             # Vitest
pnpm test:e2e         # Playwright — pendiente, aún no instalado (no hace nada todavía)
pnpm db:generate      # generar migración desde el esquema
pnpm db:migrate
pnpm db:studio
pnpm seed:event       # siembra la competencia demo (26 inscritos, 5 bloques, 130 intentos)
pnpm seed:event --reset   # la borra y la vuelve a sembrar
```

## Convenciones

- Ramas: `feat/`, `fix/`, `chore/` + descripción en inglés. Commits en inglés, imperativo.
- Zod en **todo** borde de entrada. El tipo se deriva del esquema, no al revés.
- Sin `any`. Sin `as` para silenciar el compilador. Si el tipo no cuadra, el modelo está mal.
- Errores: `Result<T, E>` en dominio; excepciones solo en bordes de IO.
- Dinero: nunca `float`. Enteros en centavos, moneda explícita (COP).
- Fechas: UTC en base, `America/Bogota` en pantalla. Cada evento tiene zona horaria propia.
- Tests obligatorios en `packages/scoring` y `packages/core`.
- Migraciones: nunca editar una aplicada. Siempre una nueva.

## Necesita mi aprobación antes de escribirse

- Cambios en el esquema de base de datos.
- Dependencias nuevas.
- Cualquier funcionalidad de etapa 2 o 3.
- Integración de pasarela de pagos (fuera de alcance; se cobra a mano).
- Abstracciones sin al menos tres usos concretos hoy.

## Definición de terminado (etapa 1)

Un organizador crea un evento, publica el enlace, inscribe 20+ atletas en dos o más categorías, tres jueces capturan intentos desde el teléfono con red intermitente, la tabla pública se actualiza en menos de 10 segundos, y el resultado final resiste una revisión manual de desempates.
