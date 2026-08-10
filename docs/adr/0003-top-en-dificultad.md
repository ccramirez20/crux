# 0003 — Top en dificultad

Fecha: 2026-08-10 · Estado: aceptada

## Contexto
La captura de dificultad pedia solo altura en metros, porque `max_height` ordena
por altura. Pero terminar la via es un resultado distinto de "llego muy alto", y
el juez no tiene forma de anotarlo: tendria que inventarse la altura del final,
que nadie mide con cinta el dia del evento. Dos personas que terminan la misma
via quedarian separadas por lo que cada juez decidio escribir.

La columna `attempts.top` ya existe y la usa bulder, asi que esto no toca el
esquema.

## Decision
El formulario de dificultad tiene un interruptor "Llego al top". Cuando esta
encendido no pide altura.

En `scoreMaxHeight` un top gana sobre cualquier altura, y dos tops empatan entre
si aunque tengan alturas distintas capturadas — esa diferencia es ruido de
captura, no de desempeno.

## Alternativas descartadas
- **Guardar la altura de la via en `problems` y que el top signifique esa
  altura.** Es mas exacto y probablemente sea lo correcto cuando haya
  clasificacion oficial, pero obliga al organizador a medir y capturar un dato
  mas por via antes de poder correr el evento. No hoy.
- **Dejar que el juez escriba la altura del final.** Es justo lo que produce el
  desempate falso que esto elimina.

## Consecuencias
- Dos tops empatan y la etapa 1 no los desempata. El IFSC desempata por tiempo;
  capturar tiempos es otra decision y no esta en el alcance.
- `MaxHeightResult` ahora expone `top`, para que la tabla publica pueda mostrar
  "Top" en vez de una altura que no existe.
- Un intento de dificultad puede quedar sin altura. Todo lo que lea `height`
  tiene que seguir tolerando `null`, que ya era el caso.
