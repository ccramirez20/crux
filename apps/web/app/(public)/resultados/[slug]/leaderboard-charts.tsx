'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { SCORE_TERM, flashCount } from '@/lib/labels';
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

const cardClass = 'rounded-2xl border border-cardborder bg-card p-7';
const eyebrow = 'text-[11px] font-semibold uppercase tracking-[0.18em] text-muted';

function Panel({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <figure className={`${cardClass} m-0 flex flex-col`}>
      {/* El título tiene que ganarle al contenido, no competir con él: a
          tamaño de subtítulo se perdía entre las barras y las líneas. */}
      <figcaption className="mb-7">
        <h2 className="font-display text-[1.75rem] font-bold leading-tight tracking-tight text-ink">{title}</h2>
        <p className="mt-1.5 text-base text-muted">{hint}</p>
      </figcaption>
      {children}
    </figure>
  );
}

/* ------------------------------------------------------------------ tiles */

function StatTile({ label, what, value, detail }: { label: string; what: string; value: string; detail: string }) {
  return (
    <div className={`${cardClass} flex flex-col gap-2 py-6`}>
      <span className={eyebrow}>{label}</span>
      {/* The tile says what it is measuring before it says the number. A big
          figure with only a two-word label makes the reader guess the unit. */}
      <span className="text-sm text-muted">{what}</span>
      {/* Los tres del mismo color: son tres hechos del mismo rango, y teñir solo
          uno se leía como que ese importaba más. Pine y no oro — el oro contra
          el hueso de la tarjeta queda en 1.8:1 y se pierde; este da 8:1 y sigue
          siendo acento. */}
      <span className="mt-1 font-display text-[3.25rem] font-bold leading-none tracking-tight tabular-nums" style={{ color: PINE }}>
        {value}
      </span>
      <span className="text-base text-muted">{detail}</span>
    </div>
  );
}

