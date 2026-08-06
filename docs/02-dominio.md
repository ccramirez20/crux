# Dominio — reglas largas

El glosario corto vive en CLAUDE.md. Aqui van las reglas de scoring completas:
formulas por formato, desempates, casos de borde conocidos y ejemplos reales de
competencias pasadas que sirven como casos de prueba.

## Formatos de puntaje a soportar
### Puntos IFSC de bloque
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
### Altura maxima en dificultad
### Llaves de velocidad
