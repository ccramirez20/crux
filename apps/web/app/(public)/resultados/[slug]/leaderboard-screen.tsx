'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import type { RankedResult } from '@crux/scoring';
import { TopographicMotif } from '@/components/topographic-motif';
import { DISCIPLINE_LABEL, ROUND_TYPE_LABEL, formatEventDate, labelFor, problemUnit } from '@/lib/labels';
import type { LeaderboardCategory, LeaderboardPayload, LeaderboardRound, LeaderboardRow } from '@/lib/leaderboard';
import { LeaderboardCharts } from './leaderboard-charts';

const REFRESH_MS = 5000;

// Headers per format. Splitting classic into four columns is the whole point:
// those four *are* the tiebreak order, so someone arguing a placing reads the
// reason off the wall instead of asking the organizer.
const SCORE_HEADERS: Record<string, string[]> = {
  classic_tops_zones: ['Tops', 'Int. top', 'Zonas', 'Int. zona'],
  ifsc_boulder: ['Puntaje'],
  league_points: ['Puntaje'],
  max_height: ['Altura'],
};

function scoreCells(result: RankedResult): string[] {
  switch (result.format) {
    case 'classic_tops_zones':
      return [result.tops, result.topAttempts, result.zones, result.zoneAttempts].map(String);
    case 'ifsc_boulder':
      return [result.score.toFixed(1)];
    case 'league_points':
      return [String(result.score)];
    case 'max_height':
      return [result.top ? 'TOP' : result.height > 0 ? `${result.height} m` : '—'];
  }
}

/** The most advanced round that has been judged — what the room wants to see when it walks in. */
function defaultRound(category: LeaderboardCategory | undefined): string | null {
  if (!category || category.rounds.length === 0) {
    return null;
  }
  const judged = category.rounds.filter((r) => r.rows.some((row) => row.cells.length > 0));
  return (judged.at(-1) ?? category.rounds[0]!).id;
}

// Category and round are two different axes, so they don't get the same
// colour — otherwise two rows of identical dark pills read as one long list of
// filters and nobody can tell which is which from across the room.
function pillClass(active: boolean, tone: 'category' | 'round'): string {
  const activeClass = tone === 'category' ? 'bg-pine text-white' : 'bg-bark text-white';
  return `rounded-full px-6 py-2.5 font-display text-lg font-semibold transition ${
    active ? activeClass : 'border-[1.5px] border-cardborder text-muted hover:border-pine hover:text-pine'
  }`;
}

/**
 * One block, one glance. A column per block rather than a strip of anonymous
 * chips: the header row names which block each mark belongs to, which is the
 * difference between a scoreboard and a row of decorations.
 */
function BlockBadge({ cell, isHeight }: { cell: LeaderboardRow['cells'][number] | undefined; isHeight: boolean }) {
  const base = 'inline-flex h-12 min-w-12 items-center justify-center rounded-lg px-2 font-display text-lg font-bold';
  // Nothing captured yet reads differently from captured-and-failed: the first
  // is an empty slot, the second is a result. Both have to be visible from the
  // back of the room, or an unjudged block looks like a zero.
  if (!cell) {
    return <span className={`${base} border-2 border-dashed border-cardborder text-muted`}>·</span>;
  }
  if (isHeight) {
    return cell.top ? (
      <span className={`${base} bg-gold text-ink`}>TOP</span>
    ) : (
      <span className={`${base} bg-pine text-white`}>{cell.height ?? '·'}</span>
    );
  }
  if (cell.top) {
    return <span className={`${base} bg-gold text-ink`}>{cell.topAttempts ?? 1}</span>;
  }
  if (cell.zone) {
    return <span className={`${base} bg-sage text-ink`}>{cell.zoneAttempts ?? 1}</span>;
  }
  return <span className={`${base} bg-stone text-muted`}>—</span>;
}

