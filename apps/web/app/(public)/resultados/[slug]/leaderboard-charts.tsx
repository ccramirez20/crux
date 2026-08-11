'use client';

import { SCORE_TERM, flashCount } from '@/lib/labels';
import type { LeaderboardRound, LeaderboardRow } from '@/lib/leaderboard';

/** Señalar a alguien la resalta en las tres piezas a la vez; el estado vive en la pantalla. */
export interface HoverProps {
  hovered: string | null;
  onHover: (registrationId: string | null) => void;
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

function StatTile({ label, what, value, detail, accent }: { label: string; what: string; value: string; detail: string; accent?: boolean }) {
  return (
    <div className={`${cardClass} flex flex-col gap-2 py-6`}>
      <span className={eyebrow}>{label}</span>
      {/* The tile says what it is measuring before it says the number. A big
          figure with only a two-word label makes the reader guess the unit. */}
      <span className="text-sm text-muted">{what}</span>
      <span
        className="mt-1 font-display text-[3.25rem] font-bold leading-none tracking-tight tabular-nums"
        style={accent ? { color: GOLD } : undefined}
      >
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
          accent
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
          what="Quién más puestos ganó desde que arrancó la ronda"
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

// Eight, not ten. Past eight the crossings stop being readable and the chart
// starts costing more attention than it returns.
const SHOWN_LINES = 8;

function BumpChart({ round, hovered, onHover }: { round: LeaderboardRound } & HoverProps) {
  const points = round.timeline;
  const shown = round.rows.slice(0, SHOWN_LINES);
  if (points.length < 2 || shown.length < 2) {
    return null;
  }

  const rankAt = (row: LeaderboardRow, point: (typeof points)[number]) =>
    point.ranks[row.registrationId] ?? shown.length;
  const maxRank = Math.max(...shown.flatMap((row) => points.map((p) => rankAt(row, p))));

  const lane = 38;
  const padTop = 30;
  const padBottom = 52;
  const plotLeft = 250;
  const plotRight = 830;
  const deltaX = 1240;
  const width = 1250;
  const height = padTop + (maxRank - 1) * lane + padBottom;

  const x = (index: number) => plotLeft + (index * (plotRight - plotLeft)) / (points.length - 1);
  const y = (rank: number) => padTop + (rank - 1) * lane;

  const endYs = declutter(shown.map((row) => y(rankAt(row, points.at(-1)!))), 26);
  const startYs = declutter(shown.map((row) => y(rankAt(row, points[0]!))), 26);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Puesto de cada competidor a lo largo de la ronda">
      {Array.from({ length: maxRank }, (_, index) => index).map((row) =>
        row % 2 === 0 ? (
          <rect key={row} x={plotLeft - 22} y={y(row + 1) - lane / 2} width={plotRight - plotLeft + 44} height={lane} fill={LANE} opacity={0.7} />
        ) : null,
      )}

      {points.map((point, index) =>
        index % 3 === 0 || index === points.length - 1 ? (
          <text key={point.attempts} x={x(index)} y={height - 30} textAnchor="middle" fontSize={13} fill={MUTED}>
            {point.attempts}
          </text>
        ) : null,
      )}
      {/* "En la categoría" no es un detalle: sin eso el eje se lee como los
          intentos de cada competidora, y entonces no se entiende por qué todas
          las líneas terminan en el mismo punto. */}
      <text x={(plotLeft + plotRight) / 2} y={height - 10} textAnchor="middle" fontSize={13} fill={MUTED} letterSpacing={1.2}>
        INTENTOS JUZGADOS EN LA CATEGORÍA
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

        return (
          <g
            key={row.registrationId}
            onMouseEnter={() => onHover(row.registrationId)}
            onMouseLeave={() => onHover(null)}
            opacity={dimmed ? 0.2 : 1}
            style={{ transition: 'opacity 200ms ease' }}
          >
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

            <text x={plotLeft - 30} y={startYs[index]! + 5} textAnchor="end" fontSize={15} fill={MUTED}>
              {startRank}. {row.athleteName}
            </text>
            <text x={plotRight + 24} y={endYs[index]! + 5} fontSize={18} fontWeight={podium ? 700 : 500} fill={podium ? INK : MUTED}>
              {endRank}. {row.athleteName}
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

function Wall({ round, unit, isHeight }: { round: LeaderboardRound; unit: string; isHeight: boolean }) {
  const stats = [...round.problemStats].sort((a, b) => a.tops - b.tops);
  if (stats.length === 0) {
    return null;
  }
  const problemName = (id: string) => round.problems.find((p) => p.id === id)?.name;

  return (
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

          <span className="relative flex h-9 flex-1 overflow-hidden rounded-lg" style={{ background: LANE }}>
            <span className="h-full" style={{ width: `${(stat.tops / stat.field) * 100}%`, background: GOLD }} />
            {stat.zones > 0 && <span className="h-full" style={{ width: 2, background: SURFACE }} />}
            <span className="h-full" style={{ width: `${(stat.zones / stat.field) * 100}%`, background: PINE }} />
          </span>

          <span className="w-40 shrink-0 text-right">
            <span className="block font-display text-2xl font-bold leading-none tabular-nums">
              {stat.tops}
              <span className="text-lg font-semibold text-muted">/{stat.field}</span>
            </span>
            <span className="block text-sm text-muted">
              {isHeight ? 'llegaron al top' : flashCount(stat.flashes)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------ attempts/top */

/**
 * How many goes each top cost. One axis, sorted, low is good — a scatter asked
 * the reader to decode two dimensions and a diagonal before it said anything.
 */
function AttemptsPerTop({ round, hovered, onHover }: { round: LeaderboardRound } & HoverProps) {
  const climbers = round.rows.flatMap((row) =>
    // Two tops minimum. Otherwise a single lucky flash scores 1.0 and outranks
    // someone who sent five, which is the exact opposite of the point.
    row.result.format === 'classic_tops_zones' && row.result.tops >= 2
      ? [{
          id: row.registrationId,
          name: row.athleteName,
          rank: row.result.rank,
          tops: row.result.tops,
          ratio: row.result.topAttempts / row.result.tops,
        }]
      : [],
  );
  if (climbers.length < 3) {
    return null;
  }

  const ranked = climbers.sort((a, b) => a.ratio - b.ratio).slice(0, 8);
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
            className={`flex items-center gap-4 transition-opacity duration-200 ${
              hovered !== null && hovered !== climber.id ? 'opacity-30' : ''
            }`}
          >
            <span className="w-44 shrink-0 truncate font-display text-lg font-semibold">{climber.name}</span>
            <span className="flex h-7 flex-1 overflow-hidden rounded-lg" style={{ background: LANE }}>
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
}: {
  round: LeaderboardRound;
  unit: { singular: string; plural: string };
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
        title={`${unit.singular.charAt(0).toUpperCase()}${unit.singular.slice(1)} a ${unit.singular}`}
        hint="Cómo cambió la tabla a lo largo de la competencia. Cuando dos líneas se cruzan, alguien pasó a la otra."
      >
        <BumpChart round={round} hovered={hovered} onHover={onHover} />
        <p className="mt-4 text-base text-muted">
          Izquierda: los puestos al empezar la ronda. Derecha: como van ahora. Abajo, cuántos intentos
          llevaba juzgados la categoría entera — al principio casi nadie ha escalado y por eso muchas
          empatan.
        </p>
      </Panel>

      <div className={`grid grid-cols-1 gap-6 ${hasAttemptsPerTop ? 'xl:grid-cols-[3fr_2fr]' : ''}`}>
        <Panel title={`¿Qué tan duros estaban los ${unit.plural}?`} hint={`Desempeño en cada ${unit.singular}.`}>
          <div className="mb-5 flex flex-wrap items-center gap-5 text-sm text-muted">
            <Swatch color={GOLD} label={SCORE_TERM.top} />
            {!isHeight && <Swatch color={PINE} label={SCORE_TERM.zone} />}
          </div>
          <Wall round={round} unit={unit.singular} isHeight={isHeight} />
        </Panel>

        {hasAttemptsPerTop && (
          <Panel title="Cuántos intentos al top" hint="Promedio de intentos para alcanzar el top.">
            <AttemptsPerTop round={round} hovered={hovered} onHover={onHover} />
          </Panel>
        )}
      </div>
    </div>
  );
}
