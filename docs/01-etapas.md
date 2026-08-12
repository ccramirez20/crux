# Etapas

La tabla resumen vive en CLAUDE.md porque se consulta en cada turno.
Aqui va el detalle: para cada etapa, el alcance exacto, lo que queda
explicitamente fuera, y el criterio de desbloqueo de la siguiente.

## Etapa 1 — ACTIVA

### Dentro del alcance

- Autenticación de organizador (sign-up con código de acceso, sign-in) — **listo**
- Recuperación de contraseña ("olvidé mi clave") — **fuera de la etapa 1 por decisión del 2026-08-12**. Necesita correo transaccional, que necesita dominio propio, y CR decidió no comprar dominio por ahora. Hay vía gratis (Brevo o SendGrid verifican un remitente suelto sin dominio) y se descartó por lo mismo que está escrito abajo: un "olvidé mi clave" saliendo de un Gmail cae en spam el único día que importa. Se queda el hueco, y el manual lo dice: una cuenta sin acceso se recupera a mano en la base.
- Panel del organizador: crear evento, categorías, rondas, bloques — **listo**. Edición de lo que es seguro editar y lista de inscritos con dorsales, desde el 2026-08-12 — detalle abajo
- Inscripción pública (`/inscripcion/[slug]`, sin cuenta), con dedupe de atleta por documento y elegibilidad por edad/género contra la fecha del evento — **listo**
- Captura de intentos por juez, offline-first — **listo**, probado en teléfono real
- Scoring en vivo (`packages/scoring`) — **listo**: `classic_tops_zones`, `ifsc_boulder`, `league_points`, `max_height`, con tests de empate. Conectado a la tabla pública desde `apps/web/lib/leaderboard.ts`.
- Tabla pública de resultados (`Leaderboard`) — **lista, en pulido de interfaz**. `/resultados/[slug]`, cálculo real vía `scoreRound`, refresco de 5s sobre respuesta cacheada, filtro por categoría y ronda, desempates en columnas visibles, detalle por competidor y tres gráficas. Lo que queda es acabado visual, no funcionalidad.
- Historial de competidor entre eventos — **listo**. `/competidor/[athleteId]`, enlazado desde el panel desplegado de cada fila de la tabla pública. Detalle abajo
- Manual de uso corto, en lenguaje natural, como HTML diseñado y autocontenido (un archivo, se comparte por WhatsApp o se abre sin internet) — **listo el 2026-08-12**, en `docs/manual.html`. Cero referencias externas, así que abre sin señal; tipografías del sistema a propósito (embeber Space Grotesk costaba más de 100 kB y el color y el motivo topográfico ya cargan la identidad). Cubre organizador y jueces; la sección de jueces va en su propio marco para poder reenviarse sola. No se sirve desde la app: no hay ruta `/manual` ni `apps/web/public/`, se comparte a mano. Escribirlo destapó tres huecos que el código no dejaba ver, y los tres se cerraron el mismo día — ver abajo
- Despliegue — **pendiente, y es lo único que separa a la etapa 1 de estar terminada**. Crux solo existe en `localhost` o en IP de LAN, así que correr un evento real hoy significa que el desarrollador lleve un portátil y lo mantenga vivo, que es exactamente la condición que impide desbloquear la etapa 2. Va en Vercel, plan gratis; los pasos y las cuatro variables de entorno están en `docs/despliegue.md`. Lo único que no se puede automatizar es el login de Vercel y conectar el repositorio
- Portada pública (`/`) — **agregada por decisión explícita el 2026-08-11**, no estaba en la lista original. La tesis dice que el canal es "el siguiente gimnasio llega porque vio la tabla en vivo del anterior", así que la tabla pública lleva un gancho de una línea al pie y la portada es donde aterriza ese clic. Lleva imagen de Open Graph para poder moverse por redes. Sin precios: se cobra a mano y falta la conversación con el gimnasio piloto. Las fotos reales entran cuando corra el primer evento; hasta entonces la imagen es la interfaz del producto

### El correo se aplaza entero hasta que haya dominio