function RowDetail({ round, row, unit, isHeight }: { round: LeaderboardRound; row: LeaderboardRow; unit: string; isHeight: boolean }) {
  return (
    <ul className="flex flex-wrap gap-3 px-6 pb-6">
      {round.problems.map((problem) => {
        const cell = row.cells.find((c) => c.problemId === problem.id);
        let said = 'Sin registro';
        if (cell?.top) {
          said = isHeight ? 'Llegó al top' : `Top en ${cell.topAttempts ?? 1}`;
        } else if (cell?.zone) {
          said = `Zona en ${cell.zoneAttempts ?? 1}`;
        } else if (cell && cell.height !== null) {
          said = `${cell.height} m`;
        } else if (cell) {
          said = 'Sin zona';
        }
        return (
          <li key={problem.id} className="rounded-lg border border-cardborder bg-white px-4 py-3">
            <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              {unit} {problem.number}
              {problem.name ? ` · ${problem.name}` : ''}
            </span>
            <span className="font-display text-xl font-semibold">{said}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function LeaderboardScreen({ initial, slug }: { initial: LeaderboardPayload; slug: string }) {
  const [data, setData] = useState(initial);
  const [categoryId, setCategoryId] = useState<string | null>(initial.categories[0]?.id ?? null);
  const [roundId, setRoundId] = useState<string | null>(defaultRound(initial.categories[0]));
  const [openRow, setOpenRow] = useState<string | null>(null);

  // Decision #4: poll a cached response, no sockets. A hidden tab is a laptop
  // lid closed next to the projector — no reason to keep asking, but the
  // moment it comes back it has to catch up rather than wait out a tick.
  useEffect(() => {
    const controller = new AbortController();

    const refresh = async () => {
      if (document.hidden) {
        return;
      }
      try {
        const response = await fetch(`/api/resultados/${slug}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (response.ok) {
          setData((await response.json()) as LeaderboardPayload);
        }
      } catch {
        // Wifi at a gym drops. Keep the last standings on screen and try again
        // on the next tick — a blank wall is worse than a five-second-old one.
      }
    };

    const id = setInterval(refresh, REFRESH_MS);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', refresh);
      controller.abort();
    };
  }, [slug]);

  // Selections survive a refresh by id, and fall back if the organizer removed
  // whatever was selected while the screen was up.
  const category = data.categories.find((c) => c.id === categoryId) ?? data.categories[0];
  const round = category?.rounds.find((r) => r.id === roundId) ?? category?.rounds.find((r) => r.id === defaultRound(category));

  const unit = useMemo(() => problemUnit(data.event.discipline), [data.event.discipline]);
  const isHeight = data.event.scoringFormat === 'max_height';
  const headers = SCORE_HEADERS[data.event.scoringFormat] ?? [];
  const date = formatEventDate(data.event.date);
  const headerClass = 'px-4 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-muted';

  return (
    <main className="min-h-screen px-10 py-8">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-7">
        <header className="flex flex-col gap-4">
          <TopographicMotif />
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="font-display text-6xl font-bold leading-none">{data.event.name}</h1>
              <p className="mt-2 text-xl text-muted">
                {labelFor(DISCIPLINE_LABEL, data.event.discipline)}
                {date ? ` · ${date}` : ''}
              </p>
            </div>
            <p
              className="flex items-center gap-2.5 font-display text-lg font-semibold text-pine"
              suppressHydrationWarning
            >
              <span className="h-3 w-3 animate-pulse rounded-full bg-gold" aria-hidden />
              En vivo · {new Date(data.updatedAt).toLocaleTimeString('es-CO')}
            </p>
          </div>
        </header>

        {data.categories.length === 0 ? (
          <p className="text-2xl text-muted">Este evento todavía no tiene categorías.</p>
        ) : (
          <>
            <nav className="flex flex-wrap items-center gap-2">
              {data.categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCategoryId(c.id);
                    setRoundId(defaultRound(c));
                    setOpenRow(null);
                  }}
                  className={pillClass(c.id === category?.id, 'category')}
                >
                  {c.name}
                </button>
              ))}
              {category && category.rounds.length > 0 && (
                <>
                  <span className="mx-2 h-8 w-px bg-cardborder" aria-hidden />
                  {category.rounds.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setRoundId(r.id);
                        setOpenRow(null);
                      }}
                      className={pillClass(r.id === round?.id, 'round')}
                    >
                      {labelFor(ROUND_TYPE_LABEL, r.type)}
                    </button>
                  ))}
                </>
              )}
            </nav>

            {!round ? (
              <p className="text-2xl text-muted">Esta categoría todavía no tiene rondas.</p>
            ) : round.error ? (
              <p className="text-2xl text-bark">{round.error}</p>
            ) : round.problems.length === 0 ? (
              <p className="text-2xl text-muted">Esta ronda todavía no tiene {unit.plural}.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-cardborder bg-white">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b-2 border-cardborder">
                      <th className={`${headerClass} w-28`}>Puesto</th>
                      <th className={headerClass}>Competidor</th>
                      {round.problems.map((problem) => (
                        <th
                          key={problem.id}
                          className={`${headerClass} w-24 text-center`}
                          title={problem.name ?? undefined}
                        >
                          {unit.singular.slice(0, 1).toUpperCase()}
                          {problem.number}
                        </th>
                      ))}
                      {headers.map((header) => (
                        <th key={header} className={`${headerClass} text-right`}>
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {round.rows.map((row) => {
                      const open = openRow === row.registrationId;
                      // The leader is the one thing the room looks for from the
                      // back of the gym; everything else it reads by walking up.
                      const leading = row.result.rank === 1;
                      return (
                        <Fragment key={row.registrationId}>
                          <tr
                            onClick={() => setOpenRow(open ? null : row.registrationId)}
                            className={`cursor-pointer border-b border-cardborder/60 transition hover:bg-stone ${
                              leading ? 'bg-gold/10' : ''
                            }`}
                          >
                            <td className={`px-4 py-5 ${leading ? 'border-l-4 border-gold' : ''}`}>
                              <span
                                className="font-display text-5xl font-bold tabular-nums"
                                title={row.result.tied ? 'Empate' : undefined}
                              >
                                {row.result.tied ? '=' : ''}
                                {row.result.rank}
                              </span>
                            </td>
                            <td className="px-4 py-5">
                              <span className="font-display text-3xl font-semibold">{row.athleteName}</span>
                              {row.bibNumber && (
                                <span className="ml-3 text-xl text-muted tabular-nums">#{row.bibNumber}</span>
                              )}
                            </td>
                            {round.problems.map((problem) => (
                              <td key={problem.id} className="px-4 py-5 text-center">
                                <BlockBadge
                                  cell={row.cells.find((c) => c.problemId === problem.id)}
                                  isHeight={isHeight}
                                />
                              </td>
                            ))}
                            {scoreCells(row.result).map((value, index) => (
                              <td
                                key={headers[index] ?? index}
                                className={`px-4 py-5 text-right tabular-nums ${
                                  index === 0
                                    ? 'font-display text-4xl font-bold'
                                    : 'font-display text-2xl text-muted'
                                }`}
                              >
                                {value}
                              </td>
                            ))}
                          </tr>
                          {open && (
                            <tr className="border-b border-cardborder/60 bg-stone">
                              <td colSpan={2 + round.problems.length + headers.length}>
                                <RowDetail round={round} row={row} unit={unit.singular} isHeight={isHeight} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-base text-muted">
              Toca una fila para ver el detalle {unit.singular} por {unit.singular}.
            </p>

            {round && !round.error && <LeaderboardCharts round={round} unit={unit} />}
          </>
        )}
      </div>
    </main>
  );
}
