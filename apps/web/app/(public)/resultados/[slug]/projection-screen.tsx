'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { TopographicMotif } from '@/components/topographic-motif';
import {
  DISCIPLINE_LABEL,
  ROUND_TYPE_LABEL,
  SCORE_TERM,
  formatEventDate,
  labelFor,
  problemUnit,
} from '@/lib/labels';
import type { LeaderboardCategory, LeaderboardPayload, LeaderboardRound } from '@/lib/leaderboard';
import { brandWordClass } from '@/lib/ui';
import { useLeaderboard } from '@/lib/use-leaderboard';
import { AttemptsPerTop, BumpChart, Headline, Wall } from './leaderboard-charts';
import { BlockBadge, podiumStyle, scoreCells } from './leaderboard-screen';

/**
 * La pantalla que se proyecta a toda la sala, y nada más.
 *
 * La tabla pública ya se proyectaba, pero es una **página**: se desplaza, tiene
 * pestañas que alguien tiene que tocar y una gráfica debajo de otra. Proyectada
 * ocho horas eso significa un portátil con alguien encima. Esto es lo contrario:
 * cabe en una pantalla, no se desplaza nunca, y lo que cambia lo cambia sola.
 *
 * Se apoya entera en lo que ya existe — el mismo sondeo, las mismas gráficas,
 * el mismo cálculo. Lo único nuevo aquí es la disposición y los relojes.
 */

/** Cuánto dura cada gráfica en pantalla. */
const SLIDE_MS = {
  // La de puestos es una historia: hay que seguir una línea de un extremo al
  // otro, y eso no se hace en quince segundos desde el fondo del salón.
  bump: 30_000,
  // Las otras dos son una lista ordenada. Se leen de un vistazo.
  wall: 15_000,
  attempts: 15_000,
} as const;

/** Cada cuánto pasa a la siguiente categoría, cuando la rotación está activa. */
const CATEGORY_MS = 30_000;

/**
 * Cuánto se encoge la tabla, medido contra el alto que de verdad hay.
 *
 * Aquí no existe la opción de desplazarse: la categoría entera tiene que caber
 * o la última competidora simplemente no existe para la sala. Y el alto no se
 * puede adivinar desde el número de inscritos, que es lo que se intentó
 * primero: catorce filas caben holgadas en un proyector de 1080 y se salen por
 * abajo en el portátil de 900 que suele estar conectado a él. Así que se mide
 * el hueco y se reparte entre las filas.
 */
const TIERS = [
  { min: 70, row: 'py-3', rank: 'text-4xl', name: 'text-2xl', badge: 'h-11 min-w-11 text-lg', score: 'text-3xl' },
  { min: 54, row: 'py-2', rank: 'text-3xl', name: 'text-xl', badge: 'h-9 min-w-9 text-base', score: 'text-2xl' },
  { min: 46, row: 'py-1.5', rank: 'text-2xl', name: 'text-lg', badge: 'h-8 min-w-8 text-sm', score: 'text-xl' },
  { min: 38, row: 'py-1', rank: 'text-xl', name: 'text-base', badge: 'h-7 min-w-7 text-xs', score: 'text-lg' },
  { min: 0, row: 'py-0.5', rank: 'text-lg', name: 'text-sm', badge: 'h-6 min-w-6 text-[11px]', score: 'text-base' },
] as const;

/** Alto del encabezado de la tabla, que no es una fila y no se reparte. */
const TABLE_HEADER_PX = 30;

