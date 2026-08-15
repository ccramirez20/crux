'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { SCORE_TERM, flashCount } from '@/lib/labels';
import { brandWordClass } from '@/lib/ui';
import type { LeaderboardRound, LeaderboardRow } from '@/lib/leaderboard';

/**
 * Señalar a alguien la resalta en las tres piezas a la vez; el estado vive en la
 * pantalla. En el teléfono no hay hover: tocar fija a la competidora (`onSelect`)
 * y el detalle se abre en su fila de la tabla, en un espacio aparte, sin taparle
 * la gráfica encima.
 */
export interface HoverProps {
  hovered: string | null;
  onHover: (registrationId: string | null) => void;
  onSelect: (registrationId: string) => void;
}

/**
 * Resaltar al pasar el cursor, y **solo** con cursor.
 *
 * En un teléfono el toque dispara `pointerenter` igual que un ratón, pero
 * después no llega ningún `pointerleave`: el dedo se levanta y el resaltado se
 * queda pegado a esa competidora, sin forma de quitarlo. Filtrando por
 * `pointerType` el toque queda enteramente en manos de `onClick`, que sí
 * alterna. Es el mismo motivo por el que esto no puede ser `onMouseEnter`:
 * `MouseEvent` no dice de dónde vino el evento.
 */
export function hoverHandlers(registrationId: string, onHover: HoverProps['onHover']) {
  return {
    onPointerEnter: (event: React.PointerEvent) => {
      if (event.pointerType === 'mouse') {
        onHover(registrationId);
      }
    },
    onPointerLeave: (event: React.PointerEvent) => {
      if (event.pointerType === 'mouse') {
        onHover(null);
      }
    },
  };
}

// Podium metals. Measured as a triple against the card surface rather than
// picked by eye: ΔE 17.6 in normal vision and 16.0 under protanopia across
// every pair, not just neighbours. Silver has to be mid-lightness steel — a
// bright silver also passes the metric but disappears on a projector.
const GOLD = '#E3A83B';
const SILVER = '#8FA3AE';
const BRONZE = '#7E4F2C';
// Everyone off the podium shares one neutral, so the three medals are the only
// thing colour is saying.
const MUTED = '#7A7266';
const PINE = '#2F4A3E';
const RULE = '#DAD2BC';
const LANE = '#EFEBDD';
const INK = '#241F19';
// Cards are warm bone, not #FFFFFF: an under-stroke has to match the card it
// sits on or it draws a white scar across the chart.
const SURFACE = '#FBF8F0';

function podiumColor(rank: number): string {
  return rank === 1 ? GOLD : rank === 2 ? SILVER : rank === 3 ? BRONZE : MUTED;
}

// El aire de la tarjeta cede en el teléfono y solo ahí: 28 px por lado se comen
// 56 de los 358 que quedan a 390, y eso sale del ancho de la gráfica, que es lo
// único que esta pantalla tiene que dar. De `sm` para arriba nada cambia.
const cardClass = 'rounded-2xl border border-cardborder bg-card p-4 sm:p-7';
const eyebrow = 'text-[11px] font-semibold uppercase tracking-[0.18em] text-muted';

function Panel({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <figure className={`${cardClass} m-0 flex flex-col`}>
      {/* El título tiene que ganarle al contenido, no competir con él: a
          tamaño de subtítulo se perdía entre las barras y las líneas. */}
      <figcaption className="mb-5 sm:mb-7">
        <h2 className="font-display text-2xl font-bold leading-tight tracking-tight text-ink sm:text-[1.75rem]">
          {title}
        </h2>
        <p className="mt-1.5 text-[15px] text-muted sm:text-base">{hint}</p>
      </figcaption>
      {children}
    </figure>
  );
}

/* ------------------------------------------------------------------ tiles */

function StatTile({
  label,
  what,
  value,
  detail,
  dense = false,
}: {
  label: string;
  what: string;
  value: string;
  detail: string;
  /** En proyección la tarjeta comparte pantalla con la tabla y una gráfica, y
   *  no puede gastar 190 px de alto. Es la misma tarjeta, más apretada. */
  dense?: boolean;
}) {
  return (
    <div className={`${cardClass} flex flex-col ${dense ? 'gap-1 !p-4' : 'gap-2 py-6'}`}>
      <span className={eyebrow}>{label}</span>
      {/* The tile says what it is measuring before it says the number. A big
          figure with only a two-word label makes the reader guess the unit. */}
      <span className={dense ? 'text-xs leading-snug text-muted' : 'text-sm text-muted'}>{what}</span>
      {/* Los tres del mismo color: son tres hechos del mismo rango, y teñir solo
          uno se leía como que ese importaba más. Pine y no oro — el oro contra
          el hueso de la tarjeta queda en 1.8:1 y se pierde; este da 8:1 y sigue
          siendo acento. */}
      <span
        className={`mt-1 font-display font-bold leading-none tracking-tight tabular-nums ${
          dense ? 'text-[2.25rem]' : 'text-[2.75rem] sm:text-[3.25rem]'
        }`}
        style={{ color: PINE }}
      >
        {value}
      </span>
      <span className={dense ? 'text-xs leading-snug text-muted' : 'text-[15px] text-muted sm:text-base'}>
        {detail}
      </span>
    </div>
  );
}

