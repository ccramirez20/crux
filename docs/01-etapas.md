# Etapas

La tabla resumen vive en CLAUDE.md porque se consulta en cada turno.
Aqui va el detalle: para cada etapa, el alcance exacto, lo que queda
explicitamente fuera, y el criterio de desbloqueo de la siguiente.

## Etapa 1 — ACTIVA
### Dentro del alcance
### Fuera del alcance
### Criterio de desbloqueo de la etapa 2

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
