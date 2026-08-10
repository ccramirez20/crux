'use client';

import type { LeaderboardRound, LeaderboardRow } from '@/lib/leaderboard';

// Two hues carry meaning and they were measured against each other, not picked
// by eye: gold↔pine is ΔE 41 in normal vision, 36 under protanopia. Páramo's
// two greens (pine↔bark) came out at 9.7 — indistinguishable — so nothing here
// asks a viewer to tell those apart. Everything else is neutral, and identity
// always arrives as a name next to the mark.
const GOLD = '#E3A83B';
const PINE = '#2F4A3E';
const MUTED = '#7A7266';
const RULE = '#E3DCC9';
const SURFACE = '#FFFFFF';

const cardClass = 'rounded-2xl border border-cardborder bg-white p-7';
const eyebrow = 'text-[11px] font-semibold uppercase tracking-[0.18em] text-muted';

function Panel({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <figure className={`${cardClass} m-0 flex flex-col`}>
      <figcaption className="mb-6">
        <h2 className="font-display text-2xl font-bold leading-tight">{title}</h2>
        <p className="mt-1 text-base text-muted">{hint}</p>
      </figcaption>
      {children}
    </figure>
  );
}

/* ------------------------------------------------------------------ tiles */

function StatTile({ label, value, detail, accent }: { label: string; value: string; detail: string; accent?: boolean }) {
  return (
    <div className={`${cardClass} flex flex-col justify-between gap-3 py-6`}>
      <span className={eyebrow}>{label}</span>
      <span
        className="font-display text-[3.25rem] font-bold leading-none tracking-tight tabular-nums"
        style={accent ? { color: GOLD } : undefined}
      >
        {value}
      </span>
      <span className="text-base text-muted">{detail}</span>
    </div>
  );
}

/**
 * The three numbers worth shouting. A stat tile beats a chart when the answer
 * is a single figure — a bar of one value is a number wearing a costume.
 */