export function Headline({
  round,
  unit,
  isHeight,
  dense = false,
}: {
  round: LeaderboardRound;
  unit: string;
  isHeight: boolean;
  dense?: boolean;
}) {
  const stats = round.problemStats;
  const crux = [...stats].sort((a, b) => a.tops - b.tops)[0];
  const problemName = (id: string) => round.problems.find((p) => p.id === id)?.name;

  const totalTops = stats.reduce((sum, s) => sum + s.tops, 0);
  const totalFlashes = stats.reduce((sum, s) => sum + s.flashes, 0);

  const first = round.timeline[0];
  const last = round.timeline.at(-1);
  const bestClimb = round.rows
    .map((row) => ({
      name: row.athleteName,
      delta: (first?.ranks[row.registrationId] ?? 0) - (last?.ranks[row.registrationId] ?? 0),
    }))
    .sort((a, b) => b.delta - a.delta)[0];

  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 ${dense ? 'gap-3' : 'gap-6'}`}>
      {crux && (
        <StatTile
          dense={dense}
          label={`El ${unit} más duro`}
          what={`Cuál fue el ${unit} que menos gente pudo hacer`}
          value={`${unit.slice(0, 1).toUpperCase()}${crux.number}`}
          detail={`${problemName(crux.problemId) ?? 'Sin nombre'} · le hicieron top ${crux.tops} de ${crux.field}`}
        />
      )}
      {!isHeight && (
        <StatTile
          dense={dense}
          label="Flashes de la ronda"
          what="De todos los tops, cuántos salieron al primer intento"
          value={totalTops > 0 ? `${Math.round((totalFlashes / totalTops) * 100)}%` : '—'}
          detail={`${flashCount(totalFlashes)} de ${totalTops} tops en la ronda`}
        />
      )}
      {bestClimb && bestClimb.delta > 0 && (
        <StatTile
          dense={dense}
          label="Mayor ascenso en la tabla"
          what={`Quién más puestos ascendió desde el primer ${unit}`}
          value={`+${bestClimb.delta}`}
          detail={`${bestClimb.name} subió ${bestClimb.delta} puestos en la tabla de posiciones`}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- bump chart */

/**
 * Held, then moved. Each segment leaves a node horizontally and arrives
 * horizontally, so the curve never invents a rank between two points — it
 * shows a placing being kept and then changing, which is what happened.
 */
function bumpPath(points: { x: number; y: number }[]): string {
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1]!;
    const to = points[index]!;
    const mid = (from.x + to.x) / 2;
    d += ` C ${mid} ${from.y}, ${mid} ${to.y}, ${to.x} ${to.y}`;
  }
  return d;
}

/** Nudges labels apart without moving the line they belong to. */
function declutter(values: number[], minGap: number): number[] {
  const order = values.map((y, index) => ({ y, index })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < order.length; i++) {
    if (order[i]!.y - order[i - 1]!.y < minGap) {
      order[i]!.y = order[i - 1]!.y + minGap;
    }
  }
  const out = [...values];
  for (const item of order) {
    out[item.index] = item.y;
  }
  return out;
}

/**
 * La misma gráfica, para un teléfono.
 *
 * Lo que no cabe a 302 px de tarjeta es el **nombre**: medido, uno largo ocupa
 * 369 px él solo a tamaño de proyector, y aun a 12 px se lleva la mitad del
 * ancho útil. Así que en el teléfono los dos extremos son el puesto —que es lo
 * que la persona viene a buscar, "voy cuarta"— y el nombre aparece cuando tocas
 * una línea. Tocar ya resaltaba a esa competidora en la tabla y en las demás
 * gráficas; esto solo le pone nombre a lo que ya estaba pasando.
 *
 * No se encoge la versión grande ni se recorta el campo: es la misma gráfica con
 * otra geometría, y la de la sala queda intacta.
 */
function bumpLayout(compact: boolean, fieldSize: number) {
  if (compact) {
    // El viewBox va casi 1:1 con los píxeles reales de la tarjeta (320 contra
    // ~302): un SVG se escala entero, así que un viewBox ancho no aprieta las
    // líneas, aprieta las letras. A esta escala un 13 del viewBox se ve como 12.
    const lane = Math.max(19, Math.min(30, Math.round(560 / fieldSize)));
    return {
      lane,
      width: 320,
      padTop: 26,
      padBottom: 44,
      plotLeft: 34,
      plotRight: 284,
      startRankX: 26,
      endRankX: 294,
      rankSize: 13,
      tickSize: 12,
      gap: Math.min(15, lane - 2),
      laneInset: 10,
      // Los trazos y los nodos son medidas absolutas del viewBox, y este viewBox
      // es cuatro veces más angosto: un halo de 10 que en la sala apenas separa
      // dos líneas, aquí las funde. Todo el grosor baja parejo.
      weight: 0.65,
    };
  }
  // El carril se estrecha con el campo en vez de estirar la gráfica hacia
  // abajo. Es la pantalla que se proyecta: veinticinco competidoras tienen que
  // caber en el mismo alto que catorce, o la mitad de la categoría queda fuera
  // del proyector.
  const lane = Math.max(22, Math.min(38, Math.round(620 / fieldSize)));
  return {
    lane,
    width: 1250,
    padTop: 78,
    padBottom: 82,
    // El área de dibujo se come el aire de los dos costados: la etiqueta más
    // larga mide 168 px y arrancaba en x=88, y del otro lado sobraba otro tanto
    // antes del chip. La gráfica es el foco de esta pantalla, así que el ancho
    // que sobraba es suyo y no de los márgenes.
    plotLeft: 224,
    plotRight: 880,
    startRankX: 190,
    endRankX: 956,
    rankSize: lane >= 32 ? 18 : 15,
    tickSize: 15,
    gap: Math.min(26, lane - 2),
    laneInset: 22,
    weight: 1,
  };
}

export function BumpChart({
  round,
  unit,
  plural,
  article,
  compact = false,
  className,
  hovered,
  onHover,
  onSelect,
}: {
  round: LeaderboardRound;
  unit: string;
  plural: string;
  article: string;
  compact?: boolean;
  className?: string;
} & HoverProps) {
  // Cuánto mide cada nombre ya dibujado. Un contra-trazo alcanzaba para tapar la
  // guía, pero seguía pasando por debajo de las letras; medir el texto es la
  // única forma de que la guía empiece donde el nombre termina, y de paso sirve
  // para cualquier largo de nombre sin adivinar.
  const nameRefs = useRef(new Map<string, SVGTextElement>());
  const [nameWidths, setNameWidths] = useState<Record<string, number>>({});
  useEffect(() => {
    const measured: Record<string, number> = {};
    for (const [id, element] of nameRefs.current) {
      measured[id] = element.getComputedTextLength();
    }
    // Sin comparar, cada medición dispararía otro render que vuelve a medir.
    setNameWidths((previous) => {
      const ids = Object.keys(measured);
      const same =
        ids.length === Object.keys(previous).length && ids.every((id) => previous[id] === measured[id]);
      return same ? previous : measured;
    });
  });

  const points = round.timeline;
  // Todas las competidoras, no las ocho primeras. Recortar la lista rompía dos
  // cosas: no se podía seguir a alguien de la mitad de la tabla, y señalarla en
  // otra gráfica no encendía nada aquí. La legibilidad la sostienen la etiqueta
  // directa y el carril, no el recorte.
  const shown = round.rows;
  if (points.length < 2 || shown.length < 2) {
    return null;
  }

  const tick = (index: number) => `${unit.slice(0, 1).toUpperCase()}${points[index]!.problemNumber}`;
  const rankAt = (row: LeaderboardRow, point: (typeof points)[number]) =>
    point.ranks[row.registrationId] ?? shown.length;
  const maxRank = Math.max(...shown.flatMap((row) => points.map((p) => rankAt(row, p))));

  const {
    lane,
    width,
    padTop,
    padBottom,
    plotLeft,
    plotRight,
    startRankX,
    endRankX,
    rankSize,
    tickSize,
    gap,
    laneInset,
    weight,
  } = bumpLayout(compact, shown.length);
  const roomy = lane >= 32;
  const endNameX = plotRight + 88;
  // El centro de cada columna de etiquetas, medido sobre el bloque de texto que
  // ocupan y no sobre el ancho disponible: el título tiene que quedar encima de
  // los nombres, no encima del aire que sobra al lado.
  const startLabelMid = plotLeft - 118;
  const endLabelMid = plotRight + 150;
  const deltaX = 1240;
  const height = padTop + (maxRank - 1) * lane + padBottom;
  const laneTop = padTop - lane / 2;
  const laneBottom = padTop + (maxRank - 1) * lane + lane / 2;

  const x = (index: number) => plotLeft + (index * (plotRight - plotLeft)) / (points.length - 1);
  const y = (rank: number) => padTop + (rank - 1) * lane;

  const endYs = declutter(shown.map((row) => y(rankAt(row, points.at(-1)!))), gap);
  const startYs = declutter(shown.map((row) => y(rankAt(row, points[0]!))), gap);

  const axis = { fontSize: 12, fill: MUTED, fontWeight: 600, letterSpacing: 1.1 } as const;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      // El `min-w` obliga a desplazarse antes que a encoger, que es lo correcto
      // dentro de una página. En proyección no hay dónde desplazarse: la
      // pantalla es la que es, así que ahí se pasa `w-full` a secas y el SVG se
      // escala solo.
      className={className ?? (compact ? 'w-full' : 'w-full min-w-[900px]')}
      role="img"
      aria-label={`Puesto de cada competidor al cierre de cada ${unit}`}
    >
      {/* Los dos extremos se titulan igual —"puesto tras el bloque N"— porque
          son lo mismo medido en dos momentos; "posición final" mentiría
          mientras todavía queden bloques por escalar. El número sale del primer
          y del último punto, así que una ronda de siete dice "bloque 7".
          En el teléfono estos títulos viven en HTML sobre la gráfica: aquí no
          hay dónde ponerlos sin robarle ancho a las líneas. */}
      {!compact && (
        <>
          <text x={startLabelMid} y={30} textAnchor="middle" {...axis}>
            PUESTO TRAS
          </text>
          <text x={startLabelMid} y={48} textAnchor="middle" {...axis}>
            {article.toUpperCase()} {unit.toUpperCase()} {points[0]!.problemNumber}
          </text>
          <text x={endLabelMid} y={30} textAnchor="middle" {...axis}>
            PUESTO TRAS
          </text>
          <text x={endLabelMid} y={48} textAnchor="middle" {...axis}>
            {article.toUpperCase()} {unit.toUpperCase()} {points.at(-1)!.problemNumber}
          </text>
          <text x={deltaX} y={30} textAnchor="end" {...axis}>
            CAMBIO
          </text>
        </>
      )}

      {/* La banda empieza y termina con el área de dibujo. Extenderla hasta la
          columna de cambio amarraba la fila con su chip, pero sacaba la piel de
          la gráfica fuera de la gráfica; de eso se encarga ahora la guía. */}
      {Array.from({ length: maxRank }, (_, index) => index).map((row) =>
        row % 2 === 0 ? (
          <rect
            key={row}
            x={plotLeft - laneInset}
            y={y(row + 1) - lane / 2}
            width={plotRight - plotLeft + laneInset * 2}
            height={lane}
            fill={LANE}
            opacity={0.7}
          />
        ) : null,
      )}

      {points.map((point, index) => (
        <g key={point.problemNumber}>
          <line x1={x(index)} y1={laneTop} x2={x(index)} y2={laneBottom} stroke={RULE} strokeWidth={1} opacity={0.8} />
          <text x={x(index)} y={laneBottom + 24} textAnchor="middle" fontSize={tickSize} fontWeight={700} fill={INK}>
            {tick(index)}
          </text>
        </g>
      ))}
      {/* Una palabra: qué son esas marcas. Los intentos acumulados vivían aquí
          abajo y eran dos filas de texto para un dato que nadie venía a buscar;
          que cada marca sea el cierre de su bloque ya lo dice el subtítulo. */}
      {!compact && (
        <text x={(plotLeft + plotRight) / 2} y={laneBottom + 48} textAnchor="middle" {...axis}>
          {plural.toUpperCase()}
        </text>
      )}

      {shown.map((row, index) => {
        const color = podiumColor(row.result.rank);
        const podium = row.result.rank <= 3;
        const dimmed = hovered !== null && hovered !== row.registrationId;
        const focused = hovered === row.registrationId;
        const path = bumpPath(points.map((point, i) => ({ x: x(i), y: y(rankAt(row, point)) })));
        const startRank = rankAt(row, points[0]!);
        const endRank = rankAt(row, points.at(-1)!);
        const delta = startRank - endRank;
        const nameWidth = nameWidths[row.registrationId];

        return (
          <g
            key={row.registrationId}
            {...hoverHandlers(row.registrationId, onHover)}
            onClick={() => onSelect(row.registrationId)}
            // 0.45, no 0.2: resaltar a una no puede borrar a las demás. El resto
            // de la carrera es justamente el contexto que hace que resaltar
            // signifique algo.
            opacity={dimmed ? 0.45 : 1}
            style={{ transition: 'opacity 200ms ease', cursor: 'pointer' }}
          >
            {/* Un trazo grueso invisible: en el teléfono nadie le pega a una
                línea de 2.5 px con el dedo. */}
            <path d={path} fill="none" stroke="transparent" strokeWidth={22} />
            {/* Every line gets a surface-coloured under-stroke, not just the
                leaders: at a crossing one line has to visibly pass over the
                other or the two dissolve into an X nobody can follow. */}
            <path
              d={path}
              fill="none"
              stroke={SURFACE}
              strokeWidth={(podium || focused ? 10 : 7) * weight}
              strokeLinecap="round"
            />
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth={(podium || focused ? 4.5 : 2.5) * weight}
              strokeLinecap="round"
              opacity={podium || focused ? 1 : 0.55}
            />
            <circle
              cx={x(points.length - 1)}
              cy={y(endRank)}
              r={(podium ? 8 : 5) * weight}
              fill={color}
              stroke={SURFACE}
              strokeWidth={2.5 * weight}
            />

            {/* La guía amarra la etiqueta con su línea. Las etiquetas se
                separan entre sí para poder leerse, así que no siempre caen
                sobre su carril, y sin la guía no hay forma de saber cuál nombre
                es cuál línea. Punteada y tenue: es una ayuda de lectura, no un
                trazo más compitiendo con las curvas. */}
            <line
              x1={plotLeft - laneInset}
              y1={startYs[index]!}
              x2={plotLeft}
              y2={y(startRank)}
              stroke={podium || focused ? color : RULE}
              strokeWidth={1.5}
              strokeDasharray="2 3"
            />

            {/* En el teléfono los extremos son solo el puesto, y el nombre sale
                al tocar la línea. Es la decisión que hace que quepa: el nombre
                más largo pesa la mitad del ancho útil de la tarjeta, y con él
                puesto de fijo no queda gráfica que mirar. */}
            {compact && (
              <>
                <text
                  x={startRankX}
                  y={startYs[index]! + 4}
                  textAnchor="end"
                  fontSize={rankSize}
                  fontWeight={700}
                  fill={focused ? INK : MUTED}
                  className="tabular-nums"
                >
                  {startRank}
                </text>
                <text
                  x={endRankX}
                  y={endYs[index]! + 4}
                  textAnchor="start"
                  fontSize={rankSize}
                  fontWeight={700}
                  fill={podium || focused ? INK : MUTED}
                  className="tabular-nums"
                >
                  {endRank}
                </text>
                {/* Sobre el nodo y alineado a la derecha, que es donde siempre
                    hay aire; el reborde del color de la tarjeta lo despega de
                    las líneas que le pasen por debajo. */}
                {focused && (
                  <text
                    x={plotRight}
                    y={y(endRank) - 10}
                    textAnchor="end"
                    fontSize={13}
                    fontWeight={700}
                    fill={INK}
                    stroke={SURFACE}
                    strokeWidth={4}
                    paintOrder="stroke"
                  >
                    {row.athleteName}
                  </text>
                )}
              </>
            )}

            {/* Del nombre a su chip, y solo para quien se movió: el chip está
                lejos y con dos vecinas quietas no había nada que dijera de quién
                era ese ▼12. Va del color de su propio chip, para que se lea como
                el rastro de ese chip y no como un renglón de tabla. Arranca en
                el final medido del nombre, así que no lo toca por largo que
                sea; hasta que la medida existe, no se dibuja. */}
            {!compact && delta !== 0 && nameWidth !== undefined && (
              <line
                x1={endNameX + nameWidth + 12}
                y1={endYs[index]!}
                x2={deltaX - 62}
                y2={endYs[index]!}
                stroke={delta > 0 ? PINE : BRONZE}
                strokeWidth={1.5}
                strokeDasharray="2 3"
                opacity={0.5}
              />
            )}

            {/* Mismo formato en los dos extremos: puesto en negrilla con punto,
                nombre en peso normal y separado. El número viaja pegado al
                nombre y no lo delega al carril — con seis empatadas en el puesto
                1 una etiqueta suelta frente al carril 4 se leía como cuarto
                puesto cuando iba primera. */}
            {!compact && (
              <>
                <text
                  x={plotLeft - 34}
                  y={startYs[index]! + 5}
                  textAnchor="end"
                  fontSize={roomy ? 16 : 13}
                  fontWeight={500}
                  fill={focused ? INK : MUTED}
                >
                  <tspan fontWeight={700} className="tabular-nums">
                    {startRank}.
                  </tspan>
                  <tspan dx={6}>{row.athleteName}</tspan>
                </text>
                {/* A la derecha el puesto va en su propia columna: pegado al
                    nombre, "12 Manuela" se leía como una sola cosa larga. Y
                    separado del área de dibujo, porque al ir alineado a la
                    derecha el de dos dígitos arrancaba encima del nodo de su
                    propia línea. */}
                <text
                  x={endRankX}
                  y={endYs[index]! + 5}
                  textAnchor="end"
                  fontSize={roomy ? 18 : 15}
                  fontWeight={700}
                  fill={podium ? INK : MUTED}
                  className="tabular-nums"
                >
                  {endRank}.
                </text>
                <text
                  ref={(element) => {
                    if (element) {
                      nameRefs.current.set(row.registrationId, element);
                    } else {
                      nameRefs.current.delete(row.registrationId);
                    }
                  }}
                  x={endNameX}
                  y={endYs[index]! + 5}
                  fontSize={roomy ? 18 : 15}
                  fontWeight={500}
                  fill={podium ? INK : MUTED}
                >
                  {row.athleteName}
                </text>
              </>
            )}

            {/* A filled chip, not a bare glyph. A 14px triangle in a flat colour
                vanishes from across a gym; a solid block with a light arrow on
                it survives the distance. */}
            {!compact && delta !== 0 && (
              <g>
                <rect x={deltaX - 54} y={endYs[index]! - 13} width={54} height={26} rx={6} fill={delta > 0 ? PINE : BRONZE} />
                <text x={deltaX - 27} y={endYs[index]! + 6} textAnchor="middle" fontSize={15} fontWeight={700} fill="#FFFFFF">
                  {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ---------------------------------------------------------------- the wall */

/** Qué tramo de qué barra está señalado: el color de una barra no dice qué mide. */
interface WallHover {
  problemId: string;
  kind: 'top' | 'zone' | 'none';
}

export function Wall({ round, unit, isHeight }: { round: LeaderboardRound; unit: string; isHeight: boolean }) {
  const [hover, setHover] = useState<WallHover | null>(null);
  // Menos tops es más duro, y con los mismos tops manda el flash: once tops de
  // los cuales seis salieron al primer intento no es el mismo bloque que once
  // tops peleados. Sin este desempate el orden lo decidía el número del bloque,
  // que no mide nada.
  const stats = [...round.problemStats].sort(
    (a, b) => a.tops - b.tops || a.flashes - b.flashes || a.zones - b.zones,
  );
  if (stats.length === 0) {
    return null;
  }
  const problemName = (id: string) => round.problems.find((p) => p.id === id)?.name;

  const hovered = stats.find((s) => s.problemId === hover?.problemId);
  // El cero va en plural en español ("0 hicieron top"); solo el uno cambia.
  const says = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  const zone = SCORE_TERM.zone.toLowerCase();
  const reading =
    hovered && hover
      ? {
          top: says(hovered.tops, 'hizo top', 'hicieron top'),
          zone: says(hovered.zones, `llegó a la ${zone} sin top`, `llegaron a la ${zone} sin top`),
          none: says(
            hovered.field - hovered.tops - hovered.zones,
            `no llegó a la ${zone}`,
            `no llegaron a la ${zone}`,
          ),
        }[hover.kind]
      : null;

  return (
    <div>
      {/* Los mismos encabezados que la otra gráfica: "4/14" y "1 flash" sueltos
          obligaban a adivinar cuál número era cuál. La lectura del tramo
          señalado sale en esta misma fila, que ya ocupa este alto: un rótulo
          flotante movería las barras justo cuando se están mirando. */}
      {/* h-7: la fila reserva el alto del texto aunque esté vacía. Sin eso, la
          lectura empuja las barras hacia abajo justo cuando les estás apuntando. */}
      {/* Las columnas fijas ceden en el teléfono en vez de sacar la página de
          cuadro: sumaban 380 px contra los 316 que quedan dentro de la tarjeta
          a 390 px de ancho. Aquí no hace falta desplazar como en la gráfica de
          puestos —son tres cifras y una barra, no un eje de quince nombres—,
          así que se encogen y todo sigue visible sin tener que arrastrar. */}
      {/* En el teléfono la lectura va en su propio renglón. Compartiendo fila
          con los tres títulos le quedaban 90 px y salía cortada con puntos
          suspensivos justo cuando la estás leyendo — que es lo único que ese
          texto hace. `min-h` reserva el alto aunque esté vacía, para que tocar
          un tramo no empuje las barras hacia abajo. */}
      <p className="mb-2 min-h-6 text-[15px] font-semibold text-ink sm:hidden">{reading}</p>
      <div className="mb-3 flex h-7 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted sm:gap-5">
        <span className="w-20 shrink-0 sm:w-36" />
        <span className="hidden flex-1 truncate text-base font-semibold normal-case tracking-normal text-ink sm:block">
          {reading}
        </span>
        <span className="sm:hidden flex-1" />
        <span className="w-16 shrink-0 text-center sm:w-24">{SCORE_TERM.top}</span>
        {!isHeight && <span className="w-12 shrink-0 text-center sm:w-20">{SCORE_TERM.flash}</span>}
      </div>
      <ul className="flex flex-col gap-5">
        {stats.map((stat, index) => (
          <li key={stat.problemId} className="flex items-center gap-2 sm:gap-5">
            <span className="w-20 shrink-0 sm:w-36">
              <span className="block font-display text-xl font-bold leading-tight">
                {unit.slice(0, 1).toUpperCase()}
                {stat.number}
                {/* El bloque más duro se llama crux, y la plataforma se llama
                    igual por eso mismo. Va con la marca: es el único sitio
                    donde el nombre significa las dos cosas a la vez. */}
                {index === 0 && (
                  <span className={`ml-2 align-middle text-[11px] uppercase ${brandWordClass}`}>crux</span>
                )}
              </span>
              <span className="block truncate text-sm text-muted">{problemName(stat.problemId) ?? '—'}</span>
            </span>

            {/* Cada tramo dice qué significa su color al pasarle el cursor: se
                queda encendido y los otros dos de su barra se apagan, y el
                texto sale arriba. Un color solo no dice qué mide. */}
            <span className="relative flex h-9 flex-1 overflow-hidden rounded-lg" style={{ background: LANE }}>
              {(
                [
                  { kind: 'top', width: (stat.tops / stat.field) * 100, background: GOLD },
                  { kind: 'zone', width: (stat.zones / stat.field) * 100, background: PINE },
                  { kind: 'none', width: null, background: 'transparent' },
                ] as const
              ).map((segment) => (
                <Fragment key={segment.kind}>
                  {segment.kind === 'zone' && stat.zones > 0 && (
                    <span className="h-full" style={{ width: 2, background: SURFACE }} />
                  )}
                  <span
                    className="h-full transition-opacity duration-150"
                    style={{
                      width: segment.width === null ? undefined : `${segment.width}%`,
                      flex: segment.width === null ? '1 1 0%' : undefined,
                      background: segment.background,
                      opacity:
                        hover !== null && hover.problemId === stat.problemId && hover.kind !== segment.kind ? 0.35 : 1,
                    }}
                    // Mismo problema que en las otras dos gráficas: en el
                    // teléfono el toque enciende el tramo y nunca llega el
                    // evento que lo apaga. Con cursor se enciende al pasar por
                    // encima; con el dedo, el toque alterna.
                    onPointerEnter={(event) => {
                      if (event.pointerType === 'mouse') {
                        setHover({ problemId: stat.problemId, kind: segment.kind });
                      }
                    }}
                    onPointerLeave={(event) => {
                      if (event.pointerType === 'mouse') {
                        setHover(null);
                      }
                    }}
                    onClick={() =>
                      setHover((current) =>
                        current?.problemId === stat.problemId && current.kind === segment.kind
                          ? null
                          : { problemId: stat.problemId, kind: segment.kind },
                      )
                    }
                  />
                </Fragment>
              ))}
            </span>

            <span className="w-16 shrink-0 text-center sm:w-24">
              <span className="block font-display text-xl font-bold leading-none tabular-nums sm:text-2xl">
                {stat.tops}
                <span className="text-base font-semibold text-muted sm:text-lg">/{stat.field}</span>
              </span>
            </span>
            {!isHeight && (
              <span className="w-12 shrink-0 text-center font-display text-xl font-bold leading-none tabular-nums sm:w-20 sm:text-2xl">
                {stat.flashes}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------ attempts/top */

/**
 * How many goes each top cost. One axis, sorted, low is good — a scatter asked
 * the reader to decode two dimensions and a diagonal before it said anything.
 */
export function AttemptsPerTop({ round, hovered, onHover, onSelect }: { round: LeaderboardRound } & HoverProps) {
  const climbers = round.rows.flatMap((row) =>
    // Two tops minimum. Otherwise a single lucky flash scores 1.0 and outranks
    // someone who sent five, which is the exact opposite of the point.
    row.result.format === 'classic_tops_zones' && row.result.tops >= 2
      ? [{
          id: row.registrationId,
          name: row.athleteName,
          rank: row.result.rank,
          tops: row.result.tops,
          // Intentos de los bloques que sí topó. Un bloque que se le quedó no
          // entra al promedio: mediría otra cosa, cuánto peleó, no cuánto le
          // costó cada top.
          topAttempts: row.result.topAttempts,
          ratio: row.result.topAttempts / row.result.tops,
        }]
      : [],
  );
  if (climbers.length < 3) {
    return null;
  }

  const ranked = climbers.sort((a, b) => a.ratio - b.ratio).slice(0, 10);
  const worst = Math.max(...ranked.map((c) => c.ratio));

  return (
    <div>
      {/* Sin encabezados, el "5" de al lado no se leía como la cantidad de
          tops: cada número necesita su nombre encima, igual que en la tabla. */}
      {/* De `sm` para arriba se desplaza en vez de encogerse. Se probó
          estrechando las columnas y no sirve: "Promedio" y "Tops" chocan hasta
          leerse "PROMEDITOPS", y la barra queda en 48 px, donde todas se ven
          iguales y dejan de comparar nada — que es lo único que esta gráfica
          hace. El min-w le garantiza a la barra el ancho con el que sí se
          distinguen los promedios.

          En el teléfono no se estrecha ni se arrastra: el nombre se sube a su
          propio renglón y la barra se queda con el ancho entero de la tarjeta,
          que era justo lo que faltaba. */}
      {/* Centradas y no alineadas a la derecha: son dos columnas de dos
          caracteres bajo un título de ocho, y pegadas al borde derecho el
          número quedaba lejos de su propio rótulo y rozando el filo de la
          tarjeta. */}
      <div className="mb-3 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted sm:min-w-[33rem] sm:gap-4">
        <span className="hidden w-44 shrink-0 sm:block" />
        <span className="flex-1" />
        <span className="w-20 shrink-0 text-center">Promedio</span>
        <span className="w-12 shrink-0 text-center sm:w-16">Tops</span>
      </div>
      <ul className="flex flex-col gap-4">
        {ranked.map((climber) => (
          <li
            key={climber.id}
            {...hoverHandlers(climber.id, onHover)}
            onClick={() => onSelect(climber.id)}
            className={`flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 transition-opacity duration-200 sm:min-w-[33rem] sm:flex-nowrap sm:gap-x-4 ${
              hovered !== null && hovered !== climber.id ? 'opacity-60' : ''
            }`}
          >
            <span className="w-full shrink-0 truncate font-display text-lg font-semibold sm:w-44">
              {climber.name}
            </span>
            <span
              className="flex h-7 flex-1 overflow-hidden rounded-lg"
              style={{ background: LANE }}
              title={`${climber.name}: ${climber.topAttempts} intentos para ${climber.tops} tops`}
            >
              {/* Colour follows the competitor's standing, not their place in
                  this list, so the leader is the same gold in every chart. */}
              <span className="h-full rounded-lg" style={{ width: `${(climber.ratio / worst) * 100}%`, background: podiumColor(climber.rank) }} />
            </span>
            <span className="w-20 shrink-0 text-center font-display text-xl font-bold tabular-nums">
              {climber.ratio.toFixed(1)}
            </span>
            <span className="w-12 shrink-0 text-center font-display text-xl font-bold tabular-nums text-muted sm:w-16">
              {climber.tops}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------- assembly */

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-3.5 w-3.5 rounded-sm" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}

export function LeaderboardCharts({
  round,
  unit,
  hovered,
  onHover,
  onSelect,
}: {
  round: LeaderboardRound;
  unit: { singular: string; plural: string; article: string };
} & HoverProps) {
  if (round.timeline.length === 0) {
    return null;
  }
  const isHeight = round.rows[0]?.result.format === 'max_height';
  const hasAttemptsPerTop =
    round.rows.filter((r) => r.result.format === 'classic_tops_zones' && r.result.tops >= 2).length >= 3;

  return (
    <div className="flex flex-col gap-6">
      <Headline round={round} unit={unit.singular} isHeight={isHeight} />

      <Panel
        title={`Puesto ${unit.singular} a ${unit.singular}`}
        hint={`Una línea por competidor. Se actualiza al cierre de cada ${unit.singular}.`}
      >
        {/* Dos geometrías de la misma gráfica, y el navegador escoge por ancho.
            Antes esto se desplazaba a lo ancho en el teléfono: 900 px de
            gráfica dentro de una caja de 300 son tres pantallas de arrastre, y
            además le roba el gesto al scroll de la página. */}
        <div className="sm:hidden">
          {/* Los títulos de las dos columnas de puestos, en HTML: dentro del SVG
              no cabrían sin quitarle ancho a las líneas. */}
          {round.timeline.length > 1 && (
            <div className={`mb-2 flex items-center justify-between ${eyebrow}`}>
              <span>
                Tras {unit.article} {unit.singular} {round.timeline[0]!.problemNumber}
              </span>
              <span>
                Tras {unit.article} {unit.singular} {round.timeline.at(-1)!.problemNumber}
              </span>
            </div>
          )}
          <BumpChart
            round={round}
            unit={unit.singular}
            plural={unit.plural}
            article={unit.article}
            compact
            hovered={hovered}
            onHover={onHover}
            onSelect={onSelect}
          />
        </div>
        <div className="hidden overflow-x-auto sm:block">
          <BumpChart
            round={round}
            unit={unit.singular}
            plural={unit.plural}
            article={unit.article}
            hovered={hovered}
            onHover={onHover}
            onSelect={onSelect}
          />
        </div>
        {/* Esto se lee de afán y de pie. Tres frases, no un párrafo. */}
        <p className="mt-4 text-[15px] text-muted sm:text-base">
          Se lee de izquierda a derecha: arranca con el puesto tras el primer {unit.singular}. La escala
          vertical es cuántos compiten en la categoría.{' '}
          <span className="sm:hidden">
            Presiona una línea para ver el nombre del competidor al que corresponde; eso resalta su
            posición en la tabla y en las demás gráficas.
          </span>
          <span className="hidden sm:inline">
            Haz clic sobre un competidor y se resalta en la tabla y en las demás gráficas.
          </span>
        </p>
      </Panel>

      <div className={`grid grid-cols-1 gap-6 ${hasAttemptsPerTop ? 'xl:grid-cols-[3fr_2fr]' : ''}`}>
        <Panel
          title={`¿Qué tan duros estaban los ${unit.plural}?`}
          hint={`De los ${round.rows.length} de la categoría, cuántos hicieron top y cuántos se quedaron en zona. Del más duro al más fácil.`}
        >
          <div className="mb-5 flex flex-wrap items-center gap-5 text-sm text-muted">
            <Swatch color={GOLD} label={SCORE_TERM.top} />
            {!isHeight && <Swatch color={PINE} label={SCORE_TERM.zone} />}
          </div>
          <Wall round={round} unit={unit.singular} isHeight={isHeight} />
        </Panel>

        {hasAttemptsPerTop && (
          <Panel
            title="Cuántos intentos al top"
            hint={`Promedio de intentos por cada top logrado. Solo cuentan los ${unit.plural} en los que hizo top; entra quien tenga dos tops o más. Menos es mejor.`}
          >
            {/* El desplazamiento lateral arranca en `sm`: por debajo la fila se
                parte en dos renglones y no hay nada que arrastrar. */}
            <div className="sm:overflow-x-auto">
              <AttemptsPerTop round={round} hovered={hovered} onHover={onHover} onSelect={onSelect} />
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
