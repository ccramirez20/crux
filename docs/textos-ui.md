# Inventario de textos de la interfaz — CRUX

Todo el texto en español que ve un usuario de la aplicación, extraído
directamente del código y organizado por pantalla. Es un documento de
**solo lectura**: no cambia nada por sí mismo. Sirve para que revises la
redacción completa y me devuelvas tu versión; con eso aplico los cambios
archivo por archivo.

## Cómo usarlo

Cada tabla tiene cuatro columnas: dónde vive el texto en el código
(**Línea**), en qué parte de la pantalla aparece (**Dónde aparece**), el
texto **tal como está hoy**, y una columna **Tu versión** en blanco para que
escribas ahí el reemplazo. Deja la celda vacía en las filas que no quieras
tocar — solo aplico lo que llenes.

Dos cosas a tener en cuenta al escribir:

- **Los `${...}` son datos que cambian en cada carga** (un nombre, un
  número, una fecha) — respeta dónde caen, pero el texto fijo alrededor sí
  es tuyo para reescribir.
- **Los textos entre corchetes de `lib/labels.ts`** (Boulder / Bloque, Lead
  / Dificultad, Top, Zona, Clasificatoria/Semifinal/Final, etc.) están
  **fuera de este documento a propósito** — es la jerga ya decidida el
  2026-08-10 y documentada en `apps/web/CLAUDE.md`. Estas tablas los citan
  entre comillas donde aparecen envueltos en una frase, pero el diccionario
  en sí va aparte, en el Apéndice A, solo como referencia.

## Índice

**Parte 1 — Público, cuenta y acceso**
Portada · Inscripción · Política de datos · Iniciar sesión · Crear cuenta ·
404 · Mensajes de autenticación · Componentes compartidos (contraseña,
aviso de privacidad) · Errores de `judge-access` y `organization-logo`

**Parte 2 — Resultados, proyección, competidor**
Tabla pública de resultados (incluye sus gráficas) · Pantalla de proyección
· Historial de competidor · Página de destino de la tarjeta compartible

**Parte 3 — Panel del organizador y Juzgar**
Panel: dashboard, nuevo evento, detalle del evento (encabezado, compartir,
categorías/rondas/bloques, inscritos), invitaciones, organización,
componentes compartidos · Juzgar: código del evento, identidad del juez,
listado de competidores, captura de intentos, errores de la API

**Apéndice A — Diccionario de jerga** (`lib/labels.ts`, fuera de este
inventario, solo de referencia)

**Apéndice B — Textos con lógica de negocio mezclada** (no son edición
directa de string: `lib/share-card.ts`, la imagen de la tarjeta compartible,
y los encabezados del CSV)

---

# Inventario de textos — Parte 1: público, inscripción, cuenta

Alcance: portada (`/`), inscripción (`/inscripcion/[slug]`), privacidad
(`/privacidad`), `/sign-in`, `/sign-up`, 404 (`not-found.tsx`), mensajes de
`lib/auth-error-messages.ts`, y componentes compartidos usados por estas
pantallas (`password-field.tsx`, `privacy-notice.tsx`). No cubre `/panel`,
`/juzgar`, `/resultados`, `/competidor`, tarjetas ni CSV.

---

