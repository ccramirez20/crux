# Etapas

La tabla resumen vive en CLAUDE.md porque se consulta en cada turno.
Aqui va el detalle: para cada etapa, el alcance exacto, lo que queda
explicitamente fuera, y el criterio de desbloqueo de la siguiente.

## Etapa 1 — ACTIVA

### Dentro del alcance

- Autenticación de organizador (sign-up con código de acceso, sign-in) — **listo**
- Recuperación de contraseña ("olvidé mi clave") para cuentas con clave — **pendiente**. Hoy no existe: la clave se guarda hasheada con scrypt, así que una cuenta sin acceso solo se recupera tocando la base a mano. Es tapón real, no comodidad: el organizador entra al panel una vez cada varios meses, justo antes de un evento, que es el peor momento para quedar afuera. Requiere decidir cómo se manda el correo (proveedor + dominio); esa decisión es lo único que lo bloquea, no el código.
- Panel del organizador: crear evento, categorías, rondas, bloques — **listo**
- Inscripción pública (`/inscripcion/[slug]`, sin cuenta), con dedupe de atleta por documento y elegibilidad por edad/género contra la fecha del evento — **listo**
- Captura de intentos por juez, offline-first — **listo**, probado en teléfono real
- Scoring en vivo (`packages/scoring`) — **listo**: `classic_tops_zones`, `ifsc_boulder`, `league_points`, `max_height`, con tests de empate. Conectado a la tabla pública desde `apps/web/lib/leaderboard.ts`.
- Tabla pública de resultados (`Leaderboard`) — **lista, en pulido de interfaz**. `/resultados/[slug]`, cálculo real vía `scoreRound`, refresco de 5s sobre respuesta cacheada, filtro por categoría y ronda, desempates en columnas visibles, detalle por competidor y tres gráficas. Lo que queda es acabado visual, no funcionalidad.
- Historial de competidor entre eventos — el modelo de datos ya lo soporta (un `Athlete` se reutiliza entre inscripciones por `documentId`); falta la vista pública de perfil
- Manual de uso corto, en lenguaje natural, como HTML diseñado y autocontenido (un archivo, se comparte por WhatsApp o se abre sin internet) — **al cerrar la etapa**, cuando el flujo ya no cambie

### La tabla pública no es una tabla a secas

Es la pantalla que ve toda la sala al mismo tiempo, proyectada, durante horas.
No es un `<table>` con bordes. Requisitos de producto, no adornos:

- Identidad visual de montaña y escalada (ver el sistema de diseño Páramo y `components/topographic-motif`), no un dashboard genérico. — listo
- Se actualiza sola en tiempo real (decisión #4: polling de 5s sobre respuesta cacheada; SSE solo si hace falta). — listo
- Interactiva: filtrar por categoría y ronda, ver el detalle de un competidor. — listo
- Gráficas que digan algo útil e interesante, no decorativas — progresión de la ronda, dificultad real de cada bloque, quién se movió de puesto. — listo, en SVG a mano y sin dependencia nueva. Costaron 6.5 kB en `/resultados/[slug]`; una librería de gráficas habría sumado más de 100 kB a la pantalla de más tráfico del producto.
- Tablas legibles a distancia, con los desempates visibles para que nadie los discuta. — listo: cada formato despliega sus propias columnas, y en `classic_tops_zones` esas cuatro columnas son exactamente el orden de desempate.

Es la cara pública del producto: es lo que el gimnasio muestra y lo que hace
que el siguiente gimnasio pregunte. Diseñarla como una pantalla, no como un CRUD.

#### Lo que hay hoy en la pantalla

Tres tiles arriba (el bloque más duro, el porcentaje de flash de la ronda, el
mayor ascenso), la tabla con una franja de leyenda que enseña su propio código,
y tres gráficas:

- **Bloque a bloque** — puesto contra intentos juzgados en la categoría. Cada
  tramo sale y entra horizontal, así que la curva nunca inventa un puesto
  intermedio: muestra un puesto sostenido y luego cambiado. Se reconstruye
  re-puntuando la ronda en 12 prefijos de `attempts` (decisión #1: el pasado
  sigue en la tabla, no hay que guardar nada).
- **¿Qué tan duros estaban los bloques?** — tops y zonas por bloque, del más
  duro al más amable, marcando el crux.
- **Cuántos intentos al top** — promedio de intentos por top, mínimo dos tops
  para entrar (si no, un flash suelto encabeza por encima de quien hizo cinco).

Señalar a una competidora la resalta al tiempo en la tabla, en su línea y en su
barra.

#### Reglas de color que ya costaron una corrección

El color de estas gráficas se valida con el script del skill `dataviz`, no se
elige a ojo. Dos resultados que hay que respetar:

- **Oro y sage** —los colores de los badges de la tabla— fallan el piso de
  visión normal (ΔE 12.4) cuando van como segmentos apilados contiguos.
  Funcionan como piezas sueltas, no pegados. En las barras se usa oro + pine
  (ΔE 41).
- **El podio va en oro / plata / bronce, y la plata tiene que ser acero frío**
  (`#8FA3AE`). El gris cálido que uno elegiría por instinto queda a ΔE 14.4 del
  oro, bajo el piso: mucha gente no distinguiría el primero del segundo.
  Validados como tripleta contra todos los pares: 17.6 normal, 16.0 protan.
- Páramo no tiene ocho tintes distinguibles para ocho líneas (pine↔bark da
  9.7), así que en la gráfica de puestos la identidad va por **etiqueta directa**
  y solo el podio lleva color.

#### Pendiente de esta pantalla

- Feedback de interfaz en curso; queda al menos una ronda más de ajustes.
- Dos decisiones abiertas: si la plata se deja en acero frío sabiendo lo de
  arriba, y si los carriles de abajo en "Bloque a bloque" se recortan (se ven
  vacíos, pero es cierto que alguna de las ocho cayó hasta ese puesto).
- El formato `league_points` sigue sin verse en pantalla con datos reales.
  `classic_tops_zones` ya se ve, gracias a `pnpm seed:event`.

### Fuera del alcance

Pagos en línea, múltiples organizaciones con roles, notificaciones, exportación a formatos federativos, cualquier deporte que no sea escalada. Ver también CLAUDE.md.

### Criterio de desbloqueo de la etapa 2

Un gimnasio real corrió un evento con ≥20 inscritos sin soporte manual del desarrollador el día del evento.

## Ideas registradas para etapa 2 (no implementar aun)

- **Feedback del entrenador como input del diagnostico.** En el plan pago de
  entrenador, que el entrenador pueda personalizar/anotar la descripcion o
  contexto de cada escalador (ej: "esta corrigiendo lock-off", "lesion previa
  en hombro derecho", "nivel real vs categoria inscrita"). El diagnostico
  automatico de video debe leer ese contexto y ajustar o priorizar lo que
  reporta, en vez de ser puramente algoritmico. Diferenciador adicional:
  mas "human in the loop" que competidores (BetterClimber, Cima, Climbalyzer,
  Belay.ai) que solo dan metricas sueltas.
  Preguntas abiertas para cuando se disene esta etapa: el feedback se
  guarda por escalador o por intento especifico; como evita el sistema que el
  entrenador "fuerce" el diagnostico a decir lo que quiere; se muestra al
  escalador que el entrenador escribio esto.
