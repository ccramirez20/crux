'use client';

import Link from 'next/link';
import { Fragment, useMemo, useState } from 'react';
import type { RankedResult } from '@crux/scoring';
import { TopographicMotif } from '@/components/topographic-motif';
import {
  DISCIPLINE_LABEL,
  ROUND_TYPE_LABEL,
  SCORE_TERM,
  attemptSummary,
  formatEventDate,
  labelFor,
  problemUnit,
} from '@/lib/labels';
import type {
  LeaderboardCategory,
  LeaderboardPayload,
  LeaderboardRound,
  LeaderboardRow,
  SiblingEvents,
} from '@/lib/leaderboard';
import { liveState } from '@/lib/live-status';
import { brandWordClass } from '@/lib/ui';
import { useLeaderboard } from '@/lib/use-leaderboard';
import { LeaderboardCharts, hoverHandlers } from './leaderboard-charts';

// Headers per format. Splitting classic into four columns is the whole point:
// those four *are* the tiebreak order, so someone arguing a placing reads the
// reason off the wall instead of asking the organizer.
//
// Van en pares con una divisoria entre ellos: la línea es la que separa, no un
// piso extra de títulos. Dos filas de encabezado engordaban la tabla a lo ancho
// sin decir nada que "Tops · Intentos | Zonas · Intentos" no diga en una.
export const SCORE_HEADERS: Record<string, string[][]> = {
  classic_tops_zones: [
    ['Tops', 'Intentos'],
    ['Zonas', 'Intentos'],
  ],
  ifsc_boulder: [['Puntaje']],
  league_points: [['Puntaje']],
  max_height: [['Altura']],
};

// Los mismos números, rotulados para la tarjeta del teléfono. Ahí no existe el
// grupo de columnas que en la tabla desambigua las dos "Intentos": una debajo
// de la otra se leían como el mismo dato repetido, y nadie podía saber cuál era
// de tops y cuál de zonas. Cada cifra dice a qué se refiere o no sirve.
const CARD_LABELS: Record<string, string[]> = {
  classic_tops_zones: ['Tops', 'Intentos a top', 'Zonas', 'Intentos a zona'],
  ifsc_boulder: ['Puntaje'],
  league_points: ['Puntaje'],
  max_height: ['Altura'],
};

