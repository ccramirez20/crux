# Prueba en celular de la captura de jueces

Fecha: 2026-08-10 · Estado: **corrida en hardware real y aprobada**

## Resultado de la corrida

Teléfono real, wifi de casa, servidor de desarrollo por IP de LAN.

| Paso | Resultado |
|---|---|
| A-1 … A-5 · búlder | Todo bien, incluida la corrección que no reemplaza |
| B-6 … B-8 | La altura se rechaza si falta. **Falló el decimal**, ver abajo |
| C-9 … C-11 · sin conexión | **Aprobado**, y repetido con la pantalla bloqueada |
| D-12 · aislamiento | Comportamiento correcto, el paso estaba mal escrito |
| E · base | `sequence` en orden, correcciones por encima |

**C-11 quedó confirmado en hardware**, que era lo único que faltaba para el
criterio de "terminado" de la etapa 1: capturar sin señal en una ruta, cambiarse
a otra, bloquear el teléfono, y que al volver la señal se sincronice todo —
incluida la ruta que ya se había dejado atrás.

### Lo que salió mal: el separador decimal
Escribir `18,5` guardaba **185**. El teclado en español entrega coma, y un
`<input type="number">` la descarta en silencio; nadie ve nada raro hasta que el
puntaje sale absurdo. El campo pasó a ser de texto con `inputMode="decimal"` y
`apps/web/lib/height.ts` acepta coma y punto. Un error de captura silencioso que
multiplica una altura por diez es exactamente lo que arruina una final.

### Lo que no era un error: D-12
El teléfono no volvió a pedir el código al abrir el evento de búlder, pero es lo
correcto: ese mismo teléfono ya lo había desbloqueado en A-2, y los códigos se
guardan por evento (`crux-judge-code:<slug>`). La prueba real del aislamiento ya
había pasado en B-6, cuando pidió `CUERDA26` para Copa Cuerda **teniendo ya**
`PARAMO26` guardado. El paso quedó reescrito abajo para que verifique eso.

El guion queda como regresión: se vuelve a correr entero antes de cualquier
evento real, y después de tocar la cola de sincronización o el formulario.

**Sigue sin probarse en iOS/Safari.** Todo lo de arriba es un solo teléfono. Un
segundo modelo, y sobre todo Safari, es la próxima verificación pendiente.

## Cómo levantar el entorno

```bash
pnpm dev            # queda en 0.0.0.0:3000
```

Abrir **`http://<IP-LAN>:3000`** en el computador también, no `localhost`: el QR
se genera con el origen del navegador, y si dice `localhost` el teléfono no lo
alcanza. En la última sesión la IP era `192.168.2.14`; verificar que siga siendo
esa.

**No correr `next build` con `next dev` encendido.** Comparten la carpeta
`.next` y el build pisa los artefactos del dev: todas las rutas empiezan a dar
500 con `MODULE_NOT_FOUND`. Se cura reiniciando dev.

## Datos de prueba en la base

| Evento | Modalidad | Slug | Código de juez |
|---|---|---|---|
| Evento de prueba | búlder | `evento-prueba` | `PARAMO26` |
| Copa Cuerda 2026 | dificultad | `copa-cuerda` | `CUERDA26` |

- **Evento de prueba**: categorías *Avanzado Masculino* (dorsal 11, Beto Prueba)
  y *Avanzado Femenino* (dorsal 22, Ana Prueba). Un bloque por categoría.
- **Copa Cuerda 2026**: *Abierta Femenina*, dos rutas (*Chingaza*, *Sumapaz*),
  dorsales 31 Laura Rivas, 32 Sara Molina, 33 Valentina Cruz.

`attempts` quedó vacía. Para volver a vaciarla entre corridas basta un
`delete from attempts`.

## Guion de prueba

### A. Búlder
- **A-1.** Panel → Evento de prueba → **QR para juzgar** del Bloque 1 → escanear.
- **A-2.** Escribir un código incorrecto: debe rechazarlo. Luego `PARAMO26`.
- **A-3.** Poner nombre de juez → aparece el roster con dorsal 11 y "Sin juzgar".
- **A-4.** Tocar a Beto → Top → contador a 2 con el `+` → guardar. El roster debe
  mostrar "Top en 2" y "1 de 1 juzgados".
- **A-5.** Tocarlo otra vez: el formulario llega precargado y avisa que ya tiene
  resultado. Cambiar a 3 y guardar: debe quedar un intento **nuevo**, no un
  reemplazo.

### B. Dificultad
- **B-6.** Copa Cuerda → QR de *Ruta Chingaza* → debe pedir código **aunque el
  teléfono ya tenga guardado el de búlder**, y solo aceptar `CUERDA26`. Esta es
  la prueba de aislamiento entre eventos.
- **B-7.** Tocar a 31 Laura: **no debe haber Zona**, sí un interruptor "Llegó al
  top" y el campo de altura. Guardar `18,5` **con coma** — debe quedar 18,5, no
  185. Repetir con punto en otra competidora: las dos formas valen.
- **B-8.** Guardar sin altura y sin top: debe pedir la altura. Encender "Llegó al
  top" y guardar sin altura: **ahora sí debe dejar**, y la lista debe decir "Top".