Decidido el 2026-08-12. Hay dos necesidades de correo y una sola respuesta.

El `mailto:` de contacto de la portada lo resolvería cualquier Gmail. La
recuperación de contraseña no: necesita correo transaccional, y sin dominio
propio no hay forma decente de mandarlo. Resend solo deja enviar a la cuenta
del dueño hasta que se verifica un dominio, y el SMTP de Gmail con contraseña
de aplicación entrega mal — el correo de "olvidé mi clave" cae en spam justo el
día que el organizador está afuera, que es el único día que importa.

Así que no se pone un Gmail de relleno mientras tanto. Cuando se compre el
dominio se monta todo de una: contacto y transaccional con correos propios.
Hasta entonces `CONTACT_EMAIL` en `app/(public)/page.tsx` sigue vacío y el
enlace no se dibuja.

Lo que hace falta el día que se compre: un dominio (~$12-15 USD/año un .com,
~$25 un .co), la cuenta de Resend (tier gratis, 3.000 correos al mes) y los
registros DNS de verificación. Resend tiene API REST, así que se llama con
`fetch` y no entra una dependencia nueva. El único paso que no se puede
automatizar es comprar el dominio y poner los DNS.

### El perfil del competidor

`/competidor/[athleteId]`, público y sin cuenta. Se llega desde el panel
desplegado de cada fila de la tabla: "Ver historial de …".

**Va `noindex`.** Es nombre completo e historial deportivo de terceros que
inscribió el organizador, posiblemente menores; bajo la Ley 1581 de 2012 eso no
se publica en un buscador sin consentimiento. Se ve con el enlace, no entra a
Google. La URL usa el UUID del atleta, nunca el documento. Indexarlo después es
fácil; desindexarlo no.

**No recalcula puntaje.** Cada evento se pide a `getLeaderboard`, que ya pasó
por `scoreRound` y ya está cacheado; el perfil solo lee la fila del atleta y
suma. El puesto que muestra de un evento es el de la ronda más avanzada en la
que apareció: si llegó a la final, la clasificatoria ya no lo describe.

**Qué se puede cruzar entre eventos y qué no.** Esta es la regla de la pantalla.
El puntaje no se cruza: los cuatro formatos miden cosas distintas y una línea
que junte puntos IFSC con conteo de tops mentiría. Se cruzan tres cosas:

- Los conteos crudos — un top es un top venga del formato que venga, y un metro
  es un metro. De ahí salen bloques intentados, tops, zonas, flashes; y en
  dificultad rutas intentadas, completadas y altura máxima.
- La **posición relativa al campo**, `(campo − puesto) / (campo − 1)`. Un 8.º de
  26 es mejor resultado que un 3.º de 5, y el puesto pelado no lo dice. Es lo
  que ordena "tus mejores resultados" y lo que mide la tendencia. Ordenar por
  puesto crudo es el bug que esta pantalla existe para no cometer, y hay un test
  que lo fija (`athlete-profile.test.ts`).
- El podio: top 3 es top 3 en cualquier formato.

Por eso **el puesto nunca aparece solo**: siempre "3.º de 24".

**Lo que hay en pantalla.** Cifras de carrera agrupadas por modalidad, una barra
apilada de en qué terminó cada bloque intentado (topado / zona sin top / sin
zona), los tres mejores resultados con su medidor de posición dentro del campo,
y una frase de tendencia contra la competencia anterior. Si el resultado fue
peor, la frase lo dice sin suavizarlo. Con una sola competencia no hay
tendencia y la pantalla lo dice en una línea.

**Se descartó la gráfica de progresión entre eventos.** Sobre puntaje mentiría.
Sobre posición relativa sería honesta, pero con dos o tres fechas es una línea
de dos o tres puntos que no dice nada que la frase no diga ya; el medidor por
resultado funciona desde la primera competencia. Entra el día que una liga
tenga historia de verdad.