## Portada (/)
**Archivo:** `apps/web/app/(public)/page.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 14 | `<title>` de la pestaña / metadata | "Crux — Competencias de escalada" |  |
| 16 | Meta description | "Inscripción por enlace, jueces que puntúan desde el celular aunque se caiga el wifi, y una tabla pública que se actualiza sola." |  |
| 18 | Open Graph, título compartido | "Crux — Competencias de escalada" |  |
| 19 | Open Graph, descripción compartida (= `HEADLINE` de `lib/labels.ts`) | "Todos los bloques. Todos los pegues. Una sola tabla." |  |
| 42 | Paso 1, título | "Publicas el enlace" |  |
| 43 | Paso 1, cuerpo | "Creas el evento con sus categorías y rondas, y compartes un enlace. La gente se inscribe sola, sin crear cuenta." |  |
| 46 | Paso 2, título | "Los jueces puntúan desde el celular" |  |
| 47 | Paso 2, cuerpo | "Cada juez registra tops, zonas e intentos. Si el wifi se cae, la app sigue funcionando y el juez puede seguir puntuando. Lo que quedó pendiente se sincroniza solo cuando vuelve la señal." |  |
| 50 | Paso 3, título | "La tabla se actualiza sola" |  |
| 51 | Paso 3, cuerpo | "El puntaje sale de los intentos, no se escribe a mano. Nadie suma en papel y nadie discute un puesto." |  |
| 119 | Rótulo de marca, sobre las curvas de nivel del encabezado | "CRUX" |  |
| 127-131 | Titular principal, hero (una línea por `<span>`, de `HEADLINE_LINES`) | "Todos los bloques." / "Todos los pegues." / "Una sola tabla." |  |
| 134-137 | Párrafo bajo el titular | "CRUX corre competencias de escalada de principio a fin: inscripción por enlace, jueces que puntúan desde el celular aunque se caiga el wifi, y una tabla pública que se actualiza sola." |  |
| 142 | Botón, llamado a la acción principal | "Ver una tabla en vivo" |  |
| 145 | Botón/enlace secundario | "Entrar como organizador" |  |
| 154 | Rótulo de sección (eyebrow) | "La pantalla del evento" |  |
| 156 | Subtítulo de sección | "La sala entera sabe quién va ganando, sin preguntarle a nadie." |  |
| 158-163 | Párrafo de sección | "Una pantalla fácil de leer desde lejos durante todo el evento, con colores pensados en el páramo y los desempates a la vista. La proyectas al empezar la ronda y no la vuelves a tocar: se actualiza sola cada vez que un juez registra un intento, así que nadie interrumpe a quien organiza para preguntar en qué puesto va." |  |
| 172 | Leyenda de la tabla de muestra, junto al cuadro dorado | "Top" |  |
| 175 | Leyenda de la tabla de muestra, junto al cuadro verde | "Zona" |  |
| 177 | Leyenda de la tabla de muestra, texto explicativo | "Los números son la cantidad de intentos." |  |
| 182 | Encabezado de columna, tabla de muestra | "Puesto" |  |
| 183 | Encabezado de columna, tabla de muestra | "Competidor" |  |
| 184 | Encabezado de columna, tabla de muestra | "B1" |  |
| 185 | Encabezado de columna, tabla de muestra | "B2" |  |
| 186 | Encabezado de columna, tabla de muestra | "B3" |  |
| 187 | Encabezado de columna, tabla de muestra | "Tops" |  |
| 188 | Encabezado de columna, tabla de muestra | "Intentos" |  |
| 194, 207, 219 | Nombres de competidores de ejemplo, tabla de muestra | "Mariana Restrepo" / "Emilia Zapata" / "Salomé Arango" |  |
| 237 | Enlace bajo la tabla de muestra | "Ver la tabla completa de un evento, con sus gráficas" |  |
| 243 | Título de sección | "Cómo funciona" |  |
| 259 | Rótulo de sección (eyebrow) | "Si organizas" |  |
| 260-262 | Subtítulo de sección | "Gimnasio, club o liga" |  |
| 263-266 | Párrafo de sección | "Defines categorías, rondas y el formato de puntaje que ya usas —tops y zonas, puntos IFSC, puntos por bloque, altura máxima— y el día del evento te dedicas al evento." |  |
| 269 | Rótulo de sección (eyebrow) | "Si compites" |  |
| 270 | Subtítulo de sección | "No necesitas cuenta" |  |
| 271-274 | Párrafo de sección | "Te inscribes por el enlace que te pasa quien organiza, y ves los resultados desde el teléfono mientras la ronda corre. Tu historial se acumula entre eventos." |  |
| 279-281 | Título del pie de página | "¿Vas a organizar una competencia?" |  |
| 282-283 | Párrafo del pie de página | "Está hecho en Colombia y en español, para las competencias que ya se corren aquí." |  |
| 287 | Botón, pie de página | "Crear una cuenta de organizador" |  |
| 290 | Botón/enlace, pie de página | "Ver la demostración" |  |
| 296 | Enlace de correo, pie de página | "Escríbenos" |  |

---

## Inscripción (/inscripcion/[slug])
**Archivos:** `apps/web/app/(public)/inscripcion/[slug]/page.tsx` (página),
`registration-form.tsx` (formulario cliente), `actions.ts` (server action —
mensajes de error/éxito que el formulario muestra tal cual).

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 50 | `page.tsx`, rótulo pequeño sobre el nombre del evento | "Inscripción" |  |
| 53-54 | `page.tsx`, subtítulo bajo el nombre del evento (interpolado) | `${labelFor(DISCIPLINE_LABEL, event.discipline)}` + opcional ` · ${formatEventDate(event.date)}` |  |
| 61-65 | `page.tsx`, aviso cuando las inscripciones ya cerraron (interpolado) | "Las inscripciones se cerraron" + opcional ` el ${formatEventDate(event.registrationDeadline)}` + ". Si necesitas entrar, habla con quien organiza." |  |
| 68-71 | `page.tsx`, aviso cuando el evento no tiene categorías todavía | "Las inscripciones todavía no están abiertas: quien organiza aún no ha creado las categorías. Vuelve a intentarlo más tarde." |  |
| registration-form.tsx:74 | Mensaje de éxito, tarjeta de confirmación (interpolado) | `Quedaste inscrito en ${category?.name ?? 'la categoría seleccionada'}.` |  |
| registration-form.tsx:76 | Mensaje de error genérico si el envío falla por excepción | "No se pudo completar la inscripción, intenta de nuevo." |  |
| registration-form.tsx:85 | Tarjeta de confirmación, texto principal (= el mensaje de éxito de arriba) | — (ver fila anterior) |  |
| registration-form.tsx:87-89 | Tarjeta de confirmación, texto secundario | "El día del evento te asignan un dorsal y con ese número los jueces registran tus intentos. No necesitas crear cuenta ni instalar nada." |  |
| registration-form.tsx:95 | Tarjeta de confirmación, aviso sobre corregir categoría | "¿Te equivocaste de categoría? Avísale a quien organiza: solo ellos pueden cambiarte." |  |
| registration-form.tsx:105 | Etiqueta de campo | "Nombre completo" |  |
| registration-form.tsx:120 | Etiqueta de campo | "Documento de identidad" |  |
| registration-form.tsx:132 | Texto de ayuda bajo el documento | "Con él reconocemos que eres tú si vuelves a competir, y así se conserva tu historial." |  |
| registration-form.tsx:138 | Etiqueta de campo | "Fecha de nacimiento" |  |
| registration-form.tsx:154 | Etiqueta de campo | "Género" |  |
| registration-form.tsx:170 | Opción por defecto del selector de género | "Elige una opción" |  |
| registration-form.tsx:171 | Opción del selector de género | "Masculino" |  |
| registration-form.tsx:172 | Opción del selector de género | "Femenino" |  |
| registration-form.tsx:173 | Opción del selector de género | "Otro" |  |
| registration-form.tsx:179 | Aviso mientras falta fecha o género | "Completa tu fecha de nacimiento y género para ver en qué categorías puedes competir." |  |
| registration-form.tsx:184 | Etiqueta de campo, selector de categoría | "Tu categoría" |  |
| registration-form.tsx:193 | Opción por defecto del selector de categoría | "Elige una opción" |  |
| registration-form.tsx:201 | Texto de ayuda bajo el selector de categoría | "Solo aparecen las categorías que corresponden a tu edad y género." |  |
| registration-form.tsx:206-207 | Aviso cuando no hay categoría elegible | "Este evento no tiene ninguna categoría para tu edad y género. Si crees que es un error, escríbele a quien organiza." |  |
| registration-form.tsx:214 | Etiqueta de campo, autorización de menor | "Nombre de quien autoriza (padre, madre o acudiente)" |  |
| registration-form.tsx:225-227 | Texto de ayuda bajo autorización de menor | "El competidor es menor de edad: quien lo inscribe debe ser su padre, madre o acudiente, y autoriza el tratamiento de sus datos al escribir su nombre aquí." |  |
| registration-form.tsx:244 | Botón, estado enviando | "Inscribiendo…" |  |
| registration-form.tsx:244 | Botón, estado normal | "Inscribirme" |  |
| actions.ts:33 | Error de validación Zod, falta autorización de menor | "Falta el nombre de quien autoriza, porque el competidor es menor de edad." |  |
| actions.ts:42 | Error de validación genérico (fallback) | "Datos de inscripción inválidos." |  |
| actions.ts:53 | Error por límite de tasa (rate limit) | "Demasiadas inscripciones desde esta conexión. Espera unos minutos y vuelve a intentar." |  |
| actions.ts:76 | Error, categoría no pertenece al evento | "Esa categoría no existe para este evento." |  |
| actions.ts:84 | Error, inscripciones cerradas (revalidado en el envío) | "Las inscripciones para este evento ya se cerraron." |  |
| actions.ts:89 | Error, categoría no corresponde a edad/género | "Esa categoría no corresponde a tu edad o género." |  |
| actions.ts:111, 138 | Error, documento ya registrado con otros datos | "Ese documento ya está registrado con una fecha de nacimiento o género diferente." |  |
| actions.ts:164 | Error, ya inscrito en el evento (interpolado, `donde` puede estar vacío o ser ` en ${previa.categoryName}`) | `` Ya estás inscrito en este evento${donde}. Si te equivocaste de categoría, pídele el cambio a quien organiza. `` |  |

---

## Política de tratamiento de datos (/privacidad)
**Archivo:** `apps/web/app/(public)/privacidad/page.tsx` (usa
`RESPONSABLE_NOMBRE` y `CONTACTO_DATOS` de `apps/web/lib/privacy.ts`:
"Christian Ramírez" y "contacto@cruxcompetencias.com").

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 7 | `<title>` de la pestaña / metadata | "Política de tratamiento de datos · CRUX" |  |
| 19 | Enlace de marca, sobre el titular | "CRUX" |  |
| 21-23 | Titular principal | "Política de tratamiento de datos personales" |  |
| 24-25 | Subtítulo, base legal | "En cumplimiento de la Ley 1581 de 2012 y el Decreto 1377 de 2013." |  |
| 30 | Encabezado de sección | "Responsable" |  |
| 31-37 | Cuerpo de la sección "Responsable" (interpolado) | `${RESPONSABLE_NOMBRE}, operando la plataforma CRUX ( ` + "cruxcompetencias.com" (enlace) + ` ). Contacto: ${CONTACTO_DATOS}.` |  |
| 41 | Encabezado de sección | "Qué datos se recogen" |  |
| 42-47 | Cuerpo de la sección "Qué datos se recogen" | "Al inscribirte a una competencia: nombre completo, documento de identidad, fecha de nacimiento, género y la categoría en la que compites. Al crear una cuenta de organizador: tu nombre, correo, contraseña, y el nombre y ciudad de tu gimnasio o liga. Durante un evento, los jueces registran los intentos capturados en cada bloque." |  |
| 51 | Encabezado de sección | "Para qué se usan" |  |
| 52-57 | Cuerpo de la sección "Para qué se usan" | "Únicamente para organizar competencias de escalada en CRUX: armar categorías y rondas, calcular resultados, mostrar la tabla pública de una competencia, y mantener el historial de un competidor entre eventos. No se usan para publicidad, no se venden y no se comparten con nadie fuera de CRUX y estas competencias." |  |
| 61 | Encabezado de sección | "Menores de edad" |  |
| 62-65 | Cuerpo de la sección "Menores de edad" | "Si el competidor es menor de edad, sus datos solo se tratan con la autorización de su padre, madre o acudiente, dada al inscribirlo y registrada junto a la inscripción." |  |
| 69 | Encabezado de sección | "Tus derechos" |  |
| 70-77 | Cuerpo de la sección "Tus derechos" (interpolado, incluye `${CONTACTO_DATOS}`) | "Como titular de los datos puedes conocerlos, actualizarlos, corregirlos, pedir que se supriman, y revocar en cualquier momento la autorización dada. Para ejercer cualquiera de estos derechos, escribe a ${CONTACTO_DATOS} indicando tu nombre y qué necesitas — se resuelve directamente, sin formulario aparte. Si consideras que tus datos no se están tratando bien, también puedes presentar una queja ante la Superintendencia de Industria y Comercio." |  |
| 81 | Encabezado de sección | "Vigencia" |  |
| 82-86 | Cuerpo de la sección "Vigencia" | "Los datos se conservan mientras tengan una finalidad dentro de CRUX — por ejemplo, tu historial de competidor entre eventos — o hasta que ejerzas tu derecho a que se supriman." |  |

---

## Iniciar sesión (/sign-in)
**Archivo:** `apps/web/app/sign-in/page.tsx`
(usa `PasswordField` de `components/password-field.tsx`, ver subsección aparte.)

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 26 | Fallback de error si Better Auth no da mensaje propio | "No se pudo iniciar sesión." |  |
| 43 | Enlace de marca, sobre el formulario | "CRUX" |  |
| 46 | Titular del formulario | "Entrar" |  |
| 47 | Subtítulo del formulario | "Para organizar eventos y ver tus competencias." |  |
| 51 | Etiqueta de campo | "Correo" |  |
| 70 | Botón, estado enviando | "Entrando…" |  |
| 70 | Botón, estado normal | "Entrar" |  |
| 73 | Enlace inferior, texto previo | "¿Todavía no tienes cuenta? " |  |
| 75 | Enlace inferior | "Crear cuenta de organizador" |  |

---

## Crear cuenta (/sign-up)
**Archivo:** `apps/web/app/sign-up/page.tsx`
(usa `PasswordField` y `PrivacyNotice`, ver subsecciones aparte.)

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 49 | Fallback de error si el servidor no da mensaje propio | "No se pudo crear la cuenta." |  |
| 63 | Enlace de marca, sobre el formulario | "CRUX" |  |
| 67 | Titular del formulario | "Crear cuenta de organizador" |  |
| 68-69 | Subtítulo del formulario | "Solo la necesitas si vas a organizar eventos. Para competir no hace falta cuenta." |  |
| 73 | Etiqueta de campo | "Tu nombre" |  |
| 87 | Etiqueta de campo | "Correo" |  |
| 108 | Etiqueta de campo | "Tu organización" |  |
| 120-123 | Texto de ayuda bajo "Tu organización" | "El gimnasio, club o liga que organiza. Es el nombre que ve la gente en la tabla pública, y tu cuenta tiene una sola." |  |
| 126 | Etiqueta de campo | "Ciudad o sede" |  |
| 140 | Etiqueta de campo | "Código de acceso" |  |
| 151-153 | Texto de ayuda bajo "Código de acceso" | "Te lo comparte quien administra la plataforma. Sirve una sola vez: si ya lo usaste, pide otro." |  |
| 163 | Botón, estado enviando | "Creando cuenta…" |  |
| 163 | Botón, estado normal | "Crear cuenta" |  |
| 166 | Enlace inferior, texto previo | "¿Ya tienes cuenta? " |  |
| 168 | Enlace inferior | "Entrar" |  |

---

## Página no encontrada (404) — `not-found.tsx`
**Archivo:** `apps/web/app/not-found.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 24 | Rótulo de marca | "CRUX" |  |
| 25-27 | Titular | "Esta página no existe" |  |
| 28-31 | Párrafo explicativo | "Puede que el enlace venga cortado, o que la dirección tenga una letra de más. Los enlaces de una competencia llevan siempre su nombre al final:" |  |
| 34-36 | Ejemplo de enlace, bloque de código | "/resultados/copa-suesca" |  |
| 41 | Botón principal | "Ir al inicio" |  |
| 44 | Botón/enlace secundario | "Entrar como organizador" |  |
| 48-56 | Párrafo final, con enlace de correo | "¿Buscabas una competencia y el enlace no sirve? Escríbele a quien organiza, o a " + "contacto@cruxcompetencias.com" (enlace) + "." |  |

---

## Mensajes de autenticación (`lib/auth-error-messages.ts`)
**Archivo:** `apps/web/lib/auth-error-messages.ts` — mapa plano de código de
error de Better Auth a texto en español, usado por `/sign-in` y `/sign-up`.

| Línea | Código | Texto actual | Tu versión |
|---|---|---|---|
| 2 | `PASSWORD_TOO_SHORT` | "La contraseña es muy corta (mínimo 8 caracteres)." |  |
| 3 | `PASSWORD_TOO_LONG` | "La contraseña es muy larga (máximo 128 caracteres)." |  |
| 4 | `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` | "Ese correo ya está registrado, intenta iniciar sesión." |  |
| 5 | `INVALID_EMAIL_OR_PASSWORD` | "Correo o contraseña incorrectos." |  |
| 6 | `INVALID_EMAIL` | "Ese correo no es válido." |  |

---

## Componente compartido — `components/password-field.tsx`
Usado por `/sign-in` y `/sign-up`.

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 12 (prop por defecto) | Etiqueta de campo | "Contraseña" |  |
| 49 | `aria-label` del botón mostrar/ocultar, estado visible | "Ocultar la contraseña" |  |
| 49 | `aria-label` del botón mostrar/ocultar, estado oculto | "Mostrar la contraseña" |  |
| 52 | Texto del botón, estado visible | "Ocultar" |  |
| 52 | Texto del botón, estado oculto | "Ver" |  |
| — (usado desde `/sign-up`, `page.tsx:105`) | `hint` pasado por `/sign-up` | "Mínimo 8 caracteres." |  |

---

