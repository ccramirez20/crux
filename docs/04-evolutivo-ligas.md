# Crux — Manejo de ligas (evolutivo, diseño cerrado, sin construir)

> Documento de producto/arquitectura, brainstorming del 2026-08-20 con CR.
> Describe el diseño ya cerrado para implementar cuando se decida construirlo
> — no es plan de implementación. Cuando se retome, este documento alimenta
> un `writing-plans` propio; no hace falta volver a discutir lo que ya está
> decidido aquí.

---

## 1. Qué es y para qué

Hoy "liga" no existe en el modelo de datos. `liga-paramo-f1` y `liga-paramo`
son dos eventos sueltos en `events`, conectados solo porque comparten texto
en el nombre — ninguna consulta puede decir "estas fechas son la misma
liga". El código ya tropezó con esto: `getSiblingEvents` en
`apps/web/lib/leaderboard.ts` es un parche explícito para que quien llega a
la Fecha 2 por un enlace suelto sepa que existe una Fecha 1, y hoy lo
resuelve listando **todos** los eventos de la organización a falta de algo
mejor.

Este evolutivo construye la Liga de verdad: un contenedor que agrupa varias
fechas, acumula puntos entre ellas y publica una tabla de posiciones global.
Es la misma categoría que las tarjetas compartibles (`docs/02-evolutivo.md`):
no estaba en la tabla de alcance original de la etapa 1, pero sigue siendo
terreno de competencias — no toca nada de etapa 2 ni 3 — y se construye
porque CR lo pidió explícitamente, no porque estuviera prometido desde el
principio.

---

## 2. Modelo — una Liga es un contenedor de fechas, no un evento nuevo

Una Liga agrupa varias **fechas**, y cada fecha se comporta exactamente como
un evento se comporta hoy: modalidad, categorías, rondas, bloques,
inscripción pública y captura de jueces propios, sin ningún cambio. La Liga
no inscribe a nadie ni captura ningún intento directamente — solo agrega, al
cerrar cada fecha, los puestos que ya produjo esa fecha en puntos de liga.

Concretamente: una fecha sigue siendo un `Event` completo, con una columna
nueva (`leagueId`, nullable) que dice a qué liga pertenece. Un evento sin
`leagueId` es un evento suelto, como todos hoy — nada cambia para quien no
usa ligas.

---

## 3. Categorías, inscripción y cómo se cruzan las fechas

**Las categorías y la inscripción viven en cada fecha**, no en la liga.
Cada fecha se inscribe por su propio enlace, con sus propias categorías —
igual que hoy. La Liga no tiene ni inscritos ni categorías propias.

**El cruce entre fechas es por nombre exacto de categoría**, automático y
sin mapeo manual: "Intermedio Masculino" de la Fecha 1 se suma con
"Intermedio Masculino" de la Fecha 2 porque el texto coincide. Es una
decisión de simplicidad para v1, con un riesgo aceptado a propósito: un
organizador inconsistente ("Interm. M" en una fecha, "Intermedio M" en
otra) separa sin avisar lo que debería sumar junto. No hay UI de mapeo
manual en v1; se agrega si un gimnasio real lo golpea.

La identidad del atleta entre fechas ya está resuelta por el modelo actual
(`Athlete.documentId`, la misma base que ya cruza eventos en el perfil de
competidor) — no hace falta nada nuevo ahí.

---

## 4. Puntaje de liga

### 4.1 Fuente del puntaje por fecha

