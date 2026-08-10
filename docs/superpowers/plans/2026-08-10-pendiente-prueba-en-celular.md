# Pendiente: prueba en celular de la captura de jueces

Fecha: 2026-08-10 · Estado: **sin probar en dispositivo real**

Todo lo de abajo está commiteado y en `main`, con `pnpm test` y `pnpm typecheck`
en verde y build de producción compilando.

**Nada de la captura de jueces se ha probado en un teléfono real.** Lo verificado
hasta hoy fue por HTTP contra el servidor de desarrollo y consultando la base:
eso demuestra que el servidor acepta y guarda lo correcto, y **no** demuestra
nada sobre el navegador del teléfono — ni IndexedDB, ni el evento `online`, ni
el comportamiento al bloquear la pantalla, ni Safari. El guion de abajo es
exactamente esa verificación que falta, y es lo único que queda para cerrar el
criterio de "terminado" de la etapa 1.

El caso que más importa confirmar en hardware es **C-11**: capturar sin señal en
una ruta, cambiarse a otra, y que al volver la conexión sincronice también lo de
la primera.

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
- **B-6.** Copa Cuerda → QR de *Ruta Chingaza* → `CUERDA26`.
- **B-7.** Tocar a 31 Laura: **no debe haber Top ni Zona**, solo altura en
  metros. Guardar `18.5`.
- **B-8.** Guardar sin altura: debe pedirla.

### C. Sin conexión (lo que de verdad importa)
- **C-9.** Modo avión → debe aparecer la franja "Sin conexión…".
- **C-10.** Registrar a 32 (altura 12) y 33 (altura 20): quedan "por enviar".
- **C-11.** **Sin salir del modo avión**, cambiar a *Ruta Sumapaz* y registrar a
  Laura. Después quitar el modo avión: debe sincronizar **todo, incluida la Ruta
  Chingaza que ya se había dejado atrás**.

> **C-11 es el paso que hay que confirmar en hardware.** Fue un bug corregido
> sobre el plan original — la cola drenaba solo el bloque activo — y el arreglo
> nunca se ha ejercitado en un teléfono de verdad. Si algo de todo el guion va a
> fallar el día del evento, es esto: es el único paso donde el teléfono tiene que
> recordar trabajo de una pantalla que el juez ya cerró. Vale la pena repetirlo
> dos veces, y una de ellas bloqueando la pantalla mientras está en modo avión.

### D. Aislamiento entre eventos
- **D-12.** Con el teléfono ya desbloqueado en Copa Cuerda, abrir el QR del
  evento de búlder: debe pedir `PARAMO26` otra vez (los códigos se guardan por
  evento).
- **D-13.** Escribir mal el código diez veces seguidas: al onceavo debe salir
  "Demasiados intentos seguidos" (freno nuevo, ver ADR 0002). Se libera solo a
  los 5 minutos, o reiniciando `pnpm dev` — el contador vive en memoria.

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

- **Rate limiting.** `apps/web/lib/rate-limit.ts`: 10 códigos fallidos por IP en
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

## Lo que sigue después

1. Tabla pública de resultados — hay brief de diseño en `docs/01-etapas.md`.
   Es una pantalla proyectada, no un CRUD.
2. Recuperación de contraseña (bloqueada por decidir proveedor de correo).
3. Manual de uso en HTML, al cerrar la etapa.