## Componente compartido — `components/privacy-notice.tsx`
Usado por `/inscripcion/[slug]` (`registration-form.tsx`, variante
`inscripcion`) y `/sign-up` (variante `organizador`).

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 7 | Fragmento de la variante `inscripcion` (se inserta en el párrafo de abajo) | "para organizar esta competencia y las siguientes en las que compitas: armar categorías, calcular resultados y guardar tu historial entre eventos" |  |
| 10 | Fragmento de la variante `organizador` (se inserta en el párrafo de abajo) | "para darte acceso al panel y mostrar el nombre de tu organización en tus eventos" |  |
| 21-28 | Párrafo completo del aviso (interpolado: `${RESPONSABLE_NOMBRE}`, `${COPY[variant]}`, `${CONTACTO_DATOS}`) | "Estos datos los trata **Christian Ramírez**, responsable de CRUX, únicamente ${COPY[variant]}. No se usan para publicidad ni se comparten con nadie fuera de CRUX y estas competencias de escalada. Puedes conocer, corregir o pedir que se borren tus datos escribiendo a contacto@cruxcompetencias.com. Política completa: " + "cruxcompetencias.com/privacidad" (enlace) + "." |  |

---

## `components/topographic-motif.tsx`
Puramente decorativo (SVG con `aria-hidden="true"`, sin texto legible).
Sin filas — se confirma que no aporta strings a este inventario.

---

## Mensajes de error — API `judge-access` (`app/api/judge-access/route.ts`)
No es una pantalla en el alcance de esta parte (sirve a `/juzgar`, cubierto
en otra pasada), pero se listan sus mensajes en español por instrucción
explícita.

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 31 | Error, cuerpo de la petición no pasa el esquema Zod | "Datos inválidos." |  |
| 40 | Error, el slug del evento no existe | "Ese evento no existe." |  |
| 56 | Error, límite de tasa por códigos incorrectos | "Demasiados códigos incorrectos. Espera unos minutos." |  |
| 62 | Error, código de juez incorrecto | "Ese código no corresponde a este evento." |  |

---

## Mensajes de error — API `organization-logo` (`app/api/organization-logo/route.ts`)
No es una pantalla en el alcance de esta parte (sirve a `/panel/organization`,
cubierto en otra pasada), pero se listan sus mensajes en español por
instrucción explícita.

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 25 | Error, sin sesión válida | "Sesión inválida, vuelve a iniciar sesión." |  |
| 32 | Error, falta archivo u organización en el formulario | "Faltan datos en la subida." |  |
| 35 | Error, tipo de archivo no permitido | "El logo debe ser PNG, JPG o WebP." |  |
| 38 | Error, archivo demasiado pesado | "El logo no puede pesar más de 2 MB." |  |
| 47 | Error, organización no existe o no pertenece a la sesión | "Esa organización no existe o no te pertenece." |  |
| 65 | Error, falla al subir a Vercel Blob (mensaje de la excepción tal cual, no siempre en español) | `(error as Error).message` — mensaje crudo de la excepción, no un literal en español |  |
Inventario de textos en español — tabla pública, proyección, competidor y tarjeta
==================================================================================

Alcance de esta parte: `/resultados/[slug]`, `/resultados/[slug]/proyectar`,
`/competidor/[athleteId]`, `/competidor/[athleteId]/tarjeta`, más las piezas de
`lib/` que aportan texto literal a esas pantallas (`round-highlights.ts`) y el
único error en español que puede llegar al cliente desde
`api/resultados/[slug]/route.ts`. No cubre `/panel`, `/juzgar`, `/inscripcion`,
`/sign-in`, `/sign-up`, la portada, `/privacidad`, `not-found`,
`lib/share-card.ts`, `lib/labels.ts` ni `api/tarjeta` (otras pasadas).

Nota de lectura: cuando el texto se arma con plantilla (`${...}`), se deja la
plantilla visible tal cual está en el código, incluidas las ramas
condicionales.

---

## Resultados públicos (/resultados/[slug])

**Archivos:** `apps/web/app/(public)/resultados/[slug]/leaderboard-screen.tsx`,
`apps/web/app/(public)/resultados/[slug]/leaderboard-charts.tsx`,
`apps/web/lib/round-highlights.ts` (calculan los textos de "Headline", que
`leaderboard-charts.tsx` dibuja), `apps/web/app/api/resultados/[slug]/route.ts`
(único error en español que puede llegar al cliente).

### leaderboard-screen.tsx

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 36-39 | Encabezados de columna de puntaje, formato tops/zonas (tabla y `ProjectedTable` en proyección) | `['Tops', 'Intentos']`, `['Zonas', 'Intentos']` |  |
| 40 | Encabezado de columna de puntaje, formato IFSC de bloque | `['Puntaje']` |  |
| 41 | Encabezado de columna de puntaje, formato liga | `['Puntaje']` |  |
| 42 | Encabezado de columna de puntaje, formato altura máxima | `['Altura']` |  |
| 50 | Rótulos de cifra en la tarjeta móvil de resultado, formato tops/zonas | `['Tops', 'Intentos a top', 'Zonas', 'Intentos a zona']` |  |
| 51 | Rótulo de cifra en la tarjeta móvil, formato IFSC | `['Puntaje']` |  |
| 52 | Rótulo de cifra en la tarjeta móvil, formato liga | `['Puntaje']` |  |
| 53 | Rótulo de cifra en la tarjeta móvil, formato altura máxima | `['Altura']` |  |
| 65 | Celda de puntaje, formato altura máxima (top, altura o vacío) | `result.top ? 'TOP' : result.height > 0 ? `${result.height} m` : '—'` |  |
| 148 | `BlockBadge`, bloque sin intento capturado (casilla vacía) | `·` |  |
| 152 | `BlockBadge`, bloque con top (altura) | `TOP` |  |
| 158 | `BlockBadge`, bloque con top (tops/zonas), número de intentos al top | `{cell.topAttempts ?? 1}` |  |
| 163 | `BlockBadge`, bloque sin top ni zona | `—` |  |
| 326 | Enlace en el detalle de una fila, hacia el historial del atleta | `Ver historial de {row.athleteName} →` |  |
| 410 | Marca, sobre el nombre del evento | `CRUX` |  |
| 439 | Enlace al modo proyección (solo escritorio, `lg` en adelante) | `Proyectar →` |  |
| 459 | Indicador "en vivo", junto a la hora | `En vivo ·` (seguido de la hora local) |  |
| 469-470 | Indicador de estado cuando no está en vivo | `Aún no comienza` / `Resultados listos` |  |
| 479 | Mensaje cuando el evento no tiene categorías | `Este evento todavía no tiene categorías.` |  |
| 518 | Mensaje cuando la categoría no tiene rondas | `Esta categoría todavía no tiene rondas.` |  |
| 522 | Mensaje cuando la ronda no tiene bloques/rutas | `Esta ronda todavía no tiene {unit.plural}.` |  |
| 536 | Leyenda de la tabla, casilla de top | `{SCORE_TERM.top}` → "Top" |  |
| 540 | Leyenda de la tabla, casilla de zona | `{SCORE_TERM.zone}` → "Zona" |  |
| 544-546 | Leyenda de la tabla, casilla vacía | `Sin escalar` |  |
| 547 | Leyenda de la tabla, aclaración general (formatos con columnas de intentos) | `Los números son la cantidad de intentos.` |  |
| 556-559 | Leyenda de la tabla, aclaración de las columnas de intentos (formato tops/zonas) | `Las columnas de intentos suman los intentos que le tomó alcanzar todos los tops y todas las zonas: menos es mejor.` |  |
| 565-568 | Leyenda de la tabla, aclaración de puntaje (formato liga) | `Bajo cada {unit.singular}, cuánto puntúa su top y cuánto su zona; la raya es un {unit.singular} donde la zona no puntúa. Los intentos no cambian el puntaje.` |  |
| 602 | Encabezado de tabla, título de grupo sobre las columnas de bloque | `{unit.plural}` (bloques / rutas) |  |
| 607 | Encabezado de tabla, columna de puesto | `Puesto` |  |
| 612 | Encabezado de tabla, columna de competidor | `Competidor` |  |
| 683 | Título (`title`) sobre el número de puesto cuando hay empate | `Empate` |  |
| 739 | Texto de ayuda bajo la tabla/tarjetas | `Abre cada resultado para ver el detalle, {unit.singular} por {unit.singular}.` |  |
| 763-765 | Rótulo de la sección de eventos hermanos | `Más competencias de {siblings.organization}` |  |
| 790-797 | Pie de página, atribución de la plataforma | `Esta tabla la corre` + `CRUX` (enlace) + `, plataforma de competencias de escalada.` |  |