function Headline({ round, unit, isHeight }: { round: LeaderboardRound; unit: string; isHeight: boolean }) {
  const stats = round.problemStats;
  const crux = [...stats].sort((a, b) => a.tops - b.tops)[0];
  const problemName = (id: string) => round.problems.find((p) => p.id === id)?.name;

  const totalTops = stats.reduce((sum, s) => sum + s.tops, 0);
  const totalFlashes = stats.reduce((sum, s) => sum + s.flashes, 0);

  const first = round.timeline[0];
  const last = round.timeline.at(-1);
  const climbs = round.rows
    .map((row) => ({
      name: row.athleteName,
      delta: (first?.ranks[row.registrationId] ?? 0) - (last?.ranks[row.registrationId] ?? 0),
    }))
    .sort((a, b) => b.delta - a.delta);
  const bestClimb = climbs[0];

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {crux && (
        <StatTile
          label={`El ${unit} más duro`}
          accent
          value={`${unit.slice(0, 1).toUpperCase()}${crux.number}`}
          detail={`${problemName(crux.problemId) ?? 'Sin nombre'} · lo toparon ${crux.tops} de ${crux.field}`}
        />
      )}
      {!isHeight && (
        <StatTile
          label="Tops a primer intento"
          value={totalTops > 0 ? `${Math.round((totalFlashes / totalTops) * 100)}%` : '—'}
          detail={`${totalFlashes} flash de ${totalTops} tops en la ronda`}
        />
      )}
      {bestClimb && bestClimb.delta > 0 && (
        <StatTile
          label="Mayor ascenso"
          value={`+${bestClimb.delta}`}
          detail={`${bestClimb.name} subió ${bestClimb.delta} puestos durante la ronda`}
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
    const gap = order[i]!.y - order[i - 1]!.y;
    if (gap < minGap) {
      order[i]!.y = order[i - 1]!.y + minGap;
    }
  }
  const out = [...values];
  for (const item of order) {
    out[item.index] = item.y;
  }
  return out;
}

const SHOWN_LINES = 10;

function BumpChart({ round }: { round: LeaderboardRound }) {
  const points = round.timeline;
  const shown = round.rows.slice(0, SHOWN_LINES);
  if (points.length < 2 || shown.length < 2) {
    return null;
  }

  const rankAt = (row: LeaderboardRow, point: (typeof points)[number]) =>
    point.ranks[row.registrationId] ?? shown.length;
  const maxRank = Math.max(...shown.flatMap((row) => points.map((p) => rankAt(row, p))));

  const lane = 30;
  const padTop = 26;
  const padBottom = 40;
  // Room for "10. Manuela Cifuentes" on the left and the same plus a delta
  // chip on the right. Names are the legend here, so they get the space.
  const plotLeft = 250;
  const plotRight = 830;
  const deltaX = 1230;
  const width = 1250;
  const height = padTop + (maxRank - 1) * lane + padBottom;

  const x = (index: number) => plotLeft + (index * (plotRight - plotLeft)) / (points.length - 1);
  const y = (rank: number) => padTop + (rank - 1) * lane;

  const endYs = declutter(shown.map((row) => y(rankAt(row, points.at(-1)!))), 22);
  const startYs = declutter(shown.map((row) => y(rankAt(row, points[0]!))), 22);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Puesto de cada competidor a lo largo de la ronda">
      {/* Lanes, not gridlines. A ruled grid behind every line is the thing that
          makes a chart look like a spreadsheet; alternating bands give the eye
          a track to follow without adding ink on top of the data. */}
      {Array.from({ length: maxRank }, (_, index) => index).map((row) =>
        row % 2 === 0 ? (
          <rect key={row} x={plotLeft - 22} y={y(row + 1) - lane / 2} width={plotRight - plotLeft + 44} height={lane} fill="#F4F1E6" opacity={0.6} />
        ) : null,
      )}

      {shown.map((row, index) => {
        const rank = row.result.rank;
        const color = rank === 1 ? GOLD : rank === 2 ? PINE : MUTED;
        const lead = rank <= 2;
        const path = bumpPath(points.map((point, i) => ({ x: x(i), y: y(rankAt(row, point)) })));
        const startRank = rankAt(row, points[0]!);
        const endRank = rankAt(row, points.at(-1)!);
        const delta = startRank - endRank;

        return (
          <g key={row.registrationId}>
            {/* A surface-coloured under-stroke lifts the leading lines over the
                pack where they cross instead of dissolving into it. */}
            {lead && <path d={path} fill="none" stroke={SURFACE} strokeWidth={9} strokeLinecap="round" />}
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth={lead ? 4 : 2}
              strokeLinecap="round"
              opacity={lead ? 1 : 0.4}
            />
            <circle cx={x(points.length - 1)} cy={y(endRank)} r={lead ? 7 : 5} fill={color} stroke={SURFACE} strokeWidth={2} opacity={lead ? 1 : 0.55} />

            <text x={plotLeft - 30} y={startYs[index]! + 5} textAnchor="end" fontSize={15} fill={MUTED} opacity={lead ? 1 : 0.75}>
              {startRank}. {row.athleteName}
            </text>

            <text x={plotRight + 24} y={endYs[index]! + 5} fontSize={17} fontWeight={lead ? 700 : 500} fill={lead ? '#241F19' : MUTED}>
              {endRank}. {row.athleteName}
            </text>
            {/* Its own right-aligned column rather than trailing the name:
                measuring a string by character count puts every chip in a
                slightly different place, which reads as sloppy at this size. */}
            {delta !== 0 && (
              <text
                x={deltaX}
                y={endYs[index]! + 5}
                textAnchor="end"
                fontSize={14}
                fontWeight={600}
                fill={delta > 0 ? PINE : MUTED}
              >
                {delta > 0 ? '▲' : '▼'}
                {Math.abs(delta)}
              </text>
            )}
          </g>
        );
      })}

      <text x={plotLeft - 30} y={height - 12} textAnchor="end" fontSize={13} fill={MUTED} letterSpacing={1.4}>
        AL EMPEZAR
      </text>
      <text x={plotRight + 24} y={height - 12} fontSize={13} fill={MUTED} letterSpacing={1.4}>
        AHORA · {points.at(-1)!.attempts} INTENTOS
      </text>
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
      {stats.map((stat, index) => {
        const topPct = (stat.tops / stat.field) * 100;
        const zonePct = (stat.zones / stat.field) * 100;
        return (
          <li key={stat.problemId} className="flex items-center gap-5">
            <span className="w-36 shrink-0">
              <span className="block font-display text-xl font-bold leading-tight">
                {unit.slice(0, 1).toUpperCase()}
                {stat.number}
                {index === 0 && <span className="ml-2 align-middle text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">crux</span>}
              </span>
              <span className="block truncate text-sm text-muted">{problemName(stat.problemId) ?? '—'}</span>
            </span>

            <span className="relative flex h-9 flex-1 overflow-hidden rounded-lg" style={{ background: '#F4F1E6' }}>
              <span className="h-full" style={{ width: `${topPct}%`, background: GOLD }} />
              {/* 2px of surface between fills so two adjacent segments never
                  read as one longer bar. */}
              {zonePct > 0 && <span className="h-full" style={{ width: 2, background: SURFACE }} />}
              <span className="h-full" style={{ width: `${zonePct}%`, background: PINE }} />
            </span>

            <span className="w-40 shrink-0 text-right">
              <span className="block font-display text-2xl font-bold leading-none tabular-nums">
                {stat.tops}
                <span className="text-lg font-semibold text-muted">/{stat.field}</span>
              </span>
              <span className="block text-sm text-muted">
                {isHeight ? 'llegaron al top' : `${stat.flashes} a primer intento`}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ----------------------------------------------------------- efficiency */

/**
 * Tops against the attempts they cost. Up and to the left is a clean round;
 * far right is someone who got there by grinding. Two climbers on the same
 * number of tops sit at different places here, and that difference is exactly
 * what the tiebreak columns are arguing about.
 */
function Efficiency({ round }: { round: LeaderboardRound }) {
  const dots = round.rows.flatMap((row) =>
    row.result.format === 'classic_tops_zones' && row.result.tops > 0
      ? [{ name: row.athleteName, rank: row.result.rank, tops: row.result.tops, tries: row.result.topAttempts }]
      : [],
  );
  if (dots.length < 3) {
    return null;
  }

  const maxTries = Math.max(...dots.map((d) => d.tries));
  const maxTops = Math.max(...dots.map((d) => d.tops));
  const width = 520;
  const height = 330;
  const left = 46;
  const bottom = height - 44;
  // Headroom for the podium labels, which sit above their dot and would
  // otherwise be sliced off by the top edge of the viewBox.
  const top = 46;
  const right = width - 46;

  const px = (tries: number) => left + (tries / maxTries) * (right - left);
  const py = (tops: number) => bottom - (tops / maxTops) * (bottom - top);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Tops contra intentos usados por competidor">
      {Array.from({ length: maxTops }, (_, index) => index + 1).map((tops) => (
        <g key={tops}>
          <line x1={left} y1={py(tops)} x2={right} y2={py(tops)} stroke={RULE} strokeWidth={1} strokeDasharray="2 5" />
          <text x={left - 12} y={py(tops) + 5} textAnchor="end" fontSize={14} fill={MUTED}>
            {tops}
          </text>
        </g>
      ))}
      <line x1={left} y1={bottom} x2={right} y2={bottom} stroke={RULE} strokeWidth={1.5} />

      {dots.map((dot) => {
        const lead = dot.rank <= 3;
        return (
          <g key={dot.name}>
            <circle
              cx={px(dot.tries)}
              cy={py(dot.tops)}
              r={lead ? 9 : 7}
              fill={dot.rank === 1 ? GOLD : lead ? PINE : MUTED}
              opacity={lead ? 1 : 0.35}
              stroke={SURFACE}
              strokeWidth={2}
            />
            {lead && (
              <text
                x={px(dot.tries)}
                y={py(dot.tops) - 16}
                // Anchored inward near the edges so a name never runs off the card.
                textAnchor={px(dot.tries) > right - 60 ? 'end' : px(dot.tries) < left + 60 ? 'start' : 'middle'}
                fontSize={14}
                fontWeight={700}
                fill="#241F19"
              >
                {dot.name.split(' ')[0]}
              </text>
            )}
          </g>
        );
      })}

      <text x={left} y={height - 12} fontSize={13} fill={MUTED} letterSpacing={1.2}>
        ← MENOS INTENTOS
      </text>
      <text x={right} y={height - 12} textAnchor="end" fontSize={13} fill={MUTED} letterSpacing={1.2}>
        MÁS INTENTOS →
      </text>
    </svg>
  );
}

/* -------------------------------------------------------------- assembly */

export function LeaderboardCharts({
  round,
  unit,
}: {
  round: LeaderboardRound;
  unit: { singular: string; plural: string };
}) {
  if (round.timeline.length === 0) {
    return null;
  }
  const isHeight = round.rows[0]?.result.format === 'max_height';
  // Only classic_tops_zones carries the tops/attempts pair the scatter plots;
  // every other format would be an empty box asking for space.
  const hasEfficiency =
    round.rows.filter((r) => r.result.format === 'classic_tops_zones' && r.result.tops > 0).length >= 3;

  return (
    <div className="flex flex-col gap-6">
      <Headline round={round} unit={unit.singular} isHeight={isHeight} />

      <Panel
        title="La carrera"
        hint="El puesto de cada competidor a lo largo de la ronda. Cuando dos líneas se cruzan, alguien adelantó."
      >
        <BumpChart round={round} />
      </Panel>

      <div className={`grid grid-cols-1 gap-6 ${hasEfficiency ? 'xl:grid-cols-[3fr_2fr]' : ''}`}>
        <Panel title="El muro" hint={`Qué tan duro salió cada ${unit.singular}, del más duro al más amable.`}>
          <div className="mb-5 flex flex-wrap items-center gap-5 text-sm text-muted">
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-sm" style={{ background: GOLD }} aria-hidden />
              Toparon
            </span>
            {!isHeight && (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-sm" style={{ background: PINE }} aria-hidden />
                Llegaron a zona
              </span>
            )}
          </div>
          <Wall round={round} unit={unit.singular} isHeight={isHeight} />
        </Panel>

        {hasEfficiency && (
          <Panel title="Quién fue más limpio" hint="Tops logrados contra intentos gastados en lograrlos.">
            <Efficiency round={round} />
          </Panel>
        )}
      </div>
    </div>
  );
}
