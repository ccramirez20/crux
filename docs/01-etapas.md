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
- Captura de intentos por juez, offline-first — **en curso**
- Scoring en vivo (`packages/scoring`) — **listo**: `classic_tops_zones`, `ifsc_boulder`, `league_points`, `max_height`, con tests de empate. Falta conectarlo a una vista.
- Tabla pública de resultados (`Leaderboard`) — **pendiente**
- Historial de competidor entre eventos — el modelo de datos ya lo soporta (un `Athlete` se reutiliza entre inscripciones por `documentId`); falta la vista pública de perfil
- Manual de uso corto, en lenguaje natural, como HTML diseñado y autocontenido (un archivo, se comparte por WhatsApp o se abre sin internet) — **al cerrar la etapa**, cuando el flujo ya no cambie

### La tabla pública no es una tabla a secas

Es la pantalla que ve toda la sala al mismo tiempo, proyectada, durante horas.
No es un `<table>` con bordes. Requisitos de producto, no adornos:

- Identidad visual de montaña y escalada (ver el sistema de diseño Páramo y `components/topographic-motif`), no un dashboard genérico.
- Se actualiza sola en tiempo real (decisión #4: polling de 5s sobre respuesta cacheada; SSE solo si hace falta).
- Interactiva: filtrar por categoría y ronda, ver el detalle de un competidor.
- Gráficas que digan algo útil e interesante, no decorativas — progresión de la ronda, dificultad real de cada bloque (cuántos lo toparon), quién se movió de puesto.
- Tablas legibles a distancia, con los desempates visibles para que nadie los discuta.

Es la cara pública del producto: es lo que el gimnasio muestra y lo que hace
que el siguiente gimnasio pregunte. Diseñarla como una pantalla, no como un CRUD.

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
