# Dominio — reglas largas

El glosario corto vive en CLAUDE.md. Aqui van las reglas de scoring completas:
formulas por formato, desempates, casos de borde conocidos y ejemplos reales de
competencias pasadas que sirven como casos de prueba.

## Formatos de puntaje a soportar
### Puntos IFSC de bloque

Implementado en `packages/scoring/src/ifsc-boulder.ts`.

**Resolucion del intento vigente:** igual que `classic_tops_zones`, gana el
`Attempt` con mayor `sequence` por `(registrationId, problemId)`.

**Puntaje por bloque (no aditivo — gana el mejor logro, no se suman):**
- Topeado (`top: true`) → `max(0, 250 - (topAttemptsUsed - 1) * 1)` decimas
  (25.0 puntos = 250 decimas; cada intento extra cuesta 0.1 punto = 1 decima;
  piso en 0). `topAttemptsUsed = topAttempts ?? 1`.
- No topeado pero en zona (`zone: true`) → `max(0, 100 - (zoneAttemptsUsed -
  1) * 1)` decimas (10.0 puntos = 100 decimas, misma deduccion y piso).
  `zoneAttemptsUsed = zoneAttempts ?? 1`.
- Ninguno de los dos → 0.
- **Aqui no aplica "topear acredita zona"** (a diferencia de
  `classic_tops_zones`): un bloque topeado puntua solo con la formula de top,
  nunca ademas con la de zona.

**Agregacion por inscripcion:** suma del puntaje de cada bloque — la falta de
aditividad es solo entre top y zona *dentro* de un mismo bloque; entre
bloques distintos los puntajes si se suman. Toda la aritmetica se hace en
decimas enteras y se convierte a puntos (`/10`) solo al final.

**DNS:** una inscripcion sin ningun intento registrado puntua 0 y queda al
final de la clasificacion.

**Orden de clasificacion:** puntaje total descendente.

**Empates:** un empate real (mismo puntaje total) comparte `rank` y `tied:
true` — a diferencia de `classic_tops_zones`, este formato no tiene un
segundo criterio de desempate.

### Conteo clasico de tops y zonas con desempate

Implementado en `packages/scoring/src/classic-tops-zones.ts`.

**Resolucion del intento vigente:** por `(registrationId, problemId)`, gana el
`Attempt` con mayor `sequence`; los anteriores son correcciones superadas y
no cuentan.

**Agregacion por inscripcion (sobre sus intentos vigentes):**
- `tops`: numero de bloques con `top: true`.
- `topAttempts`: suma de `topAttempts ?? 1` sobre esos bloques. Un top no
  puede ocurrir en cero intentos, asi que un conteo faltante vale 1 (el mejor
  caso), nunca 0 — un 0 dejaria a un juez sin conteo por encima de alguien
  que de verdad hizo flash.
- **Topear un bloque siempre acredita su zona.** Un bloque cuenta para
  `zones` si `zone: true` **o** `top: true` (subir hasta arriba
  necesariamente pasa por la zona, con o sin que el juez tambien haya
  marcado `zone: true`).
- `zoneAttempts`: suma, sobre cada bloque acreditado con zona por la regla
  anterior, de `zoneAttempts ?? topAttempts ?? 1` — usa el conteo de zona si
  el juez lo registro, si no cae al conteo de top (la zona se alcanzo en a
  lo sumo esos intentos), si no hay ninguno, 1.

**DNS:** una inscripcion sin ningun intento registrado queda con
`tops: 0, topAttempts: 0, zones: 0, zoneAttempts: 0` y ranking al final.

**Orden de clasificacion:** `tops` descendente → `topAttempts` ascendente →
`zones` descendente → `zoneAttempts` ascendente.

**Empates:** ranking de competencia estandar — todas las inscripciones con
los cuatro valores identicos comparten `rank` y `tied: true`; el siguiente
rank distinto salta segun el tamano del grupo empatado (ej. tres empatadas
en 1 → la siguiente va en 4, no en 2).
### Puntos por bloque, estilo liga local

Implementado en `packages/scoring/src/league-points.ts`.

**Configuracion por bloque:** el organizador fija `topPoints` y `zonePoints`
por bloque (columnas `problems.topPoints` / `problems.zonePoints`, ambas
nullable). No hay una columna booleana separada para "este bloque da credito
por zona" — `zonePoints: null` (o el bloque ausente de la config) *es* ese
interruptor apagado.

**Puntaje por bloque (no aditivo):**
- Topeado (`top: true`) → `topPoints ?? 0` (solo top, sin importar
  `zonePoints`).
- No topeado pero en zona (`zone: true`) → `zonePoints` si es un numero (no
  `null` ni ausente); si no, 0.
- Ninguno de los dos, o el bloque falta por completo de la configuracion →
  0.

**Agregacion por inscripcion:** suma de los puntajes de cada bloque de la
ronda.

**DNS:** una inscripcion sin ningun intento registrado puntua 0 y queda al
final de la clasificacion.

**Orden de clasificacion:** puntaje total descendente.

**Empates:** empate real comparte `rank` y `tied: true`, sin segundo
criterio de desempate.

### Altura maxima en dificultad

Implementado en `packages/scoring/src/max-height.ts`.

**Puntaje por inscripcion:** la mayor `attempt.height` entre sus intentos
vigentes de la ronda, considerando todos los bloques de `config.problemIds`
(una ronda de dificultad en etapa 1 tiene un solo bloque en la practica, pero
el calculo toma el maximo, no asume exactamente uno). `height: null` (sin
intento, o un intento sin altura registrada) cuenta como 0.

**DNS:** una inscripcion sin ningun intento registrado puntua 0 y queda al
final de la clasificacion.

**Orden de clasificacion:** altura descendente.

**Empates:** empate real (misma altura, incluyendo decimales — la columna es
`numeric`, asi que un "45+" que un juez anote como `45.5` ordena bien sin
parseo especial del "+") comparte `rank` y `tied: true`, sin segundo
criterio de desempate.

### Llaves de velocidad