function Headline({ round, unit, isHeight }: { round: LeaderboardRound; unit: string; isHeight: boolean }) {
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
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {crux && (
        <StatTile
          label={`El ${unit} más duro`}
          what={`Cuál fue el ${unit} que menos gente pudo hacer`}
          value={`${unit.slice(0, 1).toUpperCase()}${crux.number}`}
          detail={`${problemName(crux.problemId) ?? 'Sin nombre'} · le hicieron top ${crux.tops} de ${crux.field}`}
        />
      )}
      {!isHeight && (
        <StatTile
          label="Flashes de la ronda"
          what="De todos los tops, cuántos salieron al primer intento"
          value={totalTops > 0 ? `${Math.round((totalFlashes / totalTops) * 100)}%` : '—'}
          detail={`${flashCount(totalFlashes)} de ${totalTops} tops en la ronda`}
        />
      )}
      {bestClimb && bestClimb.delta > 0 && (
        <StatTile
          label="Mayor ascenso en la tabla"
          what={`Quién más puestos ganó desde el primer ${unit}`}
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

function BumpChart({
  round,
  unit,
  plural,
  article,
  hovered,
  onHover,
  onSelect,
}: { round: LeaderboardRound; unit: string; plural: string; article: string } & HoverProps) {
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

  // El carril se estrecha con el campo en vez de estirar la gráfica hacia
  // abajo. Es la pantalla que se proyecta: veinticinco competidoras tienen que
  // caber en el mismo alto que catorce, o la mitad de la categoría queda fuera
  // del proyector.
  const lane = Math.max(22, Math.min(38, Math.round(620 / shown.length)));
  const roomy = lane >= 32;
  const padTop = 78;
  const padBottom = 82;
  // El área de dibujo se come el aire de los dos costados: la etiqueta más larga
  // mide 168 px y arrancaba en x=88, y del otro lado sobraba otro tanto antes
  // del chip. La gráfica es el foco de esta pantalla, así que el ancho que
  // sobraba es suyo y no de los márgenes.
  const plotLeft = 224;
  const plotRight = 880;
  const endRankX = plotRight + 76;
  const endNameX = plotRight + 88;
  // El centro de cada columna de etiquetas, medido sobre el bloque de texto que
  // ocupan y no sobre el ancho disponible: el título tiene que quedar encima de
  // los nombres, no encima del aire que sobra al lado.
  const startLabelMid = plotLeft - 118;
  const endLabelMid = plotRight + 150;
  const deltaX = 1240;
  const width = 1250;
  const height = padTop + (maxRank - 1) * lane + padBottom;
  const laneTop = padTop - lane / 2;
  const laneBottom = padTop + (maxRank - 1) * lane + lane / 2;

  const x = (index: number) => plotLeft + (index * (plotRight - plotLeft)) / (points.length - 1);
  const y = (rank: number) => padTop + (rank - 1) * lane;

  const gap = Math.min(26, lane - 2);
  const endYs = declutter(shown.map((row) => y(rankAt(row, points.at(-1)!))), gap);
  const startYs = declutter(shown.map((row) => y(rankAt(row, points[0]!))), gap);

  const axis = { fontSize: 12, fill: MUTED, fontWeight: 600, letterSpacing: 1.1 } as const;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full min-w-[900px]"
      role="img"
      aria-label={`Puesto de cada competidor al cierre de cada ${unit}`}
    >
      {/* Los dos extremos se titulan igual —"puesto tras el bloque N"— porque
          son lo mismo medido en dos momentos; "posición final" mentiría
          mientras todavía queden bloques por escalar. El número sale del primer
          y del último punto, así que una ronda de siete dice "bloque 7". */}
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

      {/* La banda empieza y termina con el área de dibujo. Extenderla hasta la
          columna de cambio amarraba la fila con su chip, pero sacaba la piel de
          la gráfica fuera de la gráfica; de eso se encarga ahora la guía. */}
      {Array.from({ length: maxRank }, (_, index) => index).map((row) =>
        row % 2 === 0 ? (
          <rect
            key={row}
            x={plotLeft - 22}
            y={y(row + 1) - lane / 2}
            width={plotRight - plotLeft + 44}
            height={lane}
            fill={LANE}
            opacity={0.7}
          />
        ) : null,
      )}

      {points.map((point, index) => (
        <g key={point.problemNumber}>
          <line x1={x(index)} y1={laneTop} x2={x(index)} y2={laneBottom} stroke={RULE} strokeWidth={1} opacity={0.8} />
          <text x={x(index)} y={laneBottom + 24} textAnchor="middle" fontSize={15} fontWeight={700} fill={INK}>
            {tick(index)}
          </text>
        </g>
      ))}
      {/* Una palabra: qué son esas marcas. Los intentos acumulados vivían aquí
          abajo y eran dos filas de texto para un dato que nadie venía a buscar;
          que cada marca sea el cierre de su bloque ya lo dice el subtítulo. */}
      <text x={(plotLeft + plotRight) / 2} y={laneBottom + 48} textAnchor="middle" {...axis}>
        {plural.toUpperCase()}
      </text>

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
            onMouseEnter={() => onHover(row.registrationId)}
            onMouseLeave={() => onHover(null)}
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
            <path d={path} fill="none" stroke={SURFACE} strokeWidth={podium || focused ? 10 : 7} strokeLinecap="round" />
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth={podium || focused ? 4.5 : 2.5}
              strokeLinecap="round"
              opacity={podium || focused ? 1 : 0.55}
            />
            <circle cx={x(points.length - 1)} cy={y(endRank)} r={podium ? 8 : 5} fill={color} stroke={SURFACE} strokeWidth={2.5} />

            {/* La guía amarra la etiqueta con su línea. Las etiquetas se
                separan entre sí para poder leerse, así que no siempre caen
                sobre su carril, y sin la guía no hay forma de saber cuál nombre
                es cuál línea. Punteada y tenue: es una ayuda de lectura, no un
                trazo más compitiendo con las curvas. */}
            <line
              x1={plotLeft - 22}
              y1={startYs[index]!}
              x2={plotLeft}
              y2={y(startRank)}
              stroke={podium || focused ? color : RULE}
              strokeWidth={1.5}
              strokeDasharray="2 3"
            />
            {/* Del nombre a su chip, y solo para quien se movió: el chip está
                lejos y con dos vecinas quietas no había nada que dijera de quién
                era ese ▼12. Va del color de su propio chip, para que se lea como
                el rastro de ese chip y no como un renglón de tabla. Arranca en
                el final medido del nombre, así que no lo toca por largo que
                sea; hasta que la medida existe, no se dibuja. */}
            {delta !== 0 && nameWidth !== undefined && (
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
            {/* A la derecha el puesto va en su propia columna: pegado al nombre,
                "12 Manuela" se leía como una sola cosa larga. Y separado del
                área de dibujo, porque al ir alineado a la derecha el de dos
                dígitos arrancaba encima del nodo de su propia línea. */}
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

            {/* A filled chip, not a bare glyph. A 14px triangle in a flat colour
                vanishes from across a gym; a solid block with a light arrow on
                it survives the distance. */}
            {delta !== 0 && (
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

function Wall({ round, unit, isHeight }: { round: LeaderboardRound; unit: string; isHeight: boolean }) {
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
      <div className="mb-3 flex h-7 items-center gap-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        <span className="w-36 shrink-0" />
        <span className="flex-1 truncate text-base font-semibold normal-case tracking-normal text-ink">
          {reading}
        </span>
        <span className="w-24 shrink-0 text-center">{SCORE_TERM.top}</span>
        {!isHeight && <span className="w-20 shrink-0 text-center">{SCORE_TERM.flash}</span>}
      </div>
      <ul className="flex flex-col gap-5">
        {stats.map((stat, index) => (
          <li key={stat.problemId} className="flex items-center gap-5">
            <span className="w-36 shrink-0">
              <span className="block font-display text-xl font-bold leading-tight">
                {unit.slice(0, 1).toUpperCase()}
                {stat.number}
                {index === 0 && <span className="ml-2 align-middle text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">crux</span>}
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
                    onMouseEnter={() => setHover({ problemId: stat.problemId, kind: segment.kind })}
                    onMouseLeave={() => setHover(null)}
                  />
                </Fragment>
              ))}
            </span>

            <span className="w-24 shrink-0 text-center">
              <span className="block font-display text-2xl font-bold leading-none tabular-nums">
                {stat.tops}
                <span className="text-lg font-semibold text-muted">/{stat.field}</span>
              </span>
            </span>
            {!isHeight && (
              <span className="w-20 shrink-0 text-center font-display text-2xl font-bold leading-none tabular-nums">
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
function AttemptsPerTop({ round, hovered, onHover, onSelect }: { round: LeaderboardRound } & HoverProps) {
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
      <div className="mb-3 flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        <span className="w-44 shrink-0" />
        <span className="flex-1" />
        <span className="w-20 shrink-0 text-right">Promedio</span>
        <span className="w-16 shrink-0 text-right">Tops</span>
      </div>
      <ul className="flex flex-col gap-4">
        {ranked.map((climber) => (
          <li
            key={climber.id}
            onMouseEnter={() => onHover(climber.id)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onSelect(climber.id)}
            className={`flex cursor-pointer items-center gap-4 transition-opacity duration-200 ${
              hovered !== null && hovered !== climber.id ? 'opacity-60' : ''
            }`}
          >
            <span className="w-44 shrink-0 truncate font-display text-lg font-semibold">{climber.name}</span>
            <span
              className="flex h-7 flex-1 overflow-hidden rounded-lg"
              style={{ background: LANE }}
              title={`${climber.name}: ${climber.topAttempts} intentos para ${climber.tops} tops`}
            >
              {/* Colour follows the competitor's standing, not their place in
                  this list, so the leader is the same gold in every chart. */}
              <span className="h-full rounded-lg" style={{ width: `${(climber.ratio / worst) * 100}%`, background: podiumColor(climber.rank) }} />
            </span>
            <span className="w-20 shrink-0 text-right font-display text-xl font-bold tabular-nums">
              {climber.ratio.toFixed(1)}
            </span>
            <span className="w-16 shrink-0 text-right font-display text-xl font-bold tabular-nums text-muted">
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
        hint={`Una línea por competidor. Se muestra al cierre de cada ${unit.singular}.`}
      >
        {/* En el teléfono la gráfica no se encoge hasta volverse ilegible: se
            desplaza. Un eje de 15 nombres a 360 px de ancho no es una gráfica. */}
        <div className="overflow-x-auto">
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
        <p className="mt-4 text-base text-muted">
          Se lee de izquierda a derecha: arranca con el puesto tras el primer {unit.singular}. La escala
          vertical es cuántos compiten en la categoría. Haz clic sobre un competidor y se resalta en la
          tabla y en las demás gráficas.
        </p>
      </Panel>

      <div className={`grid grid-cols-1 gap-6 ${hasAttemptsPerTop ? 'xl:grid-cols-[3fr_2fr]' : ''}`}>
        <Panel
          title={`¿Qué tan duros estaban los ${unit.plural}?`}
          hint={`De los ${round.rows.length} de la categoría, cuántos hicieron top y cuántos se quedaron en zona. Del más duro al más amable.`}
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
            hint={`Promedio de intentos por cada top logrado. Solo cuenta los ${unit.plural} que sí topó; entra quien tenga dos tops o más.`}
          >
            <AttemptsPerTop round={round} hovered={hovered} onHover={onHover} onSelect={onSelect} />
          </Panel>
        )}
      </div>
    </div>
  );
}