### C. Sin conexión (lo que de verdad importa)
- **C-9.** Modo avión → debe aparecer la franja "Sin conexión…".
- **C-10.** Registrar a 32 (altura 12) y 33 (altura 20): quedan "por enviar".
- **C-11.** **Sin salir del modo avión**, cambiar a *Ruta Sumapaz* y registrar a
  Laura. Después quitar el modo avión: debe sincronizar **todo, incluida la Ruta
  Chingaza que ya se había dejado atrás**.

> **C-11 es el paso crítico y ya pasó en hardware** (2026-08-10), incluida la
> variante de bloquear la pantalla en modo avión antes de volver a la señal. Fue
> un bug corregido sobre el plan original — la cola drenaba solo el bloque
> activo — y es el único paso donde el teléfono tiene que recordar trabajo de una
> pantalla que el juez ya cerró. Repetirlo siempre que se toque la cola.

### D. Códigos
- **D-12.** Volver al QR de un evento **ya desbloqueado en este teléfono**: no
  debe pedir el código otra vez. El código se guarda por evento y sigue ahí. El
  aislamiento entre eventos se prueba en B-6, no aquí.
- **D-13.** En un evento sin desbloquear (o después de borrar los datos del
  sitio), escribir mal el código **cinco veces seguidas**: a la sexta debe salir
  "Demasiados intentos seguidos" (ver ADR 0002). Se libera solo a los 5 minutos,
  o reiniciando `pnpm dev` — el contador vive en memoria.

### E. Verificación final
`pnpm db:studio` → tabla `attempts`: `sequence` en el mismo orden en que se
capturó, y la corrección del paso A-5 con `sequence` mayor que el intento que
corrige.

## Riesgos conocidos que esta prueba debería tocar

- **Contexto inseguro.** El teléfono entra por `http` sobre IP de LAN, que no es
  contexto seguro. Ya mordió dos veces: `crypto.randomUUID` y
  `navigator.clipboard`, ambos `undefined` ahí. Si aparece cualquier otro
  `TypeError` de una API del navegador, sospechar de lo mismo primero.
- **iOS/Safari** no se ha probado en absoluto. IndexedDB en Safari tiene
  historia de comportamientos raros al cerrar pestañas.
- **Reload con código guardado**: la lista de competidores ya no viaja con la
  página (ver ADR 0002 y el fix de PII); se vuelve a pedir con el código
  guardado. Confirmar que tras recargar el roster sigue apareciendo.

## Deuda cerrada el 2026-08-10 (después de escribir este guion)

- **Rate limiting.** `apps/web/lib/rate-limit.ts`: 5 códigos fallidos por IP en
  5 minutos → 429. Solo cuenta fallos, nunca capturas válidas. Ver ADR 0002 y el
  paso D-13.
- **Un organizador podía leer eventos ajenos.** `/panel/events/[id]` filtraba por
  `id` y solo escondía los formularios de edición, así que servía la estructura
  completa — incluidos los `problemId`, que *son* la URL de captura. Ahora la
  consulta filtra por `ownerId`; un evento ajeno se comporta igual que uno que no
  existe.
- **`BETTER_AUTH_TRUSTED_ORIGINS` con test.** El regex de rango privado que deja
  entrar al teléfono por IP de LAN en desarrollo estaba sin ninguna prueba;
  `apps/web/lib/auth.test.ts` lo fija, incluido que en producción solo vale la
  lista configurada y nunca el header del cliente. `apps/web` ya corre `vitest`.

Falta poner la variable en `apps/web/.env.example` (no la puedo escribir yo):

```
# Origenes extra permitidos por Better Auth, separados por coma. En desarrollo
# no hace falta: las IP privadas se confian solas. En produccion es obligatorio
# si la app se sirve desde un dominio distinto al de BETTER_AUTH_URL.
BETTER_AUTH_TRUSTED_ORIGINS=
```

## Cambios que salieron de la corrida

- **Decimal con coma** en la altura (`apps/web/lib/height.ts`, con tests).
- **Top en dificultad**: interruptor en el formulario y en el scoring, un top
  gana sobre cualquier altura y dos tops empatan. Ver ADR 0003.
- **El freno bajó de 10 a 5** códigos fallidos.
- **Feedback al abrir un evento**: `loading.tsx` con la silueta de la página, en
  vez de la lista congelada mientras corren las consultas.
- **Panel del organizador rediseñado**: la estructura se lee como una vía —
  línea vertical con un nodo por nivel y un color por nivel (pine categoría,
  bark ronda, gold bloque) — los formularios se pliegan detrás de un botón y
  tienen etiquetas reales en vez de placeholders. El QR se abre centrado.
- **"Ruta" en vez de "bloque"** cuando la modalidad es dificultad
  (`problemUnit` en `lib/labels.ts`). En el código sigue siendo `Problem`.

## Lo que sigue después

1. Tabla pública de resultados — hay brief de diseño en `docs/01-etapas.md`.
   Es una pantalla proyectada, no un CRUD.
2. Recuperación de contraseña (bloqueada por decidir proveedor de correo).
3. Manual de uso en HTML, al cerrar la etapa.