### leaderboard-charts.tsx

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 364 | `aria-label` del SVG de la gráfica de puestos (`BumpChart`) | `Puesto de cada competidor al cierre de cada ${unit}` |  |
| 374-375 | Título del eje izquierdo, gráfica de puestos (pantalla grande) | `PUESTO LUEGO` |  |
| 377-379 | Subtítulo del eje izquierdo | `${article === 'la' ? 'DE LA' : 'DEL'} ${unit.toUpperCase()} ${points[0]!.problemNumber}` |  |
| 380-381 | Título del eje derecho | `PUESTO LUEGO` |  |
| 383-385 | Subtítulo del eje derecho | `${article === 'la' ? 'DE LA' : 'DEL'} ${unit.toUpperCase()} ${points.at(-1)!.problemNumber}` |  |
| 386-388 | Encabezado de la columna de cambio de puesto | `CAMBIO` |  |
| 412-414 | Marca de cada bloque/ruta en el eje horizontal | `${unit.slice(0, 1).toUpperCase()}${points[index]!.problemNumber}` (p. ej. "B1") |  |
| 421-423 | Rótulo bajo el eje horizontal (pantalla grande) | `{plural.toUpperCase()}` (BLOQUES / RUTAS) |  |
| 623 | Chip de cambio de puesto (subida/bajada) | `{delta > 0 ? '▲' : '▼'} {Math.abs(delta)}` |  |
| 670 | Función `says`, cuenta + palabra (Wall) | `${count} ${count === 1 ? one : many}` |  |
| 675 | Lectura al señalar el tramo "top" del muro | `says(hovered.tops, 'hizo top', 'hicieron top')` → "1 hizo top" / "N hicieron top" |  |
| 676 | Lectura al señalar el tramo "zona" del muro | `says(hovered.zones, \`llegó a la ${zone} sin top\`, \`llegaron a la ${zone} sin top\`)` → "1 llegó a la zona sin top" / "N llegaron a la zona sin top" |  |
| 678-681 | Lectura al señalar el tramo "sin zona" del muro | `says(hovered.field - hovered.tops - hovered.zones, \`no llegó a la ${zone}\`, \`no llegaron a la ${zone}\`)` → "1 no llegó a la zona" / "N no llegaron a la zona" |  |
| 710 | Encabezado de columna del muro, cantidad de tops | `{SCORE_TERM.top}` → "Top" |  |
| 711 | Encabezado de columna del muro, cantidad de flashes | `{SCORE_TERM.flash}` → "flash" |  |
| 724 | Etiqueta junto al bloque más duro (el crux) | `crux` |  |
| 876 | Encabezado de columna, gráfica de intentos al top | `Promedio` |  |
| 877 | Encabezado de columna, gráfica de intentos al top | `Tops` |  |
| 895 | `title` (tooltip) de la barra de un competidor | `${climber.name}: ${climber.topAttempts} intentos para ${climber.tops} tops` |  |
| 978 | Título del panel, gráfica de puestos | `Puesto ${unit.singular} a ${unit.singular}` |  |
| 979 | Subtítulo del panel, gráfica de puestos | `Una línea por competidor. Se actualiza al cierre de cada ${unit.singular}.` |  |
| 991-993 | Título del eje izquierdo, versión móvil (HTML, no SVG) | `Luego {unit.article === 'la' ? 'de la' : 'del'} {unit.singular} {round.timeline[0]!.problemNumber}` |  |
| 994-997 | Título del eje derecho, versión móvil | `Luego {unit.article === 'la' ? 'de la' : 'del'} {unit.singular} {round.timeline.at(-1)!.problemNumber}` |  |
| 1023-1025 | Texto de ayuda bajo la gráfica de puestos, primera frase (ambas pantallas) | `Se lee de izquierda a derecha: arranca con el puesto luego del primer {unit.singular}.` |  |
| 1025-1027 | Texto de ayuda, versión móvil | `Presiona una línea para ver el nombre del competidor al que corresponde; eso resalta su posición en la tabla y en las demás gráficas.` |  |
| 1029-1031 | Texto de ayuda, versión escritorio | `Haz clic sobre un competidor y se resalta en la tabla y en las demás gráficas.` |  |
| 1038 | Título del panel, gráfica del muro | `¿Qué tan duros estaban los ${unit.plural}?` |  |
| 1039 | Subtítulo del panel, gráfica del muro | `De los ${round.rows.length} de la categoría, cuántos hicieron top y cuántos se quedaron en zona. Del más duro al más fácil.` |  |
| 1042 | Leyenda de color, gráfica del muro | `{SCORE_TERM.top}` → "Top" |  |
| 1043 | Leyenda de color, gráfica del muro | `{SCORE_TERM.zone}` → "Zona" |  |
| 1050 | Título del panel, gráfica de intentos al top | `Cuántos intentos al top` |  |
| 1051 | Subtítulo del panel, gráfica de intentos al top | `Promedio de intentos por cada top logrado. Solo cuentan los ${unit.plural} en los que hizo top; entra quien tenga dos tops o más. Menos es mejor.` |  |

### lib/round-highlights.ts (calcula los textos de las tarjetas "Headline"/"HighlightStrip", usadas en Resultados y en Proyección)

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 49 | Rótulo de la tarjeta "el bloque más duro" | `El ${unit} más duro` |  |
| 50 | Subtítulo de esa tarjeta (qué mide) | `Cuál fue el ${unit} que menos gente pudo hacer` |  |
| 52-54 | Detalle de esa tarjeta, con datos | `${problemName(crux.problemId) ?? 'Sin nombre'} · le hicieron top ${crux.tops} de ${crux.field}` |  |
| 54 | Detalle de esa tarjeta, sin datos todavía | `Todavía no hay ${plural} capturados` |  |
| 59 | Rótulo de la tarjeta "flashes de la ronda" | `Flashes de la ronda` |  |
| 60 | Subtítulo de esa tarjeta | `De todos los tops, cuántos salieron al primer intento` |  |
| 64 | Detalle de esa tarjeta, con tops | `${flashCount(totalFlashes)} de ${totalTops} tops en la ronda` |  |
| 66 | Detalle de esa tarjeta, sin tops todavía | `Todavía no hay tops en la ronda` |  |
| 70 | Rótulo de la tarjeta "mayor ascenso" | `Mayor ascenso en la tabla` |  |
| 71 | Subtítulo de esa tarjeta | `Quién más puestos ascendió desde el primer ${unit}` |  |
| 75 | Detalle de esa tarjeta, con ascenso | `${bestClimb.name} subió ${bestClimb.delta} puestos en la tabla de posiciones` |  |
| 76 | Detalle de esa tarjeta, sin ascenso todavía | `Nadie ha ganado puestos todavía` |  |
| 81 | Rótulo de la tarjeta "tops logrados" | `Tops logrados` |  |
| 82 | Subtítulo de esa tarjeta | `De todos los tops que se podían hacer, cuántos se lograron` |  |
| 89 | Detalle, aún sin ningún top | `Todavía no hay top en ninguno de los ${round.problems.length} ${plural} · ${posibles} posibles` |  |
| 91 | Detalle, top en todos los bloques/rutas | `${totalTops} tops · ya hubo top en los ${round.problems.length} ${plural}` |  |
| 92 | Detalle, top en algunos | `${totalTops} tops · hay top en ${conTop} de ${round.problems.length} ${plural}, en ${round.problems.length - conTop} todavía no` |  |

### api/resultados/[slug]/route.ts

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 17 | Cuerpo del error JSON cuando el evento no existe (respuesta al sondeo de `useLeaderboard`) | `Evento no encontrado.` |  |

---

## Proyección (/resultados/[slug]/proyectar)

**Archivos:** `apps/web/app/(public)/resultados/[slug]/projection-screen.tsx`,
`apps/web/app/(public)/resultados/[slug]/proyectar/page.tsx`. Reutiliza sin
cambios de texto `BumpChart`, `Wall`, `AttemptsPerTop` y `SCORE_HEADERS` de
`leaderboard-charts.tsx`/`leaderboard-screen.tsx` (ver sección anterior) y
`roundHighlights` de `lib/round-highlights.ts`.

### proyectar/page.tsx

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 7 | `<title>` de la pestaña del navegador | `Proyectar · Crux` |  |

### projection-screen.tsx

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 169 | Encabezado de la tabla proyectada, columna de puesto | `Puesto` |  |
| 170 | Encabezado de la tabla proyectada, columna de competidor | `Competidor` |  |
| 177-186 | Encabezados de columna de puntaje (reutiliza `SCORE_HEADERS` de `leaderboard-screen.tsx:35-43`) | "Tops" / "Intentos" / "Zonas" / "Puntaje" / "Altura", según formato |  |
| 352-360 | `sinceLabel`, hace cuánto se capturó algo | `ahora mismo` / `hace ${Math.round(seconds / 60)} min` / `hace ${Math.round(seconds / 3600)} h` |  |
| 389 | Encabezado de la lista de capturas recientes | `{captures.length === 1 ? 'Última captura' : 'Últimas capturas'}` |  |
| 393-395 | Descripción de una captura reciente, con top | `hizo TOP en ${article} ${mark(capture.problemNumber)}` |  |
| 395-396 | Descripción de una captura reciente, con zona | `llegó a la zona en ${article} ${mark(capture.problemNumber)}` |  |
| 397 | Descripción de una captura reciente, sin top ni zona | `intentó ${article} ${mark(capture.problemNumber)}` |  |
| 398-400 | Cantidad de intentos, junto a la descripción de la captura | `${capture.attempts} ${capture.attempts === 1 ? 'intento' : 'intentos'}` |  |
| 600 | Marca, en el encabezado | `CRUX` |  |
| 637-639 | Mensaje cuando el evento no tiene nada capturado | `Todavía no hay nada capturado en este evento.` |  |
| 656-658 | Título del panel de la derecha (según el turno activo) | `chartTitle[activeSlide]` — ver definición abajo |  |
| 579-580 | Definición: título cuando el turno es "bump" (gráfica de puestos) | `Puesto ${unit.singular} a ${unit.singular}` |  |
| 581 | Definición: título cuando el turno es "detail" y hay gráfica de intentos al top | `Los ${unit.plural} y los intentos al top` |  |
| 581 | Definición: título cuando el turno es "detail" sin esa gráfica | `¿Qué tan duros estaban los ${unit.plural}?` |  |
| 681-687 | `title` (tooltip) de los puntos que indican el turno activo | `Fija — toca para volver a rotar` / `Toca para fijar esta gráfica` / `Ver esta gráfica` |  |
| 750-752 | Rótulo sobre la gráfica del muro (turno "detail") | `Qué tan duros estaban · del más duro al más fácil` |  |
| 757-759 | Rótulo sobre la gráfica de intentos al top (turno "detail") | `Intentos por cada top · menos es mejor` |  |
| 906 | Botón de rotación de categorías, en la barra de controles | `{rotating ? 'Rotando cada 30 s' : 'Rotar categorías'}` |  |
| 915 | Botón de pantalla completa, en la barra de controles | `{fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}` |  |
| 918-920 | Enlace de salida, en la barra de controles | `← Volver a la tabla` |  |

---

## Competidor (/competidor/[athleteId])

**Archivos:** `apps/web/app/(public)/competidor/[athleteId]/page.tsx`,
`apps/web/app/(public)/competidor/[athleteId]/conversion-bar.tsx`.

