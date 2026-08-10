# 0002 — Codigo de juez por evento

Fecha: 2026-08-10 · Estado: aceptada

## Contexto
La pantalla del juez se abre escaneando un QR pegado junto al bloque. La slice
de captura la diseno sin ninguna autenticacion: el enlace era el control de
acceso, igual que en `/inscripcion/[slug]`, apoyandose en que un `problemId`
es un UUID no adivinable.

Eso ignora el escenario real. El QR esta pegado en la pared, a la vista de
todos los que compiten. Cualquiera lo fotografia y queda con permiso
permanente para escribir en la tabla de resultados. Los intentos son
append-only y quedan firmados con `judgeLabel`, asi que un intento falso es
auditable, pero `judgeLabel` lo escribe quien captura: no prueba nada.

## Decision
Cada evento tiene un `judgeCode` (columna nueva `events.judge_code`, nullable).
Cuando esta puesto, quien abre la pantalla del juez debe escribirlo una vez;
queda en `localStorage` con clave por slug, y viaja en cada intento para que la
validacion ocurra en el servidor, en `POST /api/attempts`.

Nullable significa "evento sin codigo, acceso abierto": es lo que hace que los
eventos creados antes de esta decision sigan funcionando. Todo evento nuevo
nace con un codigo generado de 8 caracteres sobre un alfabeto de 32 simbolos
sin I/O/0/1, porque se lee de un papel y se teclea en un telefono.

El codigo nunca se envia a la pantalla del juez: esa pagina es publica y solo
recibe un booleano `requiresJudgeCode`.

## Alternativas descartadas
- **QR firmado con vencimiento (HMAC).** Cierra el uso del enlace despues del
  evento, que no es el problema; durante el evento cualquiera que escanee sigue
  entrando. Ademas complica reimprimir QR si cambian las fechas.
- **Cuentas de juez con rol.** Es lo unico que cierra el hueco de verdad, pero
  CLAUDE.md deja roles fuera de la etapa 1, y pedir correo y contrasena a tres
  jueces prestados el dia del evento es exactamente la friccion que el producto
  evita.
- **Solo auditoria.** Dar al organizador una pantalla para revisar y corregir.
  Util, pero no previene: se entera despues de que paso.

## Consecuencias
- **No hay rate limiting** en `POST /api/attempts` ni en `/api/judge-access`.
  Con 8 caracteres sobre 32 simbolos son ~10^12 combinaciones, suficiente por
  ahora, pero el dia que haya un evento con publico hostil hay que ponerlo.
- El codigo se guarda en `localStorage`, legible por JS en ese dispositivo. Es
  un secreto compartido de evento, no una contrasena personal; se acepta.
- Un codigo equivocado devuelve 403 y la cola **no** se descarta: los intentos
  siguen en el telefono y el juez vuelve a la pantalla del codigo. Perder
  capturas reales por un codigo mal escrito seria peor que el problema que
  esto resuelve.
- Si el organizador pierde el codigo, hoy solo se recupera desde el panel del
  evento. No hay forma de rotarlo sin tocar la base.