**Colores de la barra.** Oro para el top y verde para la zona son los de la
tabla, para que las dos pantallas hablen el mismo idioma, pero el verde es
`pine` y no el `sage` de las insignias: aquí los rellenos se tocan y sage contra
oro se cae a ΔE 12.4 en visión normal, bajo el piso de 15. Pine contra oro da
41.1, y 36.1 bajo protanopía. Validado con `validate_palette.js`, no elegido a
ojo. Además van 2 px de hueso entre tramos y cada uno lleva su cifra escrita.

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
- `league_points` ya se ve con datos reales desde el 2026-08-12: `pnpm
  seed:event` siembra la **Copa Suesca** con ese formato y con puntos
  escalonados por bloque (100 · 40 hasta 600 · sin zona). Mirarla cambió la
  tabla: el encabezado de cada bloque ahora lleva lo que paga su top y su zona,
  porque sin el precio a la vista una fila es cinco casillas doradas y un
  puntaje de 1600 sin nada que los conecte. Ahí también se anuncia el bloque
  sin crédito parcial, que es el que genera el reclamo si no se dice antes.
- Empates: `league_points` no tiene desempate ninguno y en la copa sembrada se
  ve — hay tres competidoras en `=3`. Es propiedad del formato, no defecto; si
  un gimnasio real lo pide, el desempate se agrega como estrategia aparte.

### Lo que el manual destapó, y cómo quedó (2026-08-12)

Escribir el manual obliga a decir en voz alta lo que el producto hace, y ahí se
ven los huecos que leyendo el código no se ven. Los tres se cerraron el mismo
día.

- **El panel no mostraba a los inscritos.** Solo el conteo en la tarjeta del
  evento. Se descubrió buscando dónde se ponía el dorsal y resultando que no
  había ni lista. Ahora hay `Inscritos` por categoría, y la lectura que
  encabeza no es cuántos hay sino **cuántos van sin dorsal**, que es lo que
  importa la mañana del evento.
- **Nadie asignaba dorsales**, y la pantalla de inscripción se lo prometía al
  competidor. `bibNumber` se leía en tres pantallas y no lo escribía ninguna
  fuera del seed. Ahora se escribe a mano por inscrito, y hay un botón que
  numera en orden de inscripción **solo las casillas vacías**, para el gimnasio
  que ya repartió petos impresos. El dorsal sigue siendo opcional: sin él el
  juez busca por nombre.
- **No había pantalla de edición de nada.** Ahora se editan nombre, fecha, zona
  horaria y código de jueces del evento, y número, nombre y puntos de un
  bloque. Rotar un código de juez filtrado era imposible sin SQL y era el peor
  de los tres. Quedan fuera a propósito, y el formulario dice por qué: el
  `slug` (vive dentro de cada QR impreso y de cada enlace compartido) y la
  modalidad y el formato de puntaje (reinterpretan intentos ya capturados, y el
  puntaje es derivado). Editar los puntos de un bloque **sí** es seguro: no
  toca ningún intento, la tabla se recalcula sola.

### El freno de fuerza bruta dejaba afuera a los jueces buenos

Los dos endpoints que exigen código de juez (`/api/judge-access` y
`/api/attempts`) consultaban el limitador **antes** de validar el código. Una
wifi de gimnasio es una sola IP pública, así que los tres teléfonos comparten
cubeta: cinco dedazos de un juez bloqueaban a los otros dos, y en la ruta de
intentos un juez que volvía de una zona muerta con la cola llena recibía 429 en
cada sincronización por culpa ajena. El freno pasó a vivir solo en la rama del
código malo. Un código correcto ya nunca se topa con él, y el ataque sigue
frenado porque un código malo jamás pasa de ahí.

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
  parte del diferencial que no se copia. Primera pasada hecha el 2026-08-11 en
  `03-biomecanica.md`: la literatura da el ciclo de tres fases
  (estabilizacion → preparacion → desplazamiento), la fluidez por jerk de cadera
  y numeros de tiempo-movimiento de competencia, pero **no da catalogo de fallas,
  ni umbrales, ni validacion contra resultado**. El borrador de taxonomia espera
  correccion de CR antes de que se escriba una linea de codigo.

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