function useRowTier(box: React.RefObject<HTMLElement | null>, rows: number) {
  // Antes de medir se usa el tramo más apretado que probablemente sirva: así el
  // primer pintado ya sale cerca y no se ve el salto de un tamaño a otro.
  const [perRow, setPerRow] = useState(0);

  useEffect(() => {
    const measure = () => {
      const element = box.current;
      if (element && rows > 0) {
        setPerRow((element.clientHeight - TABLE_HEADER_PX) / rows);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (box.current) {
      observer.observe(box.current);
    }
    return () => observer.disconnect();
  }, [box, rows]);

  if (perRow === 0) {
    return TIERS[Math.min(Math.max(Math.floor(rows / 6), 0), TIERS.length - 1)]!;
  }
  return TIERS.find((tier) => perRow >= tier.min) ?? TIERS[TIERS.length - 1]!;
}

function ProjectedTable({
  round,
  unit,
  isHeight,
  isPodiumRound,
  scoreHeader,
}: {
  round: LeaderboardRound;
  unit: { singular: string; plural: string };
  isHeight: boolean;
  isPodiumRound: boolean;
  scoreHeader: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const scale = useRowTier(box, round.rows.length);
  const header = 'px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted';

  return (
    <div ref={box} className="h-full overflow-hidden">
    <table className="w-full border-collapse text-left">
      <thead>
        <tr>
          <th className={`${header} w-14 text-center`}>Puesto</th>
          <th className={`${header} w-px whitespace-nowrap`}>Competidor</th>
          {round.problems.map((problem) => (
            <th key={problem.id} className={`${header} text-center`}>
              {unit.singular.slice(0, 1).toUpperCase()}
              {problem.number}
            </th>
          ))}
          <th className={`${header} w-16 text-center`}>{scoreHeader}</th>
        </tr>
      </thead>
      <tbody>
        {round.rows.map((row) => {
          const podium = podiumStyle(row.result.rank, isPodiumRound);
          return (
            <tr key={row.registrationId} className={`border-b border-cardborder/60 ${podium?.row ?? ''}`}>
              <td className={`${scale.row} px-2 text-center ${podium?.rail ?? ''}`}>
                <span className={`font-display font-bold tabular-nums ${scale.rank}`}>
                  {row.result.tied ? '=' : ''}
                  {row.result.rank}
                </span>
              </td>
              <td className={`${scale.row} whitespace-nowrap px-2`}>
                <span className={`font-display font-semibold ${scale.name}`}>{row.athleteName}</span>
                {row.bibNumber && (
                  <span className="ml-2 text-sm text-muted tabular-nums">#{row.bibNumber}</span>
                )}
              </td>
              {round.problems.map((problem) => (
                <td key={problem.id} className={`${scale.row} px-1 text-center`}>
                  <BlockBadge
                    cell={row.cells.find((c) => c.problemId === problem.id)}
                    isHeight={isHeight}
                    className={scale.badge}
                  />
                </td>
              ))}
              <td className={`${scale.row} px-2 text-center`}>
                <span className={`font-display font-bold tabular-nums ${scale.score}`}>
                  {scoreCells(row.result)[0]}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}

/** Una categoría con al menos una ronda juzgada: las demás no tienen qué proyectar. */
function projectableRound(category: LeaderboardCategory): LeaderboardRound | null {
  const judged = category.rounds.filter((r) => !r.error && r.rows.some((row) => row.cells.length > 0));
  return judged.at(-1) ?? category.rounds.find((r) => !r.error && r.problems.length > 0) ?? null;
}

export function ProjectionScreen({ initial, slug }: { initial: LeaderboardPayload; slug: string }) {
  const data = useLeaderboard(slug, initial);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [rotating, setRotating] = useState(false);
  const [slide, setSlide] = useState(0);

  const unit = useMemo(() => problemUnit(data.event.discipline), [data.event.discipline]);
  const isHeight = data.event.scoringFormat === 'max_height';

  // Solo las categorías que tienen algo que mostrar. Una recién creada, sin
  // rondas, dejaría la pantalla en blanco durante treinta segundos.
  const shown = data.categories
    .map((category) => ({ category, round: projectableRound(category) }))
    .filter((entry): entry is { category: LeaderboardCategory; round: LeaderboardRound } => entry.round !== null);

  const current = shown[categoryIndex % Math.max(shown.length, 1)];

  // La rotación de categorías es un botón, no una decisión nuestra: un gimnasio
  // con una sola pared y dos categorías corriendo a la vez la quiere rotando; el
  // que compite de a una categoría por vez la quiere fija en esa.
  useEffect(() => {
    if (!rotating || shown.length < 2) {
      return;
    }
    const id = setInterval(() => setCategoryIndex((i) => (i + 1) % shown.length), CATEGORY_MS);
    return () => clearInterval(id);
  }, [rotating, shown.length]);

  const round = current?.round;
  const hasAttemptsPerTop =
    (round?.rows.filter((r) => r.result.format === 'classic_tops_zones' && r.result.tops >= 2).length ?? 0) >= 3;
  const slides = [
    round && round.timeline.length > 1 ? ('bump' as const) : null,
    round && round.problemStats.length > 0 ? ('wall' as const) : null,
    hasAttemptsPerTop ? ('attempts' as const) : null,
  ].filter((s): s is 'bump' | 'wall' | 'attempts' => s !== null);

  const activeSlide = slides[slide % Math.max(slides.length, 1)];

  // Cada gráfica se queda lo que dura leerla, así que el turno no puede ser un
  // intervalo fijo: se programa el siguiente cambio con la duración de la que
  // está en pantalla.
  useEffect(() => {
    if (slides.length < 2 || !activeSlide) {
      return;
    }
    const id = setTimeout(() => setSlide((s) => (s + 1) % slides.length), SLIDE_MS[activeSlide]);
    return () => clearTimeout(id);
  }, [activeSlide, slides.length]);

  const date = formatEventDate(data.event.date);
  const isPodiumRound = round?.type === 'final';
  const scoreHeader = isHeight ? 'Altura' : data.event.scoringFormat === 'classic_tops_zones' ? SCORE_TERM.top : 'Puntaje';

  const chartTitle = {
    bump: `Puesto ${unit.singular} a ${unit.singular}`,
    wall: `¿Qué tan duros estaban los ${unit.plural}?`,
    attempts: 'Cuántos intentos al top',
  };

  // Nadie interactúa con una pared. Las gráficas piden estos tres porque en la
  // página sirven para resaltar a alguien; aquí no hay a quién resaltar.
  const inert = { hovered: null, onHover: () => {}, onSelect: () => {} };

  return (
    // `group` para los controles: en un proyector el ratón no se mueve nunca, y
    // así no hay botones encima de la competencia. Basta mover el ratón para
    // que aparezcan.
    <main className="group flex h-screen flex-col gap-3 overflow-hidden bg-stone px-6 py-4">
      <header className="flex shrink-0 items-end justify-between gap-6">
        <div className="flex min-w-0 items-end gap-5">
          <div className="hidden w-40 shrink-0 xl:block">
            <TopographicMotif />
          </div>
          <div className="min-w-0">
            <span className={`${brandWordClass} text-sm`}>CRUX</span>
            <h1 className="truncate font-display text-4xl font-bold leading-tight">{data.event.name}</h1>
            <p className="text-base text-muted">
              {labelFor(DISCIPLINE_LABEL, data.event.discipline)}
              {date ? ` · ${date}` : ''}
              {round ? ` · ${labelFor(ROUND_TYPE_LABEL, round.type)}` : ''}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          {current && (
            <span className="rounded-full bg-pine px-5 py-2 font-display text-2xl font-bold text-white">
              {current.category.name}
            </span>
          )}
          <span className="flex items-center gap-2 font-display text-lg font-semibold text-pine">
            <span className="h-3 w-3 animate-pulse rounded-full bg-gold" aria-hidden />
            {new Date(data.updatedAt).toLocaleTimeString('es-CO', {
              timeZone: data.event.timezone,
              hour12: false,
            })}
          </span>
        </div>
      </header>

      {!round || !current ? (
        <p className="flex flex-1 items-center justify-center text-3xl text-muted">
          Todavía no hay nada capturado en este evento.
        </p>
      ) : (
        <>
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-4">
            <section className="min-h-0 overflow-hidden rounded-2xl border border-cardborder bg-card px-4 py-3">
              <ProjectedTable
                round={round}
                unit={unit}
                isHeight={isHeight}
                isPodiumRound={isPodiumRound}
                scoreHeader={scoreHeader}
              />
            </section>

            <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-cardborder bg-card px-5 py-4">
              <div className="mb-2 flex shrink-0 items-center justify-between gap-4">
                <h2 className="font-display text-2xl font-bold leading-tight">
                  {activeSlide ? chartTitle[activeSlide] : ''}
                </h2>
                {/* Los puntos dicen cuántas gráficas hay y en cuál va. Sin
                    ellos, una pantalla que cambia sola parece que se movió
                    sola. */}
                {slides.length > 1 && (
                  <span className="flex shrink-0 items-center gap-1.5">
                    {slides.map((key, index) => (
                      <span
                        key={key}
                        className={`h-2 w-2 rounded-full transition-colors duration-500 ${
                          index === slide % slides.length ? 'bg-pine' : 'bg-cardborder'
                        }`}
                      />
                    ))}
                  </span>
                )}
              </div>
              {/* `key` en el contenedor: al cambiar de gráfica React monta una
                  nueva y la animación de entrada vuelve a correr. Sin eso el
                  cambio es un salto. */}
              <div key={activeSlide} className="crux-fade min-h-0 flex-1 overflow-hidden">
                {activeSlide === 'bump' && (
                  <BumpChart
                    round={round}
                    unit={unit.singular}
                    plural={unit.plural}
                    article={unit.article}
                    className="h-full w-full"
                    {...inert}
                  />
                )}
                {activeSlide === 'wall' && <Wall round={round} unit={unit.singular} isHeight={isHeight} />}
                {activeSlide === 'attempts' && <AttemptsPerTop round={round} {...inert} />}
              </div>
            </section>
          </div>

          {/* Las tres cifras se quedan las tres en pantalla en vez de turnarse:
              caben en fila, y rotarlas escondería dos datos detrás de un
              temporizador justo cuando alguien mira la pared. */}
          <div className="shrink-0">
            <Headline round={round} unit={unit.singular} isHeight={isHeight} dense />
          </div>
        </>
      )}

      <ProjectionControls
        categories={shown.map((entry) => entry.category.name)}
        activeIndex={categoryIndex % Math.max(shown.length, 1)}
        rotating={rotating}
        onPick={(index) => {
          setRotating(false);
          setCategoryIndex(index);
        }}
        onRotate={() => setRotating((value) => !value)}
      />
    </main>
  );
}

function ProjectionControls({
  categories,
  activeIndex,
  rotating,
  onPick,
  onRotate,
}: {
  categories: string[];
  activeIndex: number;
  rotating: boolean;
  onPick: (index: number) => void;
  onRotate: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  };

  const pill = 'rounded-full px-4 py-1.5 font-display text-sm font-semibold transition';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 flex justify-center pb-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100 focus-within:opacity-100">
      <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-full border border-cardborder bg-card px-3 py-2 shadow-lg">
        {categories.map((name, index) => (
          <button
            key={name}
            type="button"
            onClick={() => onPick(index)}
            className={`${pill} ${
              !rotating && index === activeIndex
                ? 'bg-pine text-white'
                : 'border border-cardborder text-muted hover:text-pine'
            }`}
          >
            {name}
          </button>
        ))}
        {categories.length > 1 && (
          <button
            type="button"
            onClick={onRotate}
            className={`${pill} ${rotating ? 'bg-gold text-ink' : 'border border-cardborder text-muted hover:text-pine'}`}
          >
            {rotating ? 'Rotando cada 30 s' : 'Rotar categorías'}
          </button>
        )}
        <span className="mx-1 h-5 w-px bg-cardborder" aria-hidden />
        <button
          type="button"
          onClick={toggleFullscreen}
          className={`${pill} border border-pine text-pine hover:bg-pine hover:text-white`}
        >
          {fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
        </button>
      </div>
    </div>
  );
}
