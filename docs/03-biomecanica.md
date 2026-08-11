# Biomecanica del boulder — base para la taxonomia de fallas

**Estado: borrador de trabajo, 2026-08-11.** Lo escribio Claude a partir de
literatura publica; falta la correccion de CR, que es quien tiene la maestria en
biomecanica del deporte enfocada en escalada. Nada de aqui se implementa hasta
que este revisado. La etapa 2 sigue bloqueada.

## Por que existe este documento

El foso de la etapa 2 no es la vision por computador —todos usan la misma
MediaPipe— sino **saber que mirar**. Las apps que ya existen entregan metricas
sueltas: BetterClimber saca estabilidad, tension corporal, posicion de cadera y
suavidad de 33 landmarks; Belay.ai saca centro de gravedad, velocidad y
direccion. Ninguna entrega un diagnostico tipificado, y la razon de fondo es que
no tienen contra que validarlo.

Una taxonomia de fallas por fase de movimiento es lo que convierte metrica en
diagnostico. Este documento reune lo que la literatura ya establecio y marca
donde hace falta criterio propio.

## Lo que la literatura si establece

### 1. El ciclo de movimiento tiene tres fases

La descomposicion canonica del movimiento en escalada es un ciclo de tres fases:
**estabilizacion → preparacion → desplazamiento**. Es la columna vertebral
natural de la taxonomia: una falla no es "mala tecnica", es una falla *en una
fase*, y esa es exactamente la promesa de producto que ya esta escrita en
CLAUDE.md ("en que momento inicio mal la extension, en que movimiento cargo el
pie equivocado").

### 2. La fluidez se mide con jerk de cadera, y correlaciona con nivel

Seifert, Orth, Davids y colegas definieron **fluidez** a partir de coeficientes
de jerk normalizados sobre la traslacion y la rotacion 3D de la cadera. Es el
indicador que mejor separa niveles: el jerk de la trayectoria de cadera
correlaciona alto con capacidad de escalada. Los estudios originales usaron una
IMU en la cadera; la pregunta abierta para nosotros es cuanto de eso sobrevive a
pose 2D desde un telefono.

### 3. La cadera cerca del muro es un principio, no una opinion

La distancia cadera-muro cambia el angulo de tiro sobre las presas y traslada
peso a los pies. Es de las computaciones mas frecuentes en estudios cinematicos
y aparece tambien como causa comun de sobreuso de brazos en desplome suave.

### 4. Hay numeros de referencia de competencia de boulder

Analisis de tiempo-movimiento en boulder de competencia: **3.0 ± 0.5 intentos**
por bloque, **28.9 ± 10.8 s** por intento, **114 ± 31 s** de descanso entre
intentos, **7.9 ± 1.3 s** agarrando presas y **~0.5 s** de transicion entre
presas. Sirve para dimensionar la sesion del entrenador —cinco alumnos, cinco
intentos— y para saber cuanto video real hay que procesar.

### 5. La terminologia del gremio no es cientifica

El trabajo de sistematizacion de 2026 en *J. Funct. Morphol. Kinesiol.* dice
explicitamente que los manuales de escalada usan terminologia experiencial y no
cientifica, y que eso genera inconsistencia. Confirma el hueco: **no existe una
taxonomia de fallas validada y aceptada**. Eso es la oportunidad y tambien la
advertencia — nadie la ha resuelto.

## Lo que la literatura NO da, y hay que poner

- **No hay catalogo de modos de falla tipificados.** Hay metricas continuas
  (jerk, distancia cadera-muro, tiempos de contacto) y hay clasificacion de
  tecnicas, pero no un "estas son las N maneras tipicas de fallar un movimiento".
- **No hay umbrales.** Ningun paper dice "por encima de este jerk hay un
  problema". Los umbrales dependen de nivel, de la via y del cuerpo.
- **No hay validacion contra resultado.** Los estudios comparan expertos con
  novatos, no intento logrado contra intento fallido en el mismo bloque. Eso es
  justamente lo que nuestro dato permite y es donde podemos aportar algo nuevo.

## Borrador de taxonomia — PARA CORREGIR

Estructura propuesta: cada falla pertenece a una fase, se define por una senal
observable y se valida contra el resultado del intento. **Los nombres y la
seleccion son tentativos.**

### Fase de estabilizacion

| Falla candidata | Senal observable | Duda |
|---|---|---|
| Cadera lejos del muro | Distancia cadera–plano del muro | En 2D solo se ve de perfil; de frente no se mide |
| Peso colgado de brazos | Angulo de codo sostenido + carga aparente en pies | ¿Se distingue de un reposo legitimo? |
| Base de pies inestable | Micro-movimiento del tobillo antes de soltar mano | ¿Es ruido de la pose o senal? |

### Fase de preparacion

| Falla candidata | Senal observable | Duda |
|---|---|---|
| Extension iniciada tarde | Orden temporal entre extension de pierna y salida de mano | Es la promesa que ya esta escrita; hay que definir "tarde" |
| Pie equivocado cargado | Cual pie soporta antes del desplazamiento | Requiere saber la direccion del movimiento siguiente |
| Sin reposicionar antes de salir | Ausencia de ajuste de cadera antes de la salida | ¿Falla o estilo? |

### Fase de desplazamiento

| Falla candidata | Senal observable | Duda |
|---|---|---|
| Movimiento a tirones | Jerk normalizado de cadera en la ventana | Umbral desconocido; depende del bloque |
| Trayectoria de mano insegura | Correcciones de la mano antes de fijar | Se confunde con exploracion deliberada |
| Cuerpo abierto (barn door) | Rotacion del tronco fuera del plano | En 2D la rotacion se estima mal |

## Restricciones de ingenieria que la taxonomia tiene que respetar

1. **Observable con pose 2D en el navegador.** MediaPipe PoseLandmarker sobre
   WASM/WebGPU, en Web Worker. Si una falla solo se ve con dos camaras o con IMU,
   no entra en la V1 del diagnostico.
2. **Validable contra el resultado.** Cada tipo tiene que poder contrastarse:
   ¿aparece mas en los intentos que se cayeron que en los que encadenaron? Sin
   eso es una metrica bonita mas.
3. **Comparable sobre el mismo bloque.** El diagnostico gana sentido comparando
   varios escaladores en el mismo problema, que es la mecanica del entrenador.
4. **El video no sale del dispositivo** (decision #6).

## Preguntas abiertas para CR

1. ¿Las tres fases (estabilizacion, preparacion, desplazamiento) son la
   descomposicion util para diagnosticar, o prefieres otra granularidad?
2. De la tabla de arriba, ¿cuales fallas son reales y cuales me invente? ¿Cuales
   faltan que un entrenador sí nombra?
3. ¿Que se puede diagnosticar honestamente **desde una sola camara de telefono**,
   que es lo que va a haber en un gimnasio?
4. ¿El jerk de cadera sobrevive a pose 2D, o hay que buscar otro proxy de
   fluidez?
5. ¿Vale la pena separar falla *tecnica* de falla *fisica* (no llego por fuerza),
   o el diagnostico solo debe hablar de lo que se puede corregir con tecnica?

## Fuentes

- Ciclo de tres fases y sistematizacion de terminologia: *Biomechanical
  Principles and Techniques—A Systematization for Sport Climbing*, J. Funct.
  Morphol. Kinesiol., 2026. https://doi.org/10.3390/jfmk11010103
- Fluidez y jerk de cadera: Seifert, Orth, Davids et al., *Climbing Skill and
  Complexity of Climbing Wall Design: Assessment of Jerk as a Novel Indicator of
  Performance Fluency*. http://shura.shu.ac.uk/8793/10/Davids-ClimbingSkillComplexity(AM).pdf
- Regulacion espacio-temporal y acciones discretas:
  https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5635808/
- Tiempo-movimiento en boulder de competencia: *A Time Motion Analysis of
  Bouldering Style Competitive Rock Climbing*.
- Analisis por video con pose markerless: *Climbing Technique Evaluation by Means
  of Skeleton Video Stream Analysis*, Sensors 23(19), 8216.
  https://www.mdpi.com/1424-8220/23/19/8216
- Competencia con diagnostico por video: BetterClimber
  (https://cheles.github.io/Better-policies/betterclimber/), Belay.ai
  (https://belay.ai/), Climbalyzer (https://climbalyzer.com/)
