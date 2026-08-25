'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { hasAttemptsPerTop, topSummary } from '@/lib/attempts-per-top';
import { heightDistribution } from '@/lib/height-distribution';
import { SCORE_TERM, climberWord } from '@/lib/labels';
import { roundHighlights } from '@/lib/round-highlights';
import { shortName } from '@/lib/short-name';
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

function Headline({
  round,
  unit,
  isHeight,
  dense = false,
}: {
  round: LeaderboardRound;
  unit: { singular: string; plural: string; article: string };
  isHeight: boolean;
  dense?: boolean;
}) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 ${dense ? 'gap-3' : 'gap-6'}`}>
      {roundHighlights(round, unit.singular, isHeight, unit.article === 'la').map(({ key, ...item }) => (
        <StatTile key={key} dense={dense} {...item} />
      ))}
    </div>
  );
}

export { roundHighlights };

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
function bumpLayout(compact: boolean, fieldSize: number, laneOverride?: number) {
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
  //
  // `laneOverride` lo manda la pantalla de proyección, que sí sabe cuánto alto
  // tiene: dentro de una página la gráfica crece hacia abajo y el tope de 38
  // evita que se vuelva un rollo, pero en un panel de alto fijo ese mismo tope
  // deja media pantalla en blanco — sobre todo en una final de cuatro.
  const lane = laneOverride ?? Math.max(22, Math.min(38, Math.round(620 / fieldSize)));
  return {
    lane,
    width: 1250,
    padTop: 78,
    // El pie crece con el carril porque los rótulos del eje —B1, B2…— no cuelgan
    // del borde del viewBox sino de `laneBottom`, que es medio carril más abajo.
    // Con los 82 fijos de antes, un carril de más de 116 px empujaba B1…B4 y la
    // palabra BLOQUES fuera del viewBox y el SVG los recortaba sin avisar: la
    // gráfica de la pantalla proyectada quedaba en líneas sueltas sobre un eje
    // sin nombres, que es exactamente cuando hay carriles enormes (una final de
    // cuatro llenando el alto). Dentro de la página el carril nunca pasa de 38,
    // así que ahí ganan los 82 de siempre y no se mueve nada.
    padBottom: Math.max(82, Math.round(lane / 2) + 62),
    // El área de dibujo se come el aire de los dos costados. Estos márgenes se
    // calibraron para nombres completos ("la etiqueta más larga mide 168px");
    // con `shortName()` acotando toda etiqueta a "Nombre I. I." (máximo tres
    // palabras) ese margen sobra, y el ancho liberado es de la gráfica, no de
    // los márgenes. El nombre está anclado por la derecha y crece hacia la
    // izquierda según su propio ancho — con nombres cortos, el presupuesto
    // que sobra entre el nombre y el borde real es hueco muerto, no texto.
    plotLeft: 170,
    plotRight: 960,
    startRankX: 190,
    endRankX: 1036,
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
  laneOverride,
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
  laneOverride?: number;
} & HoverProps) {
  // Cuánto mide cada nombre ya dibujado. Un contra-trazo alcanzaba para tapar la
  // guía, pero seguía pasando por debajo de las letras; medir el texto es la
  // única forma de que la guía empiece donde el nombre termina, y de paso sirve
  // para cualquier largo de nombre sin adivinar.
  const nameRefs = useRef(new Map<string, SVGTextElement>());
  const [nameWidths, setNameWidths] = useState<Record<string, number>>({});
  // La etiqueta del extremo izquierdo (puesto + nombre en un solo `<text>`,
  // creciendo hacia la izquierda) tiene el mismo problema que la del extremo
  // derecho — un nombre largo se dibuja encima de las líneas de la gráfica —
  // así que se mide y se comprime con el mismo mecanismo, en un mapa aparte
  // porque es un elemento distinto.
  const startLabelRefs = useRef(new Map<string, SVGTextElement>());
  const [startLabelWidths, setStartLabelWidths] = useState<Record<string, number>>({});
  useEffect(() => {
    const measure = (refs: Map<string, SVGTextElement>) => {
      const measured: Record<string, number> = {};
      for (const [id, element] of refs) {
        // Un nombre ya comprimido con `textLength` reporta esa medida
        // comprimida, no la natural — remedirlo aquí oscilaría para siempre
        // (comprime → se mide más corto → deja de hacer falta comprimir →
        // se expande → vuelve a medir largo → comprime de nuevo). Se conserva
        // la primera medición (la natural) y ya no se toca.
        if (element.hasAttribute('textLength')) {
          continue;
        }
        measured[id] = element.getComputedTextLength();
      }
      return measured;
    };
    // Sin comparar, cada medición dispararía otro render que vuelve a medir.
    const merge = (previous: Record<string, number>, measured: Record<string, number>) => {
      const merged = { ...previous, ...measured };
      const ids = Object.keys(merged);
      const same =
        ids.length === Object.keys(previous).length && ids.every((id) => previous[id] === merged[id]);
      return same ? previous : merged;
    };
    setNameWidths((previous) => merge(previous, measure(nameRefs.current)));
    setStartLabelWidths((previous) => merge(previous, measure(startLabelRefs.current)));
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
  } = bumpLayout(compact, shown.length, laneOverride);
  const roomy = lane >= 32;
  const endNameX = plotRight + 88;
  // Sin esto el nombre se dibujaba sin límite y el borde del viewBox lo
  // recortaba en seco en cuanto pasaba de las 282 unidades que quedan hasta
  // el borde — un nombre largo se perdía del todo, no se veía "algo cortado".
  const nameMargin = 16;
  const availableNameWidth = width - endNameX - nameMargin;
  // El extremo izquierdo crece hacia la izquierda desde `startNameEndX`: sin
  // comprimirlo, un nombre largo no se recorta contra ningún borde, se dibuja
  // encima de las líneas de la gráfica, que es peor que perderse.
  const startNameEndX = plotLeft - 34;
  const startNameMargin = 16;
  const availableStartWidth = startNameEndX - startNameMargin;
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
      {/* Los dos extremos se titulan igual —"puesto luego del bloque N"— porque
          son lo mismo medido en dos momentos; "posición final" mentiría
          mientras todavía queden bloques por escalar. El número sale del primer
          y del último punto, así que una ronda de siete dice "bloque 7".
          En el teléfono estos títulos viven en HTML sobre la gráfica: aquí no
          hay dónde ponerlos sin robarle ancho a las líneas. */}
      {!compact && (
        <>
          <text x={startLabelMid} y={30} textAnchor="middle" {...axis}>
            PUESTO LUEGO
          </text>
          <text x={startLabelMid} y={48} textAnchor="middle" {...axis}>
            {article === 'la' ? 'DE LA' : 'DEL'} {unit.toUpperCase()} {points[0]!.problemNumber}
          </text>
          <text x={endLabelMid} y={30} textAnchor="middle" {...axis}>
            PUESTO LUEGO
          </text>
          <text x={endLabelMid} y={48} textAnchor="middle" {...axis}>
            {article === 'la' ? 'DE LA' : 'DEL'} {unit.toUpperCase()} {points.at(-1)!.problemNumber}
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
        const startLabelWidth = startLabelWidths[row.registrationId];

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
                    {shortName(row.athleteName)}
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
                  ref={(element) => {
                    if (element) {
                      startLabelRefs.current.set(row.registrationId, element);
                    } else {
                      startLabelRefs.current.delete(row.registrationId);
                    }
                  }}
                  x={startNameEndX}
                  y={startYs[index]! + 5}
                  textAnchor="end"
                  fontSize={roomy ? 16 : 13}
                  fontWeight={500}
                  fill={focused ? INK : MUTED}
                  {...(startLabelWidth !== undefined && startLabelWidth > availableStartWidth
                    ? { textLength: availableStartWidth, lengthAdjust: 'spacingAndGlyphs' as const }
                    : {})}
                >
                  <tspan fontWeight={700} className="tabular-nums">
                    {startRank}.
                  </tspan>
                  <tspan dx={6}>{shortName(row.athleteName)}</tspan>
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
                  {...(nameWidth !== undefined && nameWidth > availableNameWidth
                    ? { textLength: availableNameWidth, lengthAdjust: 'spacingAndGlyphs' as const }
                    : {})}
                >
                  {shortName(row.athleteName)}
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

export function Wall({
  round,
  unit,
  isHeight,
  // En proyección el muro comparte panel con los intentos al top, y con el
  // aire de la página los dos no caben en el alto que hay.
  dense = false,
}: {
  round: LeaderboardRound;
  unit: string;
  isHeight: boolean;
  dense?: boolean;
}) {
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
      <ul className={`flex flex-col ${dense ? 'gap-3' : 'gap-5'}`}>
        {stats.map((stat, index) => (
          <li key={stat.problemId} className="flex items-center gap-2 sm:gap-5">
            <span className="w-20 shrink-0 sm:w-36">
              <span className="block font-display text-xl font-bold leading-tight">
                {unit.slice(0, 1).toUpperCase()}
                {stat.number}
                {/* El bloque más duro se llama crux, y la plataforma se llama
                    igual por eso mismo. Va con la marca: es el único sitio
                    donde el nombre significa las dos cosas a la vez.
                    Exige intentos en TODOS los bloques: con datos parciales
                    el sort empata en cero y gana el de menor número, que no
                    mide nada. */}
                {index === 0 && stats.every((s) => s.attempts > 0) && (
                  <span className={`ml-2 align-middle text-[11px] uppercase ${brandWordClass}`}>crux</span>
                )}
              </span>
              <span className="block truncate text-sm text-muted">{problemName(stat.problemId) ?? '—'}</span>
            </span>

            {/* Cada tramo dice qué significa su color al pasarle el cursor: se
                queda encendido y los otros dos de su barra se apagan, y el
                texto sale arriba. Un color solo no dice qué mide. */}
            <span className={`relative flex flex-1 overflow-hidden rounded-lg ${dense ? 'h-8' : 'h-9'}`} style={{ background: LANE }}>
              {(
                [
                  { kind: 'top', width: (stat.tops / stat.field) * 100, background: GOLD, restOpacity: 1 },
                  { kind: 'zone', width: (stat.zones / stat.field) * 100, background: PINE, restOpacity: 1 },
                  { kind: 'none', width: null, background: 'transparent', restOpacity: 1 },
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
                        hover !== null && hover.problemId === stat.problemId
                          ? (hover.kind === segment.kind ? 1 : 0.35)
                          : segment.restOpacity,
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

/* --------------------------------------------------- route profile (lead) */

/** Qué tramo de qué perfil está señalado. */
interface ProfileHover {
  problemId: string;
  kind: 'top' | 'bucket-0' | 'bucket-1' | 'bucket-2' | 'rest';
}

/**
 * Perfil vertical por ruta, exclusivo de lead: de la base a la cima, con la
 * densidad de dónde se quedó quien no topó. En lead cada ruta es un objeto
 * vertical de verdad, y leerlo acostado (como hace `Wall` para boulder) es
 * menos directo que respetar esa orientación.
 *
 * Por bandas apiladas y no por posición continua: trece competidores en el
 * mismo tramo se encimarían como puntos sueltos. El alto de cada banda
 * codifica cuántos cayeron ahí — mismos tramos que ya calcula
 * `heightDistribution`, solo que de arriba (cima) a abajo (base) en vez de
 * izquierda a derecha.
 */
export function RouteProfile({ round, unit }: { round: LeaderboardRound; unit: string }) {
  const [hover, setHover] = useState<ProfileHover | null>(null);
  // Mismo desempate que `Wall`: menos tops es más duro, y con los mismos
  // tops manda el flash.
  const stats = [...round.problemStats].sort(
    (a, b) => a.tops - b.tops || a.flashes - b.flashes,
  );
  if (stats.length === 0) {
    return null;
  }
  const dists = heightDistribution(round);
  const problemName = (id: string) => round.problems.find((p) => p.id === id)?.name;
  const crux = stats.every((s) => s.attempts > 0);

  const hoveredStat = stats.find((s) => s.problemId === hover?.problemId);
  const hoveredDist = dists.find((d) => d.problemId === hover?.problemId);
  const hoveredBuckets = hoveredDist?.mode === 'buckets' ? hoveredDist.buckets : null;
  // Etiquetas cortas y sin verbo conjugado: "9 · Mitad de la vía" en vez de
  // "9 se quedaron a mitad de vía". Más simple, y no hace falta la variante
  // singular/plural que sí usa `Wall`.
  const profileLabel = {
    top: 'Top',
    'bucket-0': 'Cerca al top',
    'bucket-1': 'Mitad de la vía',
    'bucket-2': 'Parte baja de la vía',
    rest: 'Sin top',
  } as const;
  const reading =
    hoveredStat && hover
      ? `${
          {
            top: hoveredStat.tops,
            'bucket-0': hoveredBuckets?.[0] ?? 0,
            'bucket-1': hoveredBuckets?.[1] ?? 0,
            'bucket-2': hoveredBuckets?.[2] ?? 0,
            rest: hoveredStat.field - hoveredStat.tops,
          }[hover.kind]
        } · ${profileLabel[hover.kind]}`
      : null;

  return (
    <div>
      <p className="mb-3 min-h-6 text-[15px] font-semibold text-ink">{reading}</p>
      <ul className="flex flex-wrap gap-6">
        {stats.map((stat, index) => {
          const dist = dists.find((d) => d.problemId === stat.problemId);
          const buckets = dist?.mode === 'buckets' ? dist.buckets : null;
          const segments = [
            { kind: 'top' as const, count: stat.tops, background: GOLD, restOpacity: 1 },
            ...(buckets
              ? [
                  { kind: 'bucket-0' as const, count: buckets[0], background: PINE, restOpacity: 0.85 },
                  { kind: 'bucket-1' as const, count: buckets[1], background: PINE, restOpacity: 0.55 },
                  { kind: 'bucket-2' as const, count: buckets[2], background: PINE, restOpacity: 0.3 },
                ]
              : [{ kind: 'rest' as const, count: stat.field - stat.tops, background: PINE, restOpacity: 0.3 }]),
          ];
          return (
            <li key={stat.problemId} className="flex w-20 flex-col items-center gap-2">
              <span className="text-center">
                <span className="block font-display text-lg font-bold leading-tight">
                  {unit.slice(0, 1).toUpperCase()}
                  {stat.number}
                  {/* En línea con el número y no en su propio renglón: un
                      renglón aparte solo en la columna más dura le suma alto
                      a ese encabezado y desalinea su barra contra las demás
                      (mismo defecto que ya resolvió `Wall`). */}
                  {index === 0 && crux && (
                    <span className={`ml-1 align-middle text-[9px] uppercase ${brandWordClass}`}>crux</span>
                  )}
                </span>
                <span className="block truncate text-xs text-muted">{problemName(stat.problemId) ?? '—'}</span>
              </span>
              <div className="flex h-36 w-14 flex-col overflow-hidden rounded-t-2xl" style={{ background: LANE }}>
                {segments.map((segment) => (
                  <div
                    key={segment.kind}
                    className="w-full transition-opacity duration-150"
                    style={{
                      height: `${(segment.count / stat.field) * 100}%`,
                      background: segment.background,
                      opacity:
                        hover !== null && hover.problemId === stat.problemId
                          ? hover.kind === segment.kind
                            ? 1
                            : 0.35
                          : segment.restOpacity,
                    }}
                    // Mismo problema que en `Wall`: en el teléfono el toque
                    // enciende el tramo y nunca llega el evento que lo apaga.
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
                ))}
                {/* Quien todavía no ha intentado esta ruta: mismo criterio que
                    el tramo "none" de `Wall`, un relleno sin ancho fijo. */}
                <div className="flex-1" />
              </div>
              <span className="font-display text-sm font-bold tabular-nums text-muted">
                {stat.tops}/{stat.field}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------ attempts/top */

/**
 * How many goes each top cost. One axis, sorted, low is good — a scatter asked
 * the reader to decode two dimensions and a diagonal before it said anything.
 */
export function AttemptsPerTop({
  round,
  // En proyección esta gráfica comparte panel con la del muro y no puede
  // llevarse todo el alto: se recorta a las primeras y se queda sin el ancho
  // mínimo, que ahí no tiene a dónde desplazarse.
  limit = 10,
  fixedWidth = true,
  // Cuántos tops hacen falta para entrar y cuánta gente para que la gráfica
  // valga la pena. Los dos tops se quedan: con uno solo, un flash de suerte
  // promedia 1.0 y le gana a quien envió cinco, que es lo contrario de lo que
  // esto mide. Dos competidoras sí bastan — en una final de cuatro es lo que
  // hay, y dos barras ya comparan. Los mismos pisos en las dos pantallas: que
  // la tabla pública y la de proyección discrepen sobre si esta gráfica existe
  // es peor que cualquiera de los dos criterios.
  minTops = 2,
  minClimbers = 2,
  hovered,
  onHover,
  onSelect,
}: {
  round: LeaderboardRound;
  limit?: number;
  fixedWidth?: boolean;
  minTops?: number;
  minClimbers?: number;
} & HoverProps) {
  const minWidth = fixedWidth ? 'sm:min-w-[33rem]' : '';
  const climbers = round.rows.flatMap((row) => {
    // Two tops minimum. Otherwise a single lucky flash scores 1.0 and outranks
    // someone who sent five, which is the exact opposite of the point.
    const summary = topSummary(row);
    if (!summary || summary.tops < minTops) {
      return [];
    }
    return [{
      id: row.registrationId,
      name: row.athleteName,
      rank: row.result.rank,
      tops: summary.tops,
      // Intentos de los bloques que sí topó. Un bloque que se le quedó no
      // entra al promedio: mediría otra cosa, cuánto peleó, no cuánto le
      // costó cada top.
      topAttempts: summary.topAttempts,
      ratio: summary.topAttempts / summary.tops,
    }];
  });
  if (climbers.length < minClimbers) {
    return null;
  }

  const ranked = climbers.sort((a, b) => a.ratio - b.ratio).slice(0, limit);
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
      <div className={`mb-3 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted sm:gap-4 ${minWidth}`}>
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
            className={`flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 transition-opacity duration-200 sm:flex-nowrap sm:gap-x-4 ${minWidth} ${
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

/**
 * Qué bloque es cada B1, B2, B3.
 *
 * Los nombres solo salían en «¿Qué tan duros estaban los bloques?», así que para
 * saber que B3 era Puracé había que bajar a otra tarjeta y volver. La tabla y
 * esta gráfica hablaban en códigos que no se resuelven en ningún sitio cercano.
 *
 * Se omite entera si el organizador no les puso nombre: entonces el código ya es
 * el nombre y una línea que dijera «B1 · B2 · B3» sería ruido.
 */
function ProblemLegend({ round, unit }: { round: LeaderboardRound; unit: string }) {
  const named = round.problems.filter((problem) => problem.name).sort((a, b) => a.number - b.number);
  if (named.length === 0) {
    return null;
  }
  const initial = unit.slice(0, 1).toUpperCase();
  return (
    <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
      {named.map((problem) => (
        <li key={problem.id}>
          <span className="font-semibold text-ink">
            {initial}
            {problem.number}
          </span>{' '}
          {problem.name}
        </li>
      ))}
    </ul>
  );
}

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
  categoryGender,
  hovered,
  onHover,
  onSelect,
}: {
  round: LeaderboardRound;
  unit: { singular: string; plural: string; article: string };
  categoryGender: 'male' | 'female' | 'mixed' | null;
} & HoverProps) {
  if (round.timeline.length === 0) {
    return null;
  }
  const isHeight = round.rows[0]?.result.format === 'max_height';
  const showAttemptsPerTop = hasAttemptsPerTop(round);

  return (
    <div className="flex flex-col gap-6">
      <Headline round={round} unit={unit} isHeight={isHeight} />

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
                Luego {unit.article === 'la' ? 'de la' : 'del'} {unit.singular}{' '}
                {round.timeline[0]!.problemNumber}
              </span>
              <span>
                Luego {unit.article === 'la' ? 'de la' : 'del'} {unit.singular}{' '}
                {round.timeline.at(-1)!.problemNumber}
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
          Se lee de izquierda a derecha: arranca con el puesto luego del primer {unit.singular}.{' '}
          <span className="sm:hidden">
            Presiona una línea para ver el nombre del competidor al que corresponde; eso resalta su
            posición en la tabla y en las demás gráficas.
          </span>
          <span className="hidden sm:inline">
            Haz clic sobre un competidor y se resalta en la tabla y en las demás gráficas.
          </span>
        </p>
        <ProblemLegend round={round} unit={unit.singular} />
      </Panel>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[3fr_2fr]">
        <Panel
          title={`¿Qué tan dur${unit.article === 'la' ? 'as' : 'os'} estaban l${unit.article === 'la' ? 'as' : 'os'} ${unit.plural}?`}
          hint={`De l${categoryGender === 'female' ? 'as' : 'os'} ${round.rows.length} ${climberWord(categoryGender)} de la categoría, cuánt${categoryGender === 'female' ? 'as' : 'os'} hicieron top${
            isHeight ? '' : ` y cuánt${categoryGender === 'female' ? 'as' : 'os'} se quedaron en zona`
          }. ${unit.article === 'la' ? 'De la más dura a la' : 'Del más duro al'} más fácil.`}
        >
          <div className="mb-5 flex flex-wrap items-center gap-5 text-sm text-muted">
            <Swatch color={GOLD} label={SCORE_TERM.top} />
            {!isHeight && <Swatch color={PINE} label={SCORE_TERM.zone} />}
          </div>
          <Wall round={round} unit={unit.singular} isHeight={isHeight} />
        </Panel>

        {showAttemptsPerTop ? (
          <Panel
            title="Cuántos intentos al top"
            hint={`Promedio de intentos por cada top logrado. Solo cuentan l${unit.article === 'la' ? 'as' : 'os'} ${unit.plural} en l${unit.article === 'la' ? 'as' : 'os'} que hizo top; entra quien tenga dos tops o más. Menos es mejor.`}
          >
            {/* El desplazamiento lateral arranca en `sm`: por debajo la fila se
                parte en dos renglones y no hay nada que arrastrar. */}
            <div className="sm:overflow-x-auto">
              <AttemptsPerTop round={round} hovered={hovered} onHover={onHover} onSelect={onSelect} />
            </div>
          </Panel>
        ) : isHeight ? (
          <Panel
            title="¿Hasta dónde llegaron?"
            hint="Altura máxima alcanzada en cada ruta: cuántos llegaron al top y en qué sección se quedaron quienes no la completaron."
          >
            <RouteProfile round={round} unit={unit.singular} />
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
