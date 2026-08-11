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
y tres gráficas.

**Qué significan las dos columnas de intentos.** Un top pasa por la zona en el
camino, así que en `classic_tops_zones` un top cuenta también como zona: las "5
zonas" de quien topó 5 bloques son esos mismos bloques, no otros. Y cada columna
de intentos es la suma del intento en que se logró cada cosa, no cuántas veces lo
intentó: 5 tops en 9 intentos y 5 zonas en 7 son la misma escalada medida en dos
puntos de la ruta, no 16 intentos. Se lo preguntaron a la pantalla y la pantalla
no lo decía, así que ahora lo dice la leyenda, y el detalle por atleta muestra
"Top en 3 · Zona en 1" para que los dos números de arriba reconcilien bloque a
bloque.

La tabla separa el puntaje en dos pares con una divisoria —TOPS · INTENTOS |
ZONAS · INTENTOS— y las cifras van centradas bajo su título. La columna de
competidor mide lo que mide el nombre más largo y no se parte: todo el sobrante
de ancho se reparte entre las columnas de bloque, en vez de juntarse en un hueco
entre el dorsal y el primer bloque. Es la divisoria la
que hace legible el bloque, no un piso extra de encabezados: eso se probó y
engordaba la tabla a lo ancho sin decir nada nuevo. Esas cuatro columnas van a
ancho fijo, o estiran la tabla hasta el borde de la pantalla sin necesitarlo.
El encabezado se queda pegado arriba mientras la tabla se desplaza: en la fila
12 ya nadie recuerda cuál columna era cuál, y en una pantalla proyectada no se
puede volver a subir.

- **Puesto bloque a bloque** — una línea por competidora, todas, y el eje X es
  el bloque, no el intento. Cada punto es el puesto si la ronda hubiera cerrado
  ahí, que es la única vara que todas comparten: con intentos acumulados de
  coordenada, la gráfica se leía como que todas habían intentado 70 veces. Los
  intentos siguen bajo cada tick, como volumen de la categoría. Cada tramo sale
  y entra horizontal, así que la curva nunca inventa un puesto intermedio. Se
  reconstruye re-puntuando la ronda sobre los bloques 1..n (decisión #1: el
  pasado sigue en la tabla, no hay que guardar nada); un bloque que nadie ha
  escalado no entra al eje. Los dos extremos se titulan igual —"puesto tras el
  bloque N"—: "posición final" mentiría mientras queden bloques por escalar.
  En los empates el número viaja pegado al nombre, porque las etiquetas se
  separan para poder leerse y una etiqueta frente al carril 4 se leía como
  cuarto puesto cuando iba primera empatada. No hay columna de escala: con el
  puesto pegado a cada nombre en los dos extremos, esa columna solo repetía. Una
  guía punteada amarra cada etiqueta con el extremo de su línea, porque las
  etiquetas se separan entre sí para poder leerse y entonces no caen sobre su
  propio carril; es eso o una grilla, y una grilla compite con las curvas. A la
  derecha no hace falta —el nodo y su nombre están en el mismo renglón y a un
  palmo—, pero sí una guía del final del nombre a su chip de cambio: el chip
  solo aparece para quien se movió, y con dos vecinas quietas nada decía de
  quién era ese ▼12. Esa guía arranca en el ancho **medido** del nombre
  (`getComputedTextLength`), no en una posición fija: es la única forma de que no
  pase por debajo de las letras con cualquier largo de nombre. Extender la banda
  del carril hasta el chip también resolvía el amarre y se descartó: sacaba la
  piel de la gráfica fuera de la gráfica.
  Abajo va una sola palabra, "bloques"; los intentos acumulados estuvieron ahí
  y eran dos filas de texto para un dato que nadie viene a buscar.
- **¿Qué tan duros estaban los bloques?** — tops y zonas por bloque, del más
  duro al más amable, marcando el crux. Con los mismos tops desempata el flash:
  once tops de los cuales seis salieron al primer intento no es el mismo bloque
  que once tops peleados, y sin ese desempate el orden lo decidía el número del
  bloque. Señalar un tramo de la barra apaga los otros dos y escribe qué mide ese
  color ("7 llegaron a la zona sin top", "1 llegó a la zona sin top"): un color
  solo no dice qué está contando. La fila que lo escribe reserva su alto aunque
  esté vacía, o el texto empuja las barras justo cuando les apuntas.
- **Cuántos intentos al top** — promedio de intentos por top, mínimo dos tops
  para entrar (si no, un flash suelto encabeza por encima de quien hizo cinco).

Señalar a una competidora la resalta al tiempo en la tabla, en su línea y en su
barra; el resto baja a 0.45 y no a 0.2, porque el contexto es justamente lo que
hace que resaltar signifique algo. En el teléfono no hay hover: tocarla la deja
fija y su detalle se abre en la fila de la tabla, un espacio propio, en vez de
un globo encima de la gráfica que se quería mirar. La gráfica de líneas no se
encoge en pantalla chica, se desplaza.

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

- Una decisión abierta: si la plata se deja en acero frío sabiendo lo de arriba.
- El caso de 25 competidoras se probó en pantalla, no en el papel: el carril
  adaptativo (`620 / campo`, entre 22 y 38 px) las mete a las 25 en el mismo
  alto que tenían 14, con etiqueta directa y sin superposición. El recorte a
  ocho líneas ya se probó y era peor. La ronda de 7 bloques también se probó:
  los títulos de los extremos salen del primer y del último punto, así que
  dicen "puesto tras el bloque 7" solos.
- Falta verlo por debajo de 500 px de ancho: Chrome no deja achicar más la
  ventana. A 500 px la gráfica y la tabla se desplazan a lo ancho dentro de su
  caja y la página no se desborda.
- El formato `league_points` sigue sin verse en pantalla con datos reales.
  `classic_tops_zones` ya se ve, gracias a `pnpm seed:event`.

### Fuera del alcance

Pagos en línea, múltiples organizaciones con roles, notificaciones, exportación a formatos federativos, cualquier deporte que no sea escalada. Ver también CLAUDE.md.

### Criterio de desbloqueo de la etapa 2

Un gimnasio real corrió un evento con ≥20 inscritos sin soporte manual del desarrollador el día del evento.

## Ideas registradas para etapa 2 (no implementar aun)

- **Dos decisiones de diseno que ya sabemos que hay que tomar** (2026-08-11, del
  analisis de competencia en `00-tesis.md`). Ninguna se construye ahora: la etapa
  2 esta bloqueada y el esquema necesita aprobacion explicita.

  1. **Modelar el bloque de entrenamiento.** Hoy `problems` cuelga de un `round`,
     que cuelga de un evento, asi que un bloque solo existe dentro de una
     competencia. El foso de la etapa 2 —comparar varios escaladores sobre el
     mismo bloque— vive en el entrenamiento: el entrenador monta un bloque y pone
     a sus alumnos a intentarlo. Ese bloque no tiene donde vivir en el modelo.
  2. **Fila por intento fisico.** Una fila de `attempts` es el *estado* de
     (atleta, bloque) —`resolveCurrentAttempts` se queda con la de mayor
     `sequence` y las correcciones son filas nuevas—, no un registro por intento.
     Colgar el video del intento #2 de un bloque exige modelar el numero de
     intento.

- **Revision de literatura y taxonomia de fallas por fase de movimiento.** Es la
  parte del diferencial que no se copia. Se hace al cierre de la V1 de
  competencias, con el conocimiento del fundador como filtro.

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
