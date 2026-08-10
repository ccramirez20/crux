# Pendiente: prueba en celular de la captura de jueces

Fecha: 2026-08-10 · Estado: **sin probar en dispositivo real**

Todo lo de abajo está commiteado y en `main` (`0bb9b16`), con `pnpm test` y
`pnpm typecheck` en verde y build de producción compilando. Lo que **no** está
hecho es la verificación end-to-end desde un teléfono: eso no lo puedo hacer yo
y es lo único que falta para cerrar el criterio de "terminado" de la etapa 1.

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
1. Panel → Evento de prueba → **QR para juzgar** del Bloque 1 → escanear.
2. Escribir un código incorrecto: debe rechazarlo. Luego `PARAMO26`.
3. Poner nombre de juez → aparece el roster con dorsal 11 y "Sin juzgar".
4. Tocar a Beto → Top → contador a 2 con el `+` → guardar. El roster debe
   mostrar "Top en 2" y "1 de 1 juzgados".
5. Tocarlo otra vez: el formulario llega precargado y avisa que ya tiene
   resultado. Cambiar a 3 y guardar: debe quedar un intento **nuevo**, no un
   reemplazo.

### B. Dificultad
6. Copa Cuerda → QR de *Ruta Chingaza* → `CUERDA26`.
7. Tocar a 31 Laura: **no debe haber Top ni Zona**, solo altura en metros.
   Guardar `18.5`.
8. Guardar sin altura: debe pedirla.

### C. Sin conexión (lo que de verdad importa)
9. Modo avión → debe aparecer la franja "Sin conexión…".
10. Registrar a 32 (altura 12) y 33 (altura 20): quedan "por enviar".
11. **Sin salir del modo avión**, cambiar a *Ruta Sumapaz* y registrar a Laura.
12. Quitar el modo avión: debe sincronizar **todo, incluida la Ruta Chingaza que
    ya se había dejado atrás**. Ese fue un bug corregido sobre el plan original
    y es el caso que hay que confirmar en hardware real.

### D. Aislamiento entre eventos
13. Con el teléfono ya desbloqueado en Copa Cuerda, abrir el QR del evento de
    búlder: debe pedir `PARAMO26` otra vez (los códigos se guardan por evento).

### E. Verificación final
`pnpm db:studio` → tabla `attempts`: `sequence` en el mismo orden en que se
capturó, y la corrección del paso 5 con `sequence` mayor que el intento que
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

## Lo que sigue después

1. Tabla pública de resultados — hay brief de diseño en `docs/01-etapas.md`.
   Es una pantalla proyectada, no un CRUD.
2. Recuperación de contraseña (bloqueada por decidir proveedor de correo).
3. Rate limiting en `/api/attempts` y `/api/judge-access` (deuda anotada en ADR 0002).
4. Manual de uso en HTML, al cerrar la etapa.