export function scoreCells(result: RankedResult): string[] {
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

/**
 * El 1-2-3 en oro, plata y bronce — pero solo donde el puesto ya es podio.
 *
 * El recuadro dorado del líder contesta la pregunta con la que entra toda la
 * sala: quién va ganando. Esa pregunta vale en cualquier ronda y a cualquier
 * hora, incluso con dos bloques capturados.
 *
 * La plata y el bronce dicen otra cosa —quién se subió al podio— y en una
 * clasificatoria eso todavía no existe: ahí el segundo pasa a la siguiente
 * ronda igual que el octavo, y pintarlo de plata anunciaría un resultado que no
 * ha ocurrido. Por eso las tres medallas salen **solo en una final**.
 *
 * Y solo en una final, no "cuando la categoría tiene una sola ronda", que fue
 * el primer intento: eso adivina la intención a partir de cuántas rondas
 * alcanzó a crear el organizador, y durante el evento eso miente. Una
 * clasificatoria a la que todavía no le han agregado la final es exactamente
 * una categoría de una sola ronda, y ahí es donde el podio engaña. La intención
 * ya está dicha en un dato que el organizador escribe a mano: el tipo de ronda.
 * Quien corre una liga de una sola ronda la crea como final y tiene su podio.
 *
 * Los tres colores son los mismos de las gráficas y ya estaban validados como
 * tripleta contra la superficie de tarjeta.
 */
export function podiumStyle(rank: number, isPodiumRound: boolean): { row: string; rail: string } | null {
  if (rank === 1) {
    return { row: 'bg-gold/10', rail: 'border-l-4 border-gold' };
  }
  if (!isPodiumRound) {
    return null;
  }
  if (rank === 2) {
    return { row: 'bg-silver/10', rail: 'border-l-4 border-silver' };
  }
  if (rank === 3) {
    return { row: 'bg-bronze/10', rail: 'border-l-4 border-bronze' };
  }
  return null;
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
export function BlockBadge({
  cell,
  isHeight,
  // En proyección la insignia se encoge con la cantidad de gente: la categoría
  // entera tiene que caber en el alto de la pantalla.
  className = 'h-12 min-w-12 text-lg',
}: {
  cell: LeaderboardRow['cells'][number] | undefined;
  isHeight: boolean;
  className?: string;
}) {
  const base = `inline-flex items-center justify-center rounded-lg px-2 font-display font-bold ${className}`;
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

/**
 * La misma fila, para un teléfono. Medido a 390 px: la tabla mide 1247 px de
 * ancho y la caja que la contiene 308, así que de once columnas se ven dos y
 * media — puesto y un nombre cortado. Congelar el puntaje salva la cifra, pero
 * no arregla que la tabla esté dimensionada para una pared: nombres de 30 px,
 * insignias de 48, cuatro columnas de puntaje de 96.
 *
 * No es menos información, es la misma en vertical: puesto, nombre, la cifra
 * que manda, los {unit.plural} uno por uno, y el desempate en una línea de
 * texto en vez de tres columnas que no caben. Se toca igual que la fila para
 * abrir el detalle y para resaltarla en las gráficas.
 */
function ResultCard({
  row,
  round,
  labels,
  unit,
  isHeight,
  isPodiumRound,
  open,
  dimmed,
  onToggle,
}: {
  row: LeaderboardRow;
  round: LeaderboardRound;
  labels: string[];
  unit: { singular: string; plural: string };
  isHeight: boolean;
  isPodiumRound: boolean;
  open: boolean;
  dimmed: boolean;
  onToggle: () => void;
}) {
  const podium = podiumStyle(row.result.rank, isPodiumRound);
  // El filete de la tarjeta usa el mismo color de la medalla que la fila de la
  // tabla usa en su borde izquierdo.
  const border =
    row.result.rank === 1 && podium
      ? 'border-gold'
      : row.result.rank === 2 && podium
        ? 'border-silver'
        : row.result.rank === 3 && podium
          ? 'border-bronze'
          : 'border-cardborder';
  const values = scoreCells(row.result);

  return (
    // El detalle vive fuera del <button> a propósito: trae el enlace al
    // historial, y un <a> dentro de un <button> es marcado inválido. Es la
    // misma razón por la que en la tabla el detalle es un <tr> aparte.
    <li
      className={`overflow-hidden rounded-xl border-2 transition ${border} ${
        podium?.row ?? 'bg-card'
      } ${dimmed ? 'opacity-60' : ''}`}
    >
      <button type="button" onClick={onToggle} className="w-full px-3 py-3 text-left">
        <div className="flex items-center gap-3">
          {/* `min-w` y no `w`: con dos dígitos el puesto ya roza el nombre, y
              una categoría de tres cifras lo encimaría. Así crece solo. */}
          <span className="min-w-11 shrink-0 text-center font-display text-4xl font-bold leading-none tabular-nums">
            {row.result.tied ? '=' : ''}
            {row.result.rank}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-xl font-semibold">{row.athleteName}</span>
            {row.bibNumber && (
              <span className="text-sm text-muted tabular-nums">#{row.bibNumber}</span>
            )}
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              {labels[0]}
            </span>
            <span className="font-display text-3xl font-bold leading-none tabular-nums">
              {values[0]}
            </span>
          </span>
        </div>

        {/* Grid y no `flex flex-wrap`: envolver empaqueta las insignias a la
            izquierda y la última fila queda coja. Con columnas de ancho igual,
            diez bloques se parten en dos filas parejas. */}
        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-1.5">
          {round.problems.map((problem) => (
            <span key={problem.id} className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                {unit.singular.slice(0, 1).toUpperCase()}
                {problem.number}
              </span>
              <BlockBadge
                cell={row.cells.find((c) => c.problemId === problem.id)}
                isHeight={isHeight}
              />
            </span>
          ))}
        </div>

        {/* El desempate, cada cifra con su rótulo encima — igual que la cifra
            grande de arriba. En una sola línea de texto corrido ("Intentos 12 ·
            Zonas 5 · Intentos 9") los dos "Intentos" se leían como el mismo
            dato dos veces, y no había forma de saber cuál era de tops y cuál de
            zonas. En la tabla eso lo resuelve la divisoria entre los grupos;
            aquí, el rótulo entero. */}
        {values.length > 1 && (
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-cardborder/60 pt-2.5">
            {labels.slice(1).map((label, index) => (
              <span key={label} className="flex flex-col gap-0.5">
                {/* Alto de dos renglones aunque el rótulo ocupe uno: "Zonas"
                    cabe en una línea y "Intentos a top" no, y sin esto las tres
                    cifras quedaban a tres alturas distintas. */}
                <span className="min-h-[2.5em] text-[10px] font-semibold uppercase leading-tight tracking-[0.1em] text-muted">
                  {label}
                </span>
                <span className="font-display text-xl font-bold leading-none tabular-nums">
                  {values[index + 1]}
                </span>
              </span>
            ))}
          </div>
        )}
      </button>
      {open && <RowDetail round={round} row={row} unit={unit.singular} isHeight={isHeight} />}
    </li>
  );
}

function RowDetail({
  round,
  row,
  unit,
  isHeight,
}: {
  round: LeaderboardRound;
  row: LeaderboardRow;
  unit: string;
  isHeight: boolean;
}) {
  return (
    <ul className="flex flex-wrap items-center gap-3 px-6 pb-6 pt-5">
      {round.problems.map((problem) => {
        const cell = row.cells.find((c) => c.problemId === problem.id);
        return (
          <li key={problem.id} className="rounded-lg border border-cardborder bg-card px-4 py-3">
            <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              {unit} {problem.number}
              {problem.name ? ` · ${problem.name}` : ''}
            </span>
            <span className="font-display text-xl font-semibold">{attemptSummary(cell, isHeight)}</span>
          </li>
        );
      })}
      {/* El enlace vive aquí y no en la fila: la fila entera abre y cierra este
          panel, así que un enlace ahí adentro tendría que pelear con ese click.
          Este <tr> no tiene handler. */}
      {row.athleteId && (
        <li>
          <a
            href={`/competidor/${row.athleteId}`}
            className="font-display text-lg font-semibold text-pine underline decoration-gold decoration-2 underline-offset-4"
          >
            Ver historial de {row.athleteName} →
          </a>
        </li>
      )}
    </ul>
  );
}

export function LeaderboardScreen({
  initial,
  slug,
  siblings,
}: {
  initial: LeaderboardPayload;
  slug: string;
  siblings: SiblingEvents;
}) {
  const data = useLeaderboard(slug, initial);
  const [categoryId, setCategoryId] = useState<string | null>(initial.categories[0]?.id ?? null);
  const [roundId, setRoundId] = useState<string | null>(defaultRound(initial.categories[0]));
  const [openRow, setOpenRow] = useState<string | null>(null);
  // Señalar a una atleta la resalta en todo a la vez: su fila, su línea en la
  // gráfica de posiciones y su barra de intentos. Vive aquí y no dentro de una
  // gráfica porque lo comparten tres piezas hermanas.
  const [hovered, setHovered] = useState<string | null>(null);
  // Resaltar desde una gráfica es otra cosa que abrir el detalle, y por eso son
  // dos estados. Antes tocar una línea abría la fila allá arriba en la tabla:
  // la página crecía de golpe bajo el dedo y lo que estabas mirando se iba de
  // pantalla. Ahora tocar una gráfica solo resalta, y el detalle se abre
  // tocando la fila o la tarjeta, que es donde el detalle aparece.
  const [selected, setSelected] = useState<string | null>(null);
  const focused = hovered ?? selected ?? openRow;
  const toggleRow = (registrationId: string) =>
    setOpenRow((current) => (current === registrationId ? null : registrationId));
  const toggleSelected = (registrationId: string) =>
    setSelected((current) => (current === registrationId ? null : registrationId));

  // Selections survive a refresh by id, and fall back if the organizer removed
  // whatever was selected while the screen was up.
  const category = data.categories.find((c) => c.id === categoryId) ?? data.categories[0];
  const round = category?.rounds.find((r) => r.id === roundId) ?? category?.rounds.find((r) => r.id === defaultRound(category));

  const isPodiumRound = round?.type === 'final';

  const unit = useMemo(() => problemUnit(data.event.discipline), [data.event.discipline]);
  const isHeight = data.event.scoringFormat === 'max_height';
  const hasAttemptColumns = data.event.scoringFormat === 'classic_tops_zones';
  const isLeague = data.event.scoringFormat === 'league_points';
  const groups = SCORE_HEADERS[data.event.scoringFormat] ?? [];
  const headers = groups.flat();
  const cardLabels = CARD_LABELS[data.event.scoringFormat] ?? headers;
  // En qué índice arranca cada grupo: ahí van la línea divisoria y la cifra
  // grande, y las que siguen son su desempate.
  const groupStarts = new Set<number>();
  groups.reduce((index, group) => {
    groupStarts.add(index);
    return index + group.length;
  }, 0);
  const date = formatEventDate(data.event.date);
  const headerClass = 'px-4 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-muted';
  // Ancho fijo y centrado: la cifra se lee bajo su propio título, y sin el tope
  // de ancho estas cuatro columnas estiraban la tabla a lo ancho de la pantalla
  // sin necesitarlo.
  const scoreCellClass = 'w-24 px-3 text-center';

  // La cifra por la que se abre esta tabla se queda pegada al borde derecho.
  // Medido en producción a 390 px: la caja con scroll da 308 px y la tabla
  // 1247, así que el puntaje nace fuera de pantalla y llegar a él cuesta perder
  // de vista el nombre. Fondo propio porque una celda pegajosa transparente
  // deja pasar los bloques por debajo, y filete en sombra y no en `border`:
  // con `border-collapse` el borde de una celda pegajosa no viaja con ella.
  const stickyScoreClass =
    'sticky right-0 z-[1] bg-card shadow-[-10px_0_10px_-10px_rgba(36,31,25,0.25)]';

  return (
    // `px-10` a ambos lados se comía 80 de los 390 px de un teléfono: una
    // cuarta parte de la pantalla en margen, justo donde falta ancho.
    <main className="min-h-screen px-4 py-8 sm:px-10">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-7">
        <header className="flex flex-col gap-4">
          <TopographicMotif />
          {/* La marca, bajo las líneas y sobre el nombre del evento, igual que
              en el resto de pantallas. Esta es la que se proyecta a toda la
              sala y la que más gente ve, y era la única sin nombrarnos. */}
          <span className="font-display text-lg font-bold tracking-[0.2em] text-pine">CRUX</span>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex items-center gap-5">
              {data.event.organizationLogo && (
                // eslint-disable-next-line @next/next/no-img-element -- logo remoto de Vercel Blob, no un asset que next/image pueda optimizar
                <img
                  src={data.event.organizationLogo}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-lg object-contain"
                />
              )}
              <div>
                <h1 className="font-display text-6xl font-bold leading-none">{data.event.name}</h1>
                <p className="mt-2 text-xl text-muted">
                  {labelFor(DISCIPLINE_LABEL, data.event.discipline)}
                  {date ? ` · ${date}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-5">
              {/* El modo proyección se ofrece desde aquí y no solo desde el
                  panel: quien conecta el portátil al proyector el día del
                  evento suele tener abierta esta pantalla, no la del
                  organizador. Oculto en el teléfono: proyectar desde un
                  teléfono no existe. */}
              <Link
                href={`/resultados/${slug}/proyectar`}
                className="hidden font-display text-base font-semibold text-pine underline decoration-gold decoration-2 underline-offset-4 lg:inline"
              >
                Proyectar →
              </Link>
            <p className="flex items-center gap-2.5 font-display text-lg font-semibold text-pine">
              {/* Sin un estado de evento explícito en el modelo, esto se
                  infiere de cuándo se capturó algo por última vez (ver
                  lib/live-status.ts): nadie ha capturado nada todavía, alguien
                  capturó hace poco, o ya pasó rato sin que nadie capture — en
                  vez de mentir con un punto pulsando sobre un evento que no ha
                  empezado o que ya terminó hace meses. */}
              {liveState(data.lastActivityAt, new Date(data.updatedAt)) === 'live' ? (
                <>
                  <span className="h-3 w-3 animate-pulse rounded-full bg-gold" aria-hidden />
                  {/* Dos cosas, las dos necesarias para que el reloj no mienta.
                      `timeZone`: sin él, el render de servidor cae en UTC y tras un
                      refresh duro la hora sale 5h adelante (el servidor de Vercel no
                      está en Bogotá). `hour12: false`: con a. m./p. m., el ICU de
                      Node y el de Chrome usan distinto carácter de espacio antes del
                      rótulo, y la hidratación falla por un texto que a la vista es
                      idéntico — eso era lo que silenciaba el `suppressHydrationWarning`
                      que vivía aquí. Sin rótulo no hay espacio que discrepar. */}
                  En vivo ·{' '}
                  {new Date(data.updatedAt).toLocaleTimeString('es-CO', {
                    timeZone: data.event.timezone,
                    hour12: false,
                  })}
                </>
              ) : (
                <>
                  <span className="h-3 w-3 rounded-full bg-cardborder" aria-hidden />
                  {liveState(data.lastActivityAt, new Date(data.updatedAt)) === 'not-started'
                    ? 'Aún no comienza'
                    : 'Resultados listos'}
                </>
              )}
            </p>
            </div>
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
              // La tabla larga se desplaza dentro de su propia caja para que el
              // encabezado pegajoso tenga contra qué pegarse. El scroll lateral
              // arranca en `sm`: por debajo no hay tabla que correr, hay
              // tarjetas, y un contenedor desplazable ahí solo serviría para
              // atrapar el gesto de deslizar.
              <div className="rounded-2xl border border-cardborder bg-card sm:overflow-x-auto lg:max-h-[80vh] lg:overflow-y-auto">
                {/* The number inside a badge is how many goes it took, and
                    nothing on screen said so — someone reading this table for
                    the first time had no way to know. The legend teaches the
                    code in the same colours the table then uses. */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-cardborder px-4 py-3 text-sm text-muted">
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded bg-gold" aria-hidden /> {SCORE_TERM.top}
                  </span>
                  {!isHeight && (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded bg-sage" aria-hidden /> {SCORE_TERM.zone}
                    </span>
                  )}
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded border-2 border-dashed border-cardborder" aria-hidden /> Sin
                    escalar
                  </span>
                  {!isHeight && <span>Los números son la cantidad de intentos.</span>}
                  {/* "Intentos" se lee como cuántas veces lo intentó, y es otra
                      cosa: la suma de los intentos que le costó cada logro. El
                      título de la columna se queda —así se llama en cualquier
                      planilla— y la frase es la que desarma la confusión.
                      Va atada a las columnas, no a la modalidad: los formatos
                      de puntaje resuelven en una sola columna y la frase
                      explicaba unas columnas que ahí no existen. */}
                  {hasAttemptColumns && (
                    <span>
                      Las columnas de intentos suman los intentos que le tomó alcanzar todos los tops y
                      todas las zonas: menos es mejor.
                    </span>
                  )}
                  {/* Los intentos siguen en las casillas porque el juez los
                      capturó y son el detalle del evento, pero aquí no puntúan.
                      Sin decirlo, un competidor lee la tabla como si sí. */}
                  {isLeague && (
                    <span>
                      Bajo cada {unit.singular}, cuánto puntúa su top y cuánto su zona; la raya es un{' '}
                      {unit.singular} donde la zona no puntúa. Los intentos no cambian el puntaje.
                    </span>
                  )}
                </div>
                <ul className="flex flex-col gap-2 p-3 sm:hidden">
                  {round.rows.map((row) => (
                    <ResultCard
                      key={row.registrationId}
                      row={row}
                      round={round}
                      labels={cardLabels}
                      unit={unit}
                      isHeight={isHeight}
                      isPodiumRound={isPodiumRound}
                      open={openRow === row.registrationId}
                      dimmed={focused !== null && focused !== row.registrationId}
                      onToggle={() => toggleRow(row.registrationId)}
                    />
                  ))}
                </ul>

                <table className="hidden w-full border-collapse text-left sm:table">
                  {/* Los títulos se quedan pegados arriba: en la fila 12 de la
                      tabla ya nadie recuerda cuál columna era cuál, y volver a
                      subir a mirar es justo lo que no se puede hacer con la
                      pantalla proyectada. */}
                  <thead className="sticky top-0 z-10 bg-card">
                    {/* The caption spans the block columns instead of perching
                        on the first one, where it read as a label for B1 alone. */}
                    <tr>
                      <th colSpan={2} />
                      <th
                        colSpan={round.problems.length}
                        className="px-4 pt-3 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-muted"
                      >
                        {unit.plural}
                      </th>
                      <th colSpan={headers.length} />
                    </tr>
                    <tr className="border-b-2 border-cardborder">
                      <th scope="col" className={`${headerClass} w-28 text-center`}>Puesto</th>
                      {/* Sin ancho fijo y sin partir el nombre: la columna mide
                          exactamente lo que mide el nombre más largo, y todo el
                          sobrante se va a los bloques en vez de quedarse aquí
                          como un hueco. */}
                      <th scope="col" className={`${headerClass} w-px whitespace-nowrap`}>Competidor</th>
                      {round.problems.map((problem) => (
                        <th
                          key={problem.id}
                          // Sin ancho fijo: son estas columnas las que se
                          // reparten el sobrante. Con el ancho clavado, la
                          // única elástica era la del competidor y todo el aire
                          // se juntaba en un hueco entre el dorsal y el primer
                          // bloque.
                          className={`${headerClass} text-center`}
                          title={problem.name ?? undefined}
                        >
                          {unit.singular.slice(0, 1).toUpperCase()}
                          {problem.number}
                          {/* En una liga los bloques no valen lo mismo, y sin
                              el precio aquí la fila es indescifrable: cinco
                              casillas doradas y un puntaje de 1600 sin nada
                              que los conecte. Con él, una casilla dorada en el
                              bloque de 600 se lee de un vistazo como seis
                              veces la del de 100.

                              Los dos números en oro y salvia serían lo elegante
                              y son ilegibles: a 11px, salvia sobre la tarjeta
                              no llega ni a 2:1 de contraste. Van en bark, y
                              cuál es cuál lo dice la leyenda. La raya es el
                              bloque sin crédito parcial: llegar a la zona ahí
                              no puntúa, y anunciarlo en el encabezado es más
                              barato que discutirlo con la tabla ya puesta. */}
                          {/* `typeof` y no `!== null`: la respuesta viene de
                              una caché de 5s, así que justo después de un
                              despliegue que agregue un campo el cliente recibe
                              un payload viejo donde este llega `undefined`. Con
                              `!== null` eso dibuja un "· —" bajo cada bloque de
                              todas las tablas del producto. */}
                          {typeof problem.topPoints === 'number' && (
                            <span className="mt-0.5 block font-display text-[11px] font-semibold tracking-normal text-bark">
                              {problem.topPoints} · {problem.zonePoints ?? '—'}
                            </span>
                          )}
                        </th>
                      ))}
                      {headers.map((header, index) => (
                        <th
                          key={index}
                          className={`${scoreCellClass} py-4 text-sm font-semibold uppercase tracking-[0.14em] text-muted ${
                            groupStarts.has(index) ? 'border-l border-cardborder/60' : ''
                          } ${index === 0 ? stickyScoreClass : ''}`}
                        >
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
                      const podium = podiumStyle(row.result.rank, isPodiumRound);
                      return (
                        <Fragment key={row.registrationId}>
                          <tr
                            onClick={() => toggleRow(row.registrationId)}
                            {...hoverHandlers(row.registrationId, setHovered)}
                            className={`cursor-pointer border-b border-cardborder/60 transition duration-200 hover:bg-stone ${
                              podium?.row ?? ''
                            } ${focused !== null && focused !== row.registrationId ? 'opacity-60' : ''}`}
                          >
                            <td className={`px-4 py-5 text-center ${podium?.rail ?? ''}`}>
                              <span
                                className="font-display text-5xl font-bold tabular-nums"
                                title={row.result.tied ? 'Empate' : undefined}
                              >
                                {row.result.tied ? '=' : ''}
                                {row.result.rank}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-5">
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
                                // Por índice: dos grupos traen una columna que
                                // se llama igual, "Intentos".
                                key={index}
                                // La cifra del grupo manda y su desempate va en
                                // gris: son cuatro números seguidos y sin esa
                                // jerarquía todos pesan igual.
                                className={`${scoreCellClass} py-5 tabular-nums ${
                                  groupStarts.has(index)
                                    ? 'border-l border-cardborder/60 font-display text-4xl font-bold'
                                    : 'font-display text-2xl text-muted'
                                } ${index === 0 ? stickyScoreClass : ''}`}
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

            {/* "Filas" solo existe de `sm` para arriba; en el teléfono son
                tarjetas. La frase sirve para las dos. */}
            <p className="text-base text-muted">
              Abre cada resultado para ver el detalle, {unit.singular} por {unit.singular}.
            </p>

            {round && !round.error && (
              <LeaderboardCharts
                round={round}
                unit={unit}
                hovered={focused}
                onHover={setHovered}
                onSelect={toggleSelected}
              />
            )}

            {/* Una fecha suelta se lee como un evento suelto. Quien llega aquí
                por un enlace de WhatsApp no tiene cómo saber que hay una Fecha
                1, ni que esto es una liga: son los otros eventos de la misma
                organización, en orden de fecha. */}
            {siblings.events.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-cardborder pt-6">
                {/* Se agrupan por organización, que es lo que de verdad las une:
                    todo evento que crea la misma cuenta cae en la misma. Por eso
                    el rótulo la nombra en vez de decir "esta liga" — una liga y
                    una copa de la misma gente son hermanas igual, y llamarlas a
                    todas fechas de una liga sería mentira. */}
                <span className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
                  Más competencias de {siblings.organization}
                </span>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  {siblings.events.map((sibling) => (
                    <a
                      key={sibling.slug}
                      href={`/resultados/${sibling.slug}`}
                      className="font-display text-lg font-semibold text-pine underline decoration-gold decoration-2 underline-offset-4"
                    >
                      {sibling.name}
                      {formatEventDate(sibling.date) && (
                        <span className="ml-2 text-base font-normal text-muted no-underline">
                          {formatEventDate(sibling.date)}
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Una línea, al final y en gris: esta pantalla es del evento, no
                nuestra. Pero es donde está toda la sala durante horas, y ahí
                está el dueño del gimnasio de al lado. */}
            {round && (
              <p className="border-t border-cardborder pt-6 text-base text-muted">
                Esta tabla la gestiona{' '}
                <a
                  href="/"
                  className={`${brandWordClass} underline decoration-gold decoration-2 underline-offset-4`}
                >
                  CRUX
                </a>
                , plataforma de competencias de escalada.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