### page.tsx

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 28 | `<title>` de la pestaña del navegador | `Historial de competidor · Crux` |  |
| 142 | `aria-label` de la flecha de mejora, tabla de comparación | `mejor que la anterior` |  |
| 143 | `aria-label` de la flecha de empeoramiento, tabla de comparación | `peor que la anterior` |  |
| 182 | Encabezado de columna, tabla "Últimas dos competencias" | `Última` |  |
| 183 | Encabezado de columna, tabla "Últimas dos competencias" | `Anterior` |  |
| 188 | Rótulo de fila, tabla de comparación | `Arriba de tu categoría` |  |
| 199 | Rótulo de fila, tabla de comparación | `Tops` |  |
| 202 | Valor de la fila "Tops", competencia actual | `${a.tops} de ${a.problems}` |  |
| 203 | Valor de la fila "Tops", competencia anterior | `${b.tops} de ${b.problems}` |  |
| 206 | Rótulo de fila, tabla de comparación | `Intentos por top` |  |
| 251-255 | Barra de posición relativa (`StandingMeter`) | `por encima del ${aboveField(standing)} % de tu categoría` |  |
| 270 | Puesto dentro del campo, en "tus mejores resultados" | `de {event.field}` |  |
| 307 | Cuando una ronda no tiene resultado publicado | `Sin resultado publicado` |  |
| 313 | Puesto dentro del campo, en la tarjeta de cada evento | `de {event.field}` |  |
| 314 | Marca de empate, en la tarjeta de cada evento | `(empate)` |  |
| 350 | Título de sección, totales de boulder | `Boulder / Bloque` |  |
| 355 | Cifra: bloques intentados | `Bloques intentados` |  |
| 356 | Cifra: tops | `Tops` |  |
| 360 | Cifra: zonas | `Zonas` |  |
| 361 | Cifra: flashes | `Flash` |  |
| 366 | Segmento de la barra de conversión (boulder) | `plural(totals.tops, 'top', 'tops')` → "top" / "tops" |  |
| 371 | Segmento de la barra de conversión (boulder) | `zona sin top` |  |
| 372 | Segmento de la barra de conversión (boulder) | `sin zona` |  |
| 382 | Título de sección, totales de lead | `Lead / Dificultad` |  |
| 386 | Cifra: rutas intentadas | `Rutas intentadas` |  |
| 387 | Cifra: rutas completadas | `Rutas completadas` |  |
| 389 | Cifra: altura máxima (unidad "m") | `Altura máxima` |  |
| 395 | Segmento de la barra de conversión (lead) | `plural(totals.tops, 'completada', 'completadas')` → "completada" / "completadas" |  |
| 401 | Segmento de la barra de conversión (lead) | `sin completar` |  |
| 433 | Rótulo de sección, encabezado de la página | `Historial de competidor` |  |
| 444 | Título de sección, tarjeta de Trayectoria | `Trayectoria` |  |
| 455 | Cifra: cantidad de competencias | `career.events === 1 ? 'Competencia' : 'Competencias'` |  |
| 458 | Detalle de esa cifra: desde cuándo | `desde ${sinceLabel}` |  |
| 469 | Cifra: mejor puesto | `Mejor puesto` |  |
| 479 | Cifra: cantidad de podios | `career.podiums === 1 ? 'Podio' : 'Podios'` |  |
| 484-486 | Detalle de esa cifra, un solo podio | `career.lastPodiumEvent` (solo el nombre del evento) |  |
| 486 | Detalle de esa cifra, varios podios | `el último en ${career.lastPodiumEvent}` |  |
| 506 | Enlace para compartir, fuera de la tarjeta de Trayectoria | `Compartir tus últimos resultados →` |  |
| 515 | Título de sección | `Tus mejores resultados` |  |
| 528 | Título de sección | `Últimas dos competencias` |  |
| 532 | Mensaje cuando no hay con qué comparar | `Con una segunda competencia hay con qué comparar.` |  |
| 537 | Título de sección | `Competencias` |  |
| 544-548 | Pie de página, atribución de la plataforma | `Este historial lo lleva` + `CRUX` (enlace) + `, plataforma de competencias de escalada.` |  |

### conversion-bar.tsx

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 66 | Renglón de leyenda de cada tramo de la barra (composición; las etiquetas de cada tramo vienen de `page.tsx`, ver arriba) | `{segment.label} · {Math.round((segment.count / total) * 100)} %` |  |

---

## Tarjeta compartible — página de destino (/competidor/[athleteId]/tarjeta)

