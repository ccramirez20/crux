# Tesis — crux

Una competencia deportiva en Colombia se administra con WhatsApp, un formulario
de Google y una persona gritando puntajes el dia del evento — el gimnasio y el
evento federado por igual. Se entra por escalada porque ahi hay conocimiento de
dominio real y credibilidad inmediata; se entra por el gimnasio y la liga local
porque ahi no hace falta el permiso de nadie, pero el destino es el evento
oficial: la FCED es el cliente que valida todo lo demas. El mismo motor de
competencias sirve despues a cualquier deporte con formato de liga o torneo.

## Modelo de negocio

| Producto | Precio | Comprador |
|---|---|---|
| Competencia (organizador) | USD 50-200 por evento, o comision sobre inscripcion | Gimnasio, club, federacion |
| Entrenador (diagnostico) | USD 15-25/mes | Entrenador individual |
| Escalador (diagnostico) | Gratis, siempre | Escalador |
| Muro casero | Freemium, USD 4-8/mes | Escalador con muro propio |

Para llegar a USD 2.000/mes: con solo competencias harian falta 10-15 eventos
grandes al mes, poco realista al inicio. Con entrenadores suscritos, 80-100 a
USD 20-25/mes es la meta alcanzable. Las competencias son el canal para
conseguirlos, no el motor de ingreso final.

Se regala: competencias de menos de 30 participantes, y el diagnostico
individual siempre. Se cobra solo la cuenta de entrenador.

## Como se llega a la gente

Organismo rector: Federacion Colombiana de Escalada Deportiva (FCED),
constituida por clubes y no por ligas departamentales. Organiza la Copa Colombia
en bloque, dificultad y velocidad. Si la FCED usa la plataforma en un evento
oficial, cada club del pais la ve.

Gimnasios para contactar como piloto: Zona de Bloque y Gran Pared (Bogota),
RocHouse (Medellin), Boulder House (Bucaramanga), ROCAFE (Pereira).

Canal: un solo gimnasio, una sola competencia real, gratis, a cambio de usar los
resultados como caso de estudio publico. El siguiente cliente llega porque vio la
tabla de resultados en vivo del anterior.

## Competencia y diferencial

Investigado el 2026-08-11. La conclusion incomoda primero: **en la etapa 1 no hay
diferencial tecnico defendible**. El terreno esta lleno.

| Herramienta | Que es | Precio |
|---|---|---|
| Vertical-Life | Socio tecnologico oficial de la IFSC desde 2020; sistema federativo + "Smart Scorecard" para gimnasios | ~USD 1.080/ano + USD 500 de instalacion |
| TopLogger | Gestion de gimnasio + competencias multi-sede, multi-ronda, jurado | Gratis <35 usuarios, USD 89,95/mes arriba |
| Griptonite | Plataforma de gimnasio + eventos: auto-scoring, juzgado o hibrido, tablas en vivo | GBP 65/mes el plan Advanced |
| ClimbAlong (S.C.O.R.E.) | Solo competencias, por evento | EUR 99/competencia |
| Stokt Pro | App de muro/tablero; las competencias salen de las listas del gimnasio | Por muro y por reset |

Y detras: CRIMP, JudgeMate, SteepScores, ClimbBuddy, LiveClimbComp, 5.Score.

### Tres supuestos nuestros que no son ventaja

- **Offline-first.** CRIMP alterna online/offline explicitamente para wifi malo.
  La decision #3 es table stakes.
- **Scoring intercambiable.** Griptonite ya trae un esquema *Custom*. La decision
  #2 nos ahorra forkear por cliente: ventaja de costo interno, no algo que el
  gimnasio note.
- **El video no sale del dispositivo.** BetterClimber ya corre 33 landmarks de
  pose en el aparato sin subir nada. La decision #6 sigue siendo correcta por
  costo y privacidad, pero no distingue.

### Lo unico vacio del mercado

Ninguna esta en espanol ni tiene presencia en Latinoamerica, y todas cobran en
divisa dura: USD 90/mes son ~COP 380.000/mes para un gimnasio que corre tres
eventos al ano.

### Posicionamiento en dos capas

**1. Cuna de entrada: en espanol y en pesos, para Colombia y Latinoamerica.** Es
lo que hace que nos elijan ahora. Es ventaja comercial y se erosiona si TopLogger
traduce y cobra en pesos; por eso hay una segunda capa.

**2. Foso de fondo: diagnostico comparado sobre el mismo bloque, con taxonomia
propia de base cientifica.**

### Que aportan de verdad los datos de competencia

Sin venderse humo, en tres niveles:

1. **Como etiquetas para entrenar el diagnostico: no sirven.** "El intento
   fallo" no dice por que fallo. Tipificar exige que alguien marque el tipo —el
   entrenador—, no el marcador.
2. **Como validacion: si, pero modesto.** Permiten comprobar si una regla tiene
   senal: aparece "extension tardia" en los intentos caidos y no en los
   encadenados? Es conjunto de prueba, no de entrenamiento.
3. **Como calibracion de dificultad: si**, y ya se calcula por bloque.

Eso solo no alcanza para competir afuera: volumen de video le gana a volumen de
resultados. El papel real de la competencia es **canal de adquisicion**, mas
calibracion y validacion. No es el foso.

### El foso: el bloque compartido, orquestado por el entrenador

En competencia los bloques se montan para el evento y se desarman. No hay
acumulacion. El pareo sobre el mismo bloque sale del **entrenamiento**, y no como
subproducto pasivo sino como algo que el entrenador provoca: monta un bloque,
pone a sus cinco alumnos a intentarlo cinco veces cada uno, se graba todo, se
procesa en el dispositivo y el analisis sale **comparado** — que hicieron
distinto en el movimiento 4 los que lo hicieron frente a los que se cayeron.

Es alcanzable porque **no necesita datos acumulados ni efecto de red**: un
entrenador y una sesion ya producen la comparacion. Vale desde el cliente numero
uno, que es justamente el que paga.

No lo copian: BetterClimber analiza un clip a la vez y no sabe que dos videos son
del mismo bloque; TopLogger y Griptonite saben cual es el bloque y no diagnostican.

### La base cientifica es parte del foso

Las apps de afuera tienen ingenieros sacando metricas de pose —estabilidad,
tension, cadera, centro de gravedad— porque no saben *que mirar*. Una taxonomia
de fallas por fase de movimiento derivada de literatura es lo que convierte
metricas en diagnostico, y no la copia un equipo sin ese conocimiento por mas
datos que tenga. El trabajo de revision de literatura + taxonomia se hace al
cierre de la V1 de competencias.

## Riesgo principal

Comunidad pequena y con baja disposicion a pagar por software individual. El
ingreso real depende de que paguen los organizadores, no los escaladores.

Y uno nuevo, del analisis de competencia: **el foso no existe hasta que exista la
etapa 2.** Hoy la ventaja es la capa comercial —espanol, pesos, region—, que es
la que se erosiona. Si la etapa 2 no llega, quedamos compitiendo de frente con
cinco herramientas maduras en un terreno donde no tenemos nada que ellas no
tengan.

## Pendiente antes de escribir codigo

- [ ] Conversacion con un gimnasio (Zona de Bloque o Gran Pared): organizarian
      una competencia con la plataforma como piloto gratuito?