El puesto del atleta **dentro de su categoría** en esa fecha — la ronda más
avanzada en la que apareció, mismo criterio que ya usa
`docs/01-etapas.md` para el perfil de competidor ("el puesto que muestra de
un evento es el de la ronda más avanzada en la que apareció"). No se
recalcula nada: se lee el `rank` que `scoreRound`/`getLeaderboard` ya
produjo para esa fecha.

### 4.2 Conversión puesto → puntos de liga: tabla configurable

Cada liga tiene una **tabla de puntos por puesto** (`pointsTable`), editable
por el organizador al crear la liga. Por defecto se siembra con la tabla
oficial IFSC 2025 de World Cup, consultada para este diseño:

| Puesto | Puntos | Puesto | Puntos |
|---|---|---|---|
| 1º | 1000 | 6º | 495 |
| 2º | 805 | 7º | 455 |
| 3º | 690 | 8º | 415 |
| 4º | 610 | 9º | 380 |
| 5º | 545 | 10º | 350 |

(la tabla completa de IFSC sigue bajando de forma no lineal hasta 1 punto
cerca del puesto 75 — para Crux basta con que el organizador defina tantas
filas como le importen; cualquier puesto sin entrada en la tabla puntúa 0).

**Por qué es una tabla configurable y no varias estrategias de código:** CR
pidió explícitamente que otra organización pueda usar un formato de puntos
distinto. La fórmula en sí (puesto → puntos, sumado entre fechas, con
desempate) es una sola; lo que cambia entre ligas son los valores de la
tabla, no el algoritmo. Se resuelve con datos (`pointsTable` por liga), no
con un registro de múltiples `LeagueScoringStrategy`. Esto es una lectura de
la decisión #2 de `CLAUDE.md` ("el scoring es intercambiable"), no una
estrategia nueva con su propio archivo en `packages/scoring` — vale decirlo
explícito porque `packages/scoring` hoy resuelve "intercambiable" con
funciones distintas por formato, y aquí se resuelve con configuración.

### 4.3 Sin descarte de peor fecha (v1)

IFSC descarta el peor resultado de la temporada cuando hay más de cinco
competencias, para premiar consistencia sin castigar una fecha perdida. Se
deja fuera de v1 a propósito — es la primera pieza a añadir si una liga real
lo reclama. En v1, el total de un atleta es la suma simple de sus puntos en
todas las fechas en que participó (cero puntos en las que no participó, no
descalifica).

### 4.4 Desempate: countback estilo IFSC

Si el total de puntos empata entre dos atletas, gana quien tenga más
primeros puestos entre fechas; si sigue empatado, más segundos puestos; y
así sucesivamente. Si el empate agota el countback por completo, comparten
puesto — mismo patrón que ya usa `classic_tops_zones` cuando su desempate se
agota.

Esto necesita tests con casos de empate reales antes de darse por terminado
(regla de `CLAUDE.md` para todo lo que vive en `packages/scoring`),
incluyendo: dos atletas con el mismo total pero distinto historial de
primeros puestos, y un empate que agota el countback entero.

---

## 5. Alcance de la organización y retrofit

**Una liga pertenece a una sola organización**, igual que un evento hoy.
Ninguna liga cruza gimnasios distintos — eso es "múltiples organizaciones
con roles", explícitamente fuera de alcance en `CLAUDE.md`.

**Un evento ya existente se puede asignar a una liga después de creado**,
no solo fechas nuevas creadas dentro del flujo de la liga. Esto resuelve el
caso real de Liga Páramo: `liga-paramo-f1` y `liga-paramo` podrán conectarse
a una liga nueva sin recrearse.

---

## 6. Pantallas

### 6.1 Pública

Una sola pantalla por liga (mismo patrón que la tabla pública de un evento:
todo en una vista, no varias pantallas separadas):

- **Tabla de posiciones global**, por categoría (con selector si la liga
  tiene varias categorías, igual que hoy filtra por categoría la tabla de un
  evento): puesto, puntos totales, desglose por fecha.
- **Lista de fechas conectadas**, debajo, cada una enlazando a su propia
  tabla pública (`/resultados/[slug]`).

Reemplaza el parche de `getSiblingEvents`: cuando un evento tiene
`leagueId`, la lista de "otras fechas" que hoy muestra pasa a ser las fechas
reales de su liga, no todos los eventos de la organización. Un evento sin
liga se queda exactamente con el comportamiento de hoy.

### 6.2 Panel del organizador

- **Crear liga**: nombre, slug, tabla de puntos (precargada con la tabla
  IFSC de la sección 4.2, editable).
- **Ver una liga**: posiciones actuales, lista de fechas, botón para crear
  una fecha nueva dentro de la liga (reusa el flujo de creación de evento ya
  existente, con `leagueId` prellenado) y botón para asignar un evento
  propio ya existente como fecha (retrofit de la sección 5).
- Entrada a "Mis ligas" junto al listado de eventos en el panel.

---

## 7. Modelo de datos mínimo

**`leagues`** (tabla nueva)
- `id`, `organizationId` (FK), `ownerId` (FK a `user`, mismo patrón que
  `events.ownerId`)
- `name`, `slug` (único, para la URL pública)
- `pointsTable` (`integer[]`; índice 0 = puntos del 1er puesto)
- `createdAt`

**`events.leagueId`** (columna nueva, nullable, FK a `leagues`)
- Null = evento suelto, como todos hoy. No se toca nada más del esquema de
  `events`: una fecha sigue siendo un `Event` completo.

Migración nueva cuando se implemente — nunca se edita una aplicada.

---

## 8. Lo que queda explícitamente fuera de v1

- Ligas multi-organización.
- Descarte de peores fechas / "mejores N de M" (sección 4.3).
- Mapeo manual de categorías entre fechas — solo match por nombre exacto
  (sección 3).
- Cuotas mínimas de participantes por categoría/fecha para calificar puntos
  (IFSC las tiene para sus World Cups; overkill para una liga de gimnasio).
- Cierre explícito de temporada: la tabla de posiciones siempre se lee en
  vivo con las fechas que ya tenga la liga. "El ganador" es quien lidera
  después de la última fecha — no hay un botón de "cerrar liga".

---

## 9. Siguiente paso

Este documento es el diseño, no el plan de implementación. Cuando CR decida
construirlo: pasar por `/alcance` para reconfirmar que sigue siendo etapa 1,
aprobar el cambio de esquema (`leagues` + `events.leagueId`, sección
"Necesita mi aprobación antes de escribirse" de `CLAUDE.md`), y correr
`writing-plans` sobre este documento para producir el plan de archivos y
pasos concretos.