**Archivo:** `apps/web/app/(public)/competidor/[athleteId]/tarjeta/page.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 19 | `<title>` de la pestaña del navegador | `Tarjeta de competencia · Crux` |  |
| 51 | `alt` de la imagen de la tarjeta | `Tarjeta de ${result.card.athleteName} en ${result.card.eventName}` |  |
| 56-58 | Instrucción para guardar la imagen | `Mantén pulsada la imagen para guardarla, o tócala con el botón derecho en el computador.` |  |
| 59-64 | Enlace de vuelta al historial completo | `Ver historial completo →` |  |
| 65-70 | Pie de página, atribución de la plataforma | `CRUX` (enlace) + `, plataforma de competencias de escalada.` |  |
# Inventario de textos — Panel de organizador y Juzgar

Extracción de solo lectura de todo texto en español visible para el usuario en
`apps/web/app/(organizer)/panel/**`, `apps/web/app/(judge)/juzgar/**`, y los
componentes/errores relacionados listados en el alcance. No se modificó
ningún archivo.

## Panel — Dashboard (/panel)
**Archivo:** `apps/web/app/(organizer)/panel/page.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 74 | Enlace, solo administrador | "Invitaciones" |  |
| 78 | Enlace al manual | "Manual" |  |
| 89 | Título h1 | "Tus eventos" |  |
| 91 | Subtítulo | "Crea un evento, arma sus categorías y bloques, y comparte el enlace de inscripción." |  |
| 119 | Enlace, junto al selector de organización | "Logo del gimnasio" |  |
| 139 | Fragmento de fecha faltante en la tarjeta de evento | " · sin fecha" |  |
| 141 | Conteo de inscritos, singular | "1 inscrito" |  |
| 142 | Conteo de inscritos, plural | `${event.registrationCount} inscritos` |  |
| 151 | Estado vacío, título | "Aún no tienes eventos" |  |
| 152 | Estado vacío, cuerpo | "Un evento agrupa las categorías, las rondas y los bloques de una competencia. Crea el primero para poder abrir inscripciones." |  |
| 160 | Botón principal | "Crear evento" |  |

**Archivo:** `apps/web/app/(organizer)/panel/sign-out-button.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 38 | Botón, estado ocupado | "Cerrando sesión…" |  |
| 38 | Botón, estado normal | "Cerrar sesión" |  |
| 42 | Error tras fallar el cierre de sesión | "No se pudo cerrar la sesión. Revisa la conexión e inténtalo otra vez." |  |

**Archivo:** `apps/web/app/(organizer)/panel/organization-picker.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 27 | Etiqueta sobre los botones de organización | "Organización" |  |

## Panel — Nuevo evento (/panel/events/new)
**Archivo:** `apps/web/app/(organizer)/panel/events/new/create-event-form.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 18 | Opción de puntaje, boulder | "Puntos IFSC de bloque" |  |
| 19 | Opción de puntaje, boulder | "Conteo clásico de tops y zonas" |  |
| 20 | Opción de puntaje, boulder | "Puntos por bloque, estilo liga local" |  |
| 22 | Opción de puntaje, lead | "Altura máxima en dificultad" |  |
| 41 | Opción de zona horaria | "Colombia (Bogotá)" |  |
| 42 | Opción de zona horaria | "México (Ciudad de México)" |  |
| 43 | Opción de zona horaria | "Perú (Lima)" |  |
| 44 | Opción de zona horaria | "Chile (Santiago)" |  |
| 45 | Opción de zona horaria | "Argentina (Buenos Aires)" |  |
| 46 | Opción de zona horaria | "España (Madrid)" |  |
| 106 | Título h1 | "Crear evento" |  |
| 108 | Subtítulo | "Después de crearlo podrás agregar categorías, rondas y bloques, y compartir el enlace de inscripción." |  |
| 118 | Leyenda del fieldset | "Organización" |  |
| 123 | Placeholder, solo si la cuenta no tiene organización | "Nombre de la organización" |  |
| 131 | Placeholder, solo si la cuenta no tiene organización | "Ubicación" |  |
| 157 | Etiqueta | "Nombre del evento" |  |
| 163 | Placeholder | "Copa Páramo 2026" |  |
| 176 | Etiqueta, vista previa del enlace | "Enlace público" |  |
| 178 | Prefijo fijo de la vista previa del enlace | "/inscripcion/" |  |
| 182 | Vista previa del enlace, antes de escribir el nombre | "se arma con el nombre" |  |
| 185 | Texto de ayuda bajo el enlace | "Sale del nombre del evento y no se edita: va impreso en los QR, así que tiene que quedar fijo. Si quieres otro enlace, cambia el nombre." |  |
| 192 | Etiqueta | "Fecha del evento" |  |
| 202 | Texto de ayuda | "Con esta fecha se calcula la edad de cada competidor para saber en qué categoría entra." |  |
| 208 | Etiqueta | "Modalidad" |  |
| 230 | Etiqueta | "Cómo se puntúa" |  |
| 249 | Texto de ayuda | "Define cómo se ordena la tabla de resultados y cómo se resuelven los empates." |  |
| 255 | Etiqueta | "Código para los jueces" |  |
| 274 | Botón, generar otro código | "Otro" |  |
| 277 | Texto de ayuda | "Quien escanee el QR de un bloque tendrá que escribirlo antes de poder registrar intentos. Dáselo solo a tus jueces." |  |
| 284 | Etiqueta | "Zona horaria" |  |
| 313 | Opción, ver la lista completa de zonas | "Otra zona horaria…" |  |
| 321 | Botón de envío | "Crear evento" |  |

**Archivo:** `apps/web/app/(organizer)/panel/events/new/actions.ts`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 44 | Error, validación de entrada | "Datos del evento inválidos." |  |
| 49 | Error, sesión inválida | "Sesión inválida, vuelve a iniciar sesión." |  |
| 58 | Error, nombre no genera un slug | "Ese nombre no alcanza para armar un enlace. Usa al menos una letra o un número." |  |
| 69 | Error, organización ajena | "Esa organización no existe o no te pertenece." |  |
| 86 | Error, cuenta ya tiene organización | "Tu cuenta ya tiene organización. Escógela en la lista en vez de crear otra." |  |
| 116 | Error, nombre de evento duplicado | "Ya tienes un evento con ese nombre. Cámbialo un poco para que el enlace sea distinto." |  |

## Panel — Detalle del evento — encabezado y compartir (/panel/events/[id])
**Archivo:** `apps/web/app/(organizer)/panel/events/[id]/page.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 268 | Enlace, volver | "← Tus eventos" |  |
| 280 | Fragmento de fecha faltante junto a modalidad/puntaje | " · sin fecha" |  |
| 294-299 | Enlace de descarga, junto al botón "Editar el evento" en el encabezado | "Descargar CSV de la competencia" |  |
| 310 | `<summary>` del bloque plegable | "Enlaces para compartir" |  |
| 316 | ShareLink, título | "Enlace de inscripción" |  |
| 317 | ShareLink, descripción | "Compártelo por WhatsApp o redes. Quien lo abra se inscribe sin crear cuenta." |  |
| 319 | ShareLink, título | "Tabla de resultados" |  |
| 320 | ShareLink, descripción | "La pantalla pública, la que abre la gente desde el teléfono. Se actualiza sola y no pide cuenta." |  |
| 324 | ShareLink, título | "Pantalla para proyectar" |  |
| 325 | ShareLink, descripción | "La misma competencia en una sola pantalla, sin desplazarse: la tabla, las gráficas turnándose solas y las cifras de la ronda. Ábrela en el computador del proyector y déjala ahí todo el día." |  |
| 330 | Encabezado, tarjeta del código de jueces | "Código para los jueces" |  |
| 331 | Descripción, tarjeta del código de jueces | "Quien escanee un QR tendrá que escribirlo antes de registrar intentos. Dáselo solo a tus jueces, no lo pegues junto al QR." |  |
| 344 | Título h2 | "Inscritos" |  |
| 345 | Descripción de la sección de inscritos | "Quién se inscribió y con qué dorsal. El dorsal es opcional: si lo dejas vacío, los jueces buscan por nombre, que también funciona." |  |
| 356 | Título h2 | "Estructura de la competencia" |  |
| 357 | Descripción de la sección de estructura | `Cada categoría agrupa competidores por edad, género o nivel. Dentro van sus rondas, y dentro de cada ronda, ${problemUnit(event.discipline).plural} que los jueces puntúan.` |  |

**Archivo:** `apps/web/app/(organizer)/panel/events/[id]/loading.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 28 | Estado de carga del detalle de evento | "Abriendo el evento…" |  |

**Archivo:** `apps/web/app/(organizer)/panel/events/[id]/event-form.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 81 | Botón, cerrado | "Editar el evento" |  |
| 93 | Etiqueta | "Nombre del evento" |  |
| 105 | Etiqueta | "Fecha del evento" |  |
| 116 | Texto de ayuda | "Con esta fecha se calcula la edad de cada competidor. Cambiarla ahora no vuelve a revisar a quien ya se inscribió: su categoría se decidió con la fecha que había ese día." |  |
| 122 | Etiqueta | "Inscripciones hasta" |  |
| 132 | Texto de ayuda | "Último día que el enlace acepta inscripciones, contando el día entero en la zona horaria del evento. Déjalo vacío y no se cierra nunca. Si alguien llega tarde y quieres dejarlo entrar, corre la fecha y el enlace vuelve a abrir." |  |
| 140 | Etiqueta | "Zona horaria" |  |
| 11–16 | Opciones de zona horaria (idénticas a create-event-form.tsx) | "Colombia (Bogotá)" / "México (Ciudad de México)" / "Perú (Lima)" / "Chile (Santiago)" / "Argentina (Buenos Aires)" / "España (Madrid)" |  |
| 158 | Etiqueta | "Código para los jueces" |  |
| 176 | Botón, generar otro código | "Otro" |  |
| 179 | Texto de ayuda | "Cámbialo si se filtró. Los teléfonos que ya estaban juzgando van a pedirlo otra vez, y los intentos que tengan sin enviar esperan en el teléfono hasta que lo escriban: no se pierde ninguno." |  |
| 188 | Nota, campos que no se pueden editar | "El enlace público, la modalidad y la forma de puntuar no se cambian. El enlace vive dentro de cada QR impreso y de lo que ya compartiste; los otros dos reinterpretarían intentos ya capturados. Si alguno quedó mal y todavía no has capturado nada, borra el evento y créalo de nuevo." |  |
| 204 | Botón de guardar, estado ocupado | "Guardando…" |  |
| 204 | Botón de guardar | "Guardar cambios" |  |
| 211 | Botón, cerrar el formulario | "Cancelar" |  |
| 222 | Botón deshabilitado, evento con intentos | "Borrar evento" |  |
| 224 | Texto junto al botón deshabilitado | "Ya tiene intentos capturados: no se puede borrar." |  |
| 228 | ConfirmDeleteButton, label | "Borrar evento" |  |
| 231 | ConfirmDeleteButton, texto de qué más se borra | `Se borran también ${registrationCount} inscrito${registrationCount === 1 ? '' : 's'}.` |  |

**Archivo:** `apps/web/app/(organizer)/panel/events/[id]/share-link.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 81 | Botón, estado copiado | "Copiado" |  |
| 81 | Botón, estado normal | "Copiar" |  |
| 86 | Mensaje tras copiar con éxito | "Enlace copiado. Ya lo puedes pegar donde quieras." |  |
| 91 | Mensaje si el navegador no deja copiar | "El navegador no dejó copiarlo automáticamente. Selecciona el enlace de arriba y cópialo a mano." |  |

**Archivo:** `apps/web/app/(organizer)/panel/events/[id]/actions.ts` (errores de `updateEvent` y `deleteEvent`)

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 426 | Error, validación de `updateEvent` | "Datos del evento inválidos." |  |
| 431, 469 | Error, sesión inválida (updateEvent, deleteEvent) | "Sesión inválida, vuelve a iniciar sesión." |  |
| 441, 479 | Error, evento ajeno (updateEvent, deleteEvent) | "Ese evento no existe o no te pertenece." |  |
| 464 | Error, validación de `deleteEvent` | "Datos inválidos." |  |
| 492 | Error, evento con intentos capturados | "Este evento ya tiene intentos capturados: borrarlo borraría el registro de un juez." |  |

## Panel — Detalle del evento — categorías, rondas y bloques
**Archivo:** `apps/web/app/(organizer)/panel/events/[id]/event-structure.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 47 | Resumen de categoría, rango de edad | `${category.minAge} a ${category.maxAge} años` |  |
| 49 | Resumen de categoría, solo mínima | `desde ${category.minAge} años` |  |
| 51 | Resumen de categoría, solo máxima | `hasta ${category.maxAge} años` |  |
| 53 | Resumen de categoría, sin tope | "Abierta a todos" |  |
| 101 | Estado vacío, sin categorías | "Todavía no hay categorías. Crea la primera abajo — sin categorías nadie puede inscribirse, porque al inscribirse cada persona elige la suya." |  |
| 131 | Eyebrow de la tarjeta de categoría | "Categoría" |  |
| 140 | Resumen, categoría sin rondas | "Sin rondas" |  |
| 143 | Conteo de rondas | "ronda" / "rondas" (vía `countLabel`) |  |
| 165 | Estado vacío, categoría sin rondas dentro del panel abierto | "Esta categoría no tiene rondas. Agrega al menos la clasificatoria: los {unit.plural} viven dentro de una ronda." |  |
| 182 | Eyebrow de la tarjeta de ronda | "Ronda" |  |
| 215 | Estado vacío, ronda sin bloques | "Sin {unit.plural}. Cada {unit.singular} que agregues genera su propio QR para que el juez entre directo a puntuarlo." |  |
| 248 | ConfirmDeleteButton, label | "Borrar ronda" |  |
| 251 | ConfirmDeleteButton, qué más se borra | `Se borran también ${countLabel(round.problems.length, unit.singular, unit.plural)}.` |  |
| 267 | ConfirmDeleteButton, label | "Borrar categoría" |  |
| 270 | ConfirmDeleteButton, qué más se borra | `Se borran también ${countLabel(category.rounds.length, 'ronda', 'rondas')}${totalProblems > 0 ? ` y ${countLabel(totalProblems, unit.singular, unit.plural)}` : ''}.` |  |

**Archivo:** `apps/web/app/(organizer)/panel/events/[id]/add-panel.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 55 | Botón, cerrar el panel de creación | "Cancelar" |  |

**Archivo:** `apps/web/app/(organizer)/panel/events/[id]/category-form.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 48 | AddPanel, etiqueta del botón cerrado | "Agregar categoría" |  |
| 52 | Etiqueta | "Nombre de la categoría" |  |
| 58 | Placeholder | "Avanzado Masculino" |  |
| 67 | Etiqueta | "Género" |  |
| 81 | Opción | "Masculino" |  |
| 82 | Opción | "Femenino" |  |
| 83 | Opción | "Mixto" |  |
| 88 | Leyenda del fieldset de edad | "Edad, en años" |  |
| 92 | aria-label | "Edad mínima" |  |
| 93 | Placeholder | "Desde" |  |
| 101 | aria-label | "Edad máxima" |  |
| 102 | Placeholder | "Hasta" |  |
| 108 | Texto de ayuda | "Déjalas en blanco si la categoría no tiene tope." |  |
| 112 | Etiqueta | "Nivel" |  |
| 118 | Placeholder | "Principiante, intermedio, élite…" |  |
| 132 | Botón, estado ocupado | "Creando…" |  |
| 132 | Botón de envío | "Crear categoría" |  |

**Archivo:** `apps/web/app/(organizer)/panel/events/[id]/round-form.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 15 | Opción de tipo de ronda | "Clasificatoria" |  |
| 16 | Opción de tipo de ronda | "Semifinal" |  |
| 17 | Opción de tipo de ronda | "Final" |  |
| 38 | AddPanel, etiqueta del botón cerrado | "Agregar ronda" |  |
| 43 | Etiqueta | "Tipo de ronda" |  |
| 62 | Texto de ayuda | "Las rondas se ordenan solas: clasificatoria, semifinal, final." |  |
| 73 | Botón, estado ocupado | "Creando…" |  |
| 73 | Botón de envío | "Crear ronda" |  |

**Archivo:** `apps/web/app/(organizer)/panel/events/[id]/round-advances.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 52 | Etiqueta | "Cuántos pasan a la siguiente ronda" |  |
| 65 | Placeholder | "todos" |  |
| 69 | Estado guardando | "Guardando…" |  |
| 72 | Texto de ayuda | "La ronda siguiente se corre solo con ellos. Déjalo vacío si pasan todos. Si el corte cae en mitad de un empate, pasan todos los empatados." |  |

**Archivo:** `apps/web/app/(organizer)/panel/events/[id]/problem-form.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 58 | AddPanel, etiqueta del botón cerrado | `Agregar ${unit.singular}` |  |
| 64 | Etiqueta | "Número" |  |
| 78 | Etiqueta | "Nombre" |  |
| 84 | Placeholder | "Opcional" |  |
| 95 | Etiqueta | "Puntos por top" |  |
| 109 | Etiqueta | "Puntos por zona" |  |
| 115 | Placeholder | "Opcional" |  |
| 131 | Botón, estado ocupado | "Creando…" |  |
| 131 | Botón de envío | `Crear ${unit.singular}` |  |

**Archivo:** `apps/web/app/(organizer)/panel/events/[id]/problem-qr.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 47 | Título de la ventana de impresión del QR | `${unit.singular} ${number}${name ? ` · ${name}` : ''}` |  |
| 63 | alt de la imagen en la ventana de impresión | "QR" |  |
| 112 | Nombre de bloque vacío | "Sin nombre" |  |
| 115 | Puntos, sin definir | "Sin puntos" |  |
| 115 | Puntos, top y zona | `${topPoints} · ${zonePoints ?? '—'}` |  |
| 125 | Botón, alternar edición | "Cancelar" / "Editar" |  |
| 133 | Botón, alternar QR | "Ocultar QR" / "QR para juzgar" |  |
| 141 | Etiqueta, edición | "Número" |  |
| 154 | Etiqueta, edición | "Nombre" |  |
| 171 | Etiqueta, edición | "Puntos por top" |  |
| 184 | Etiqueta, edición | "Puntos por zona" |  |
| 191 | Placeholder, edición | "Sin zona" |  |
| 198 | Texto de ayuda, edición de puntos | "Cambiar los puntos no reescribe ningún intento: la tabla se vuelve a calcular sola. Si el evento ya empezó, el puesto de la gente puede moverse al guardar." |  |
| 218 | Botón, estado ocupado | "Guardando…" |  |
| 218 | Botón de guardar | "Guardar" |  |
| 221 | ConfirmDeleteButton, label | `Borrar ${unit.singular}` |  |
| 234 | alt del QR ya generado | `Código QR que abre la pantalla del juez para ${unit.singular} ${number}` |  |
| 244 | Botón, imprimir | "Imprimir" |  |
| 246 | Texto bajo el QR | `Imprímelo y pégalo junto ${unit.singular === 'ruta' ? 'a la ruta' : 'al bloque'}. El juez lo escanea, escribe el código del evento y entra directo a puntuar.` |  |

**Archivo:** `apps/web/app/(organizer)/panel/events/[id]/actions.ts` (errores de categoría, ronda y bloque)

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 45 | Error, `createCategory` | "Datos de la categoría inválidos." |  |
| 50 (y repetido en casi toda acción del archivo: 94, 129, 176, 254, 311, 368, 543) | Error, sesión inválida | "Sesión inválida, vuelve a iniciar sesión." |  |
| 61 | Error, `createCategory` | "Ese evento no existe o no te pertenece." |  |
| 89 | Error, `setRoundAdvances` | "Cupo inválido." |  |
| 106, 381, 557 | Error, ronda o bloque ajenos | "Esa ronda no existe o no te pertenece." |  |
| 124 | Error, `createRound` | "Datos de la ronda inválidos." |  |
| 141, 643 | Error, categoría ajena | "Esa categoría no existe o no te pertenece." |  |
| 171, 249, 307, 622, 716, 783 | Error, validación genérica | "Datos inválidos." |  |
| 197 | Error, `removeCategory` con inscritos | "Esta categoría tiene inscritos. Muévelos o quítalos desde el listado de inscritos y vuelve a intentar." |  |
| 211 | Error, `removeCategory` con intentos | "Esta categoría ya tiene intentos capturados: borrarla borraría el registro de un juez." |  |
| 267 | Error, `removeProblem` bloque ajeno | "Ese bloque no existe o no te pertenece." |  |
| 277 | Error, `removeProblem` con intentos | "Ya tiene intentos capturados: borrarlo borraría el registro de un juez." |  |
| 324 | Error, `removeRound` ronda ajena | "Esa ronda no existe o no te pertenece." |  |
| 335 | Error, `removeRound` con intentos | "Esta ronda ya tiene intentos capturados: borrarla borraría el registro de un juez." |  |
| 363, 539 | Error, `createProblem`/`updateProblem` validación | "Datos del bloque inválidos." |  |
| 384, 562 | Error, bloque de liga sin puntos | "Este evento puntúa por bloque: falta cuántos puntos vale su top." |  |
| 557 | Error, `updateProblem` bloque ajeno | "Ese bloque no existe o no te pertenece." |  |

## Panel — Detalle del evento — inscritos
**Archivo:** `apps/web/app/(organizer)/panel/events/[id]/roster.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 95 | aria-label del campo de dorsal | `Dorsal de ${entry.athleteFullName}` |  |
| 104 | Placeholder del dorsal | "—" |  |
| 119 | Estado guardando | "Guardando…" |  |
| 124 | Texto, inscrito con intentos capturados | "Ya tiene intentos capturados: no se puede mover ni quitar." |  |
| 133 | Botón, alternar edición | "Cancelar" / "Editar" |  |
| 143 | aria-label del selector de categoría | `Categoría de ${entry.athleteFullName}` |  |
| 157 | ConfirmDeleteButton, label | "Quitar" |  |
| 186 | Estado vacío, sin inscritos | "Todavía no se ha inscrito nadie. Cuando alguien abra el enlace de inscripción y se registre, aparece aquí y ya puedes ponerle dorsal." |  |
| 198 | Resumen total, singular | " inscrito" (con `total === 1 ? '' : 's'`) |  |
| 201 | Resumen, todos numerados | "todos con dorsal" |  |
| 203 | Resumen, faltan por numerar | `${total - numbered} sin dorsal` |  |
| 238 | Conteo por categoría | `${category.entries.length} inscrito${category.entries.length === 1 ? '' : 's'}` |  |
| 242 | Conteo, pendientes de dorsal por categoría | `${pending} sin dorsal` |  |
| 288 | Botón, estado ocupado | "Numerando…" |  |
| 288 | Botón de numeración | `Numerar desde ${start}` |  |
| 291 | Texto de ayuda | "Solo llena los que están vacíos, en orden de inscripción. Lo que ya escribiste a mano no se toca." |  |

**Archivo:** `apps/web/app/(organizer)/panel/events/[id]/actions.ts` (errores de inscripción)

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 582 | Error, `setBibNumber` validación | "Dorsal inválido." |  |
| 587, 627, 721, 788 | Error, sesión inválida | "Sesión inválida, vuelve a iniciar sesión." |  |
| 598, 728, 795 | Error, inscripción ajena | "Esa inscripción no existe o no te pertenece." |  |
| 622, 716, 783 | Error, validación genérica | "Datos inválidos." |  |
| 643 | Error, `numberCategory` categoría ajena | "Esa categoría no existe o no te pertenece." |  |
| 734 | Error, `moveRegistration` con intentos | "Ya tiene intentos capturados: cambiarlo de categoría dejaría esos intentos sin sentido." |  |
| 749 | Error, categoría destino de otro evento | "Esa categoría no existe para este evento." |  |
| 762 | Error, categoría no elegible por edad/género | "Esa categoría no corresponde a su edad o género." |  |
| 801 | Error, `removeRegistration` con intentos | "Ya tiene intentos capturados: quitarlo borraría el registro de un juez." |  |

## Panel — Invitaciones (/panel/invites)
**Archivo:** `apps/web/app/(organizer)/panel/invites/page.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 14 | `<title>` de la pestaña | "Invitaciones · Crux" |  |
| 57 | Enlace, volver | "← Panel" |  |
| 65 | Eyebrow | "Administración" |  |
| 66 | Título h1 | "Invitaciones" |  |
| 68 | Descripción | "Cada código sirve para crear una cuenta de organizador, una sola vez. Genera uno por persona y compártelo directo; el código muere al usarse." |  |
| 79 | Resumen, singular | "invitación sin usar" |  |
| 79 | Resumen, plural | "invitaciones sin usar" |  |
| 80 | Resumen, emitidas singular | "emitida" |  |
| 80 | Resumen, emitidas plural | "emitidas" |  |
| 86 | Botón, generar código | "Generar código" |  |
| 91 | Estado vacío | "Todavía no has generado ninguna invitación." |  |
| 109 | Estado, invitación usada | `Usada por ${invite.usedByName ?? 'un organizador'}` |  |
| 110 | Estado, invitación disponible | `Emitida el ${formatIssued(invite.createdAt)}` |  |
| 122 | Botón, descartar invitación | "Descartar" |  |

**Archivo:** `apps/web/app/(organizer)/panel/invites/actions.ts`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 18, 40 | Excepción lanzada, sin permiso de administrador | "No autorizado" |  |
| 46 | Excepción lanzada, id de invitación inválido | "Invitación inválida" |  |

## Panel — Organización (/panel/organization)
**Archivo:** `apps/web/app/(organizer)/panel/organization/page.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 39 | Enlace, volver | "← Tus eventos" |  |
| 42 | Eyebrow | "Organización" |  |

**Archivo:** `apps/web/app/(organizer)/panel/organization/organization-form.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 43 | Error, falla de red al subir | "No se pudo subir el logo. Inténtalo de nuevo." |  |
| 52 | Etiqueta | "Logo del gimnasio" |  |
| 57 | alt de la vista previa | "Logo del gimnasio" |  |
| 59 | Estado, sin logo | "Sin logo" |  |
| 76 | Botón, estado subiendo | "Subiendo…" |  |
| 76 | Botón, con logo existente | "Cambiar logo" |  |
| 76 | Botón, sin logo | "Subir logo" |  |
| 91 | Texto de ayuda | "Aparece junto al nombre del gimnasio en las tarjetas compartibles de resultado. PNG, JPG o WebP, hasta 2 MB." |  |

## Componentes compartidos del panel
**Archivo:** `apps/web/components/confirm-delete-button.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 72 | Botón de confirmación, estado ocupado | "Borrando…" |  |
| 72 | Botón de confirmación | `Sí, ${label.toLowerCase()}` |  |
| 80 | Botón, cancelar confirmación | "No" |  |

**Archivo:** `apps/web/components/admin-badge.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 76 | aria-label del SVG | "Alguien escalando un desplome al amanecer" |  |
| 89 | Rótulo del distintivo | "Administrador" |  |
| 90 | Descripción del distintivo | "Estás en la cuenta que lleva la plataforma. Aquí se reparten las invitaciones y viven las organizaciones de prueba." |  |

*(`apps/web/components/standings-motif.tsx` no tiene texto en español: el SVG es `aria-hidden` y los únicos textos que dibuja son los números de puesto 1–5, sin cadenas de idioma.)*

## Juzgar — pantalla principal (/juzgar/[slug]/[[...problemId]])
**Archivo:** `apps/web/app/(judge)/juzgar/[slug]/[[...problemId]]/page.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 117 | Título h1 | "Juzgar" |  |

## Juzgar — código del evento
**Archivo:** `apps/web/app/(judge)/juzgar/[slug]/judge-code-gate.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 40 | Error, demasiados intentos (429) | "Demasiados intentos seguidos. Espera unos minutos antes de volver a probar." |  |
| 41 | Error, código incorrecto | "Ese código no corresponde a este evento. Pídeselo a quien organiza." |  |
| 45 | Error, sin conexión al comprobar | "No hay conexión para comprobar el código. Conéctate un momento: la lista de competidores se descarga una sola vez." |  |
| 55 | Título h2 | "Código del evento" |  |
| 57 | Descripción | "Para registrar intentos necesitas el código que da quien organiza. Se pide una sola vez en este teléfono." |  |
| 69 | aria-label del campo | "Código del evento" |  |
| 78 | Botón, estado ocupado | "Comprobando…" |  |
| 78 | Botón de envío | "Empezar a juzgar" |  |

## Juzgar — identidad del juez y selección de bloque
**Archivo:** `apps/web/app/(judge)/juzgar/[slug]/capture-app.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 146 | Título h2, primera vez | "¿Quién va a juzgar?" |  |
| 148 | Descripción | "Tu nombre queda guardado en cada intento que registres, para poder resolver dudas después." |  |
| 153 | Placeholder | "Tu nombre" |  |
| 159 | Botón | "Continuar" |  |
| 172 | Etiqueta, cambiar de juez | "¿Quién está juzgando?" |  |
| 189 | Botón | "Guardar nombre" |  |
| 194 | Texto, juez activo | `Juzga ${judgeName}.` |  |
| 203 | Botón, cambiar de juez | "No soy yo" |  |
| 211 | Eyebrow, bloque bloqueado | "Estás juzgando" |  |
| 213 | Nombre del bloque activo | `Bloque ${active.problem.number}${active.problem.name ? ` · ${active.problem.name}` : ''}` |  |
| 222 | Botón, desbloquear selección | "Cambiar" |  |

**Archivo:** `apps/web/app/(judge)/juzgar/[slug]/block-picker.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 30 | Opción por defecto | "Elige categoría" |  |
| 40 | Opción por defecto | "Elige ronda" |  |
| 55 | Opción por defecto | "Elige bloque" |  |

## Juzgar — listado de competidores
**Archivo:** `apps/web/app/(judge)/juzgar/[slug]/athlete-roster.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 43 | Estado vacío, categoría sin inscritos | "Todavía no hay nadie inscrito en esta categoría. En cuanto se inscriban aparecerán aquí." |  |
| 51 | Encabezado de la lista | "Competidores de este bloque" |  |
| 53 | Contador de juzgados | `${judged} de ${entries.length} juzgados` |  |
| 61 | Placeholder de búsqueda | "Buscar por dorsal o nombre" |  |
| 94 | Estado, sin resultado registrado | "Sin juzgar" |  |
| 95 | Sufijo, intento aún no enviado | " · por enviar" |  |
| 107 | Búsqueda sin coincidencias | `Nadie coincide con "${query}". Revisa el dorsal o busca por nombre.` |  |

## Juzgar — captura de intentos
**Archivo:** `apps/web/app/(judge)/juzgar/[slug]/attempt-capture.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 23 | Descripción del resultado, top con conteo | `Top en ${values.topAttempts}` |  |
| 23 | Descripción del resultado, top sin conteo | "Top" |  |
| 26 | Descripción del resultado, zona | `Zona en ${values.zoneAttempts ?? '?'}` |  |
| 29 | Descripción del resultado, altura (lead) | `${values.height.toLocaleString('es-CO')} m` |  |
| 34 | Descripción del resultado, sin logro | "Intentado" |  |
| 223 | Aviso, sin conexión | "Sin conexión. Lo que registres se guarda en el teléfono y se envía solo cuando vuelva la señal." |  |
| 230 | Confirmación tras guardar | `Guardado · ${savedMessage}` |  |
| 257 | Contador, intentos por enviar (singular) | " intento por enviar" |  |
| 257 | Contador, intentos por enviar (plural) | " intentos por enviar" |  |
| 259 | Contador, todo sincronizado | "Todo enviado" |  |
| 260 | Sufijo, intentos rechazados | ` · ${rejectedCount} no se pudo enviar` |  |

**Archivo:** `apps/web/app/(judge)/juzgar/[slug]/attempt-form.tsx`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 40 | AchievementToggle, estado activo | "sí" |  |
| 40 | AchievementToggle, estado inactivo | "no" |  |
| 68 | aria-label, restar intento (stepper genérico) | `Quitar un intento de ${label}` |  |
| 74 | Valor vacío del stepper | "—" |  |
| 79 | aria-label, sumar intento (stepper genérico) | `Sumar un intento a ${label}` |  |
| 145 | Error de validación, boulder sin conteo de top | "Falta en cuántos intentos logró el top." |  |
| 147 | Error de validación, boulder sin conteo de zona | "Falta en cuántos intentos logró la zona." |  |
| 158 | Error de validación, lead sin altura | "Falta la altura alcanzada." |  |
| 161 | Error de validación, altura no interpretable | "La altura no se entiende. Escríbela en metros, por ejemplo 18,5." |  |
| 194 | Eyebrow, corrigiendo un resultado existente | "Corrigiendo" |  |
| 194 | Eyebrow, primer registro | "Registrando" |  |
| 206 | Botón, cerrar formulario | "Cerrar" |  |
| 212 | Aviso, ya tiene resultado en este bloque | "Ya tiene un resultado en este bloque. Si guardas, queda el nuevo — el anterior no se borra, se conserva para poder auditar el evento." |  |
| 227 | Etiqueta, contador de intentos (boulder) | "Intentos que lleva" |  |
| 228 | Texto de ayuda, contador de intentos | "Toca cada vez que lo intenta" |  |
| 234 | aria-label, restar intento del contador | "Quitar un intento" |  |
| 245 | aria-label, sumar intento del contador | "Sumar un intento" |  |
| 257 | Botón, reiniciar contador | "Reiniciar" |  |
| 263 | Etiqueta del toggle | "Top" |  |
| 272 | Etiqueta del stepper | "Intentos hasta el top" |  |
| 276 | Etiqueta del toggle | "Zona" |  |
| 286 | Etiqueta del stepper | "Intentos hasta la zona" |  |
| 293 | Nota, sin top ni zona (boulder) | "Sin top ni zona: queda registrado como intentado." |  |
| 299 | Etiqueta del toggle (lead) | "Llegó al top" |  |
| 309 | Nota, top en lead no necesita altura | "Terminó la vía. No hace falta altura: nadie llega más arriba que el final." |  |
| 314 | Etiqueta, campo de altura | "Altura alcanzada, en metros" |  |
| 324 | Placeholder, campo de altura | "18,5" |  |
| 344 | Botón de envío, corrigiendo | "Guardar corrección" |  |
| 344 | Botón de envío, primer registro | "Guardar intento" |  |

## Juzgar — API de intentos (errores)
**Archivo:** `apps/web/app/api/attempts/route.ts`

| Línea | Dónde aparece | Texto actual | Tu versión |
|---|---|---|---|
| 75 | Error, `problemId` inválido en GET | "Bloque inválido." |  |
| 99 | Error, validación de POST | "Datos de intento inválidos." |  |
| 120 | Error, límite de intentos de código (429) | "Demasiados códigos incorrectos. Espera unos minutos." |  |
| 126 | Error, código del evento incorrecto (403) | "El código del evento no es correcto." |  |
| 133 | Error, inscripción y bloque de categorías distintas (400) | "La inscripción y el bloque no pertenecen a la misma categoría." |  |

---

### Notas de alcance

- `apps/web/lib/invites.ts`, `apps/web/lib/admin.ts`, `apps/web/lib/organizations.ts` y
  `apps/web/lib/minor-authorization.ts` se revisaron completos: no contienen ninguna
  cadena literal en español que se muestre al usuario (solo comentarios de código,
  fuera de alcance).
- `apps/web/components/standings-motif.tsx` se revisó completo: no tiene texto en
  español (SVG decorativo `aria-hidden`).
- Los textos de `unit.singular`/`unit.plural` ("bloque"/"bloques" o "ruta"/"rutas")
  y de `ROUND_TYPE_LABEL`/`GENDER_LABEL`/`DISCIPLINE_LABEL` vienen de
  `apps/web/lib/labels.ts`, explícitamente fuera de este alcance — se documentan
  solo los textos fijos que los envuelven, con el marcador de interpolación visible.
- No se tocó ni editó ningún archivo: extracción de solo lectura.

---

# Apéndice A — Diccionario de jerga (`apps/web/lib/labels.ts`)

Fuera de alcance de este inventario: es la jerga ya decidida y documentada en
`apps/web/CLAUDE.md` (2026-08-10), no texto suelto de una pantalla. Se cita
aquí completo solo como referencia, por si al revisar el resto quieres que
algo se ajuste también aquí — en ese caso dímelo aparte, este archivo no
tiene columna "Tu versión".

| Constante | Valor | Texto |
|---|---|---|
| `DISCIPLINE_LABEL` | `boulder` | Boulder / Bloque |
| `DISCIPLINE_LABEL` | `lead` | Lead / Dificultad |
| `HEADLINE_LINES` | (portada, hero) | "Todos los bloques." / "Todos los pegues." / "Una sola tabla." |
| `ROUND_TYPE_LABEL` | `qualification` | Clasificatoria |
| `ROUND_TYPE_LABEL` | `semifinal` | Semifinal |
| `ROUND_TYPE_LABEL` | `final` | Final |
| `SCORING_FORMAT_LABEL` | `ifsc_boulder` | Puntos IFSC de bloque |
| `SCORING_FORMAT_LABEL` | `classic_tops_zones` | Conteo clásico de tops y zonas |
| `SCORING_FORMAT_LABEL` | `league_points` | Puntos por bloque, estilo liga local |
| `SCORING_FORMAT_LABEL` | `max_height` | Altura máxima en dificultad |
| `GENDER_LABEL` | `male` | Masculino |
| `GENDER_LABEL` | `female` | Femenino |
| `GENDER_LABEL` | `mixed` | Mixta |
| `SCORE_TERM.top` | — | Top |
| `SCORE_TERM.zone` | — | Zona |
| `SCORE_TERM.noTop` | — | Sin top |
| `SCORE_TERM.flash` | — | flash |
| `problemUnit('boulder')` | — | bloque / bloques / "el" |
| `problemUnit('lead')` | — | ruta / rutas / "la" |
| `attemptSummary` (sin registro) | — | Sin registro |
| `attemptSummary` (top, altura) | — | Llegó al top |
| `attemptSummary` (top, tops/zonas) | — | `Top en {n} · Zona en {n}` |
| `attemptSummary` (zona) | — | `Zona en {n}` |
| `attemptSummary` (sin nada) | — | Sin zona |
| `ordinal(n)` | — | `{n}.º` |

---

# Apéndice B — Textos con lógica de negocio (no editar como texto suelto)

Estos tres lugares generan el texto con condicionales y datos de por medio.
Cámbialos aparte, en conversación conmigo, no llenando "Tu versión" — un
cambio de palabra aquí puede tocar la rama de la que sale.

## `apps/web/lib/share-card.ts` — titular de la tarjeta compartible

`headlineFor()` decide el titular según el caso:

| Caso | Texto |
|---|---|
| Primera competencia del atleta | "Mi primera competencia" |
| Mejor puesto relativo de su historial en esa modalidad | "Récord personal" |
| Subió puestos desde el evento anterior | `Subí {rankDelta} puesto{rankDelta === 1 ? '' : 's'}` |
| Ninguno de los anteriores | `Completé {result.eventName}` |
| Podio de una final (1º, 2º o 3º) | `{ordinal(result.rank)} lugar` (p. ej. "1.º lugar") |

## `apps/web/app/api/tarjeta/[athleteId]/route.tsx` — imagen de la tarjeta (Satori/OG)

Solo un literal fijo, el resto es lo que arma `share-card.ts` de arriba:

| Dónde aparece | Texto |
|---|---|
| Rótulo de marca, encabezado de la imagen | CRUX |
| Pie de página, dominio | cruxcompetencias.com |

## `apps/web/lib/csv-export.ts` — encabezados de columna del CSV descargable

| Columna |
|---|
| Categoría |
| Ronda |
| Puesto |
| Empate |
| Dorsal |
| Competidor |
| Bloque |
| Top |
| Intentos a top |
| Zona |
| Intentos a zona |
| Altura (bloque) |
| Tops (total) |
| Intentos a top (total) |
| Zonas (total) |
| Intentos a zona (total) |
| Puntaje |
| Altura máxima |
| Ruta completada |
