'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TopographicMotif } from '@/components/topographic-motif';
import {
  DISCIPLINE_LABEL,
  ROUND_TYPE_LABEL,
  formatEventDate,
  labelFor,
  problemUnit,
} from '@/lib/labels';
import type { LeaderboardCategory, LeaderboardPayload, LeaderboardRound } from '@/lib/leaderboard';
import { brandWordClass } from '@/lib/ui';
import { useLeaderboard } from '@/lib/use-leaderboard';
import { AttemptsPerTop, BumpChart, Wall, roundHighlights } from './leaderboard-charts';
import { BlockBadge, SCORE_HEADERS, podiumStyle, scoreCells } from './leaderboard-screen';

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

/** Cuánto dura cada turno de la derecha. */
const SLIDE_MS = {
  // La de puestos es una historia: hay que seguir una línea de un extremo al
  // otro, y eso no se hace en diez segundos desde el fondo del salón.
  bump: 30_000,
  // La otra son dos listas ordenadas. Se leen de un vistazo.
  detail: 10_000,
} as const;

/** Cada cuánto pasa a la siguiente categoría, cuando la rotación está activa. */
const CATEGORY_MS = 30_000;

/** Cuánto aguantan los controles en pantalla sin que nadie mueva el ratón. */
const CONTROLS_MS = 3_000;

/**
 * La montaña de la marca: la misma silueta de las curvas de nivel, cerrada.
 * A la izquierda del nombre y en pequeño — es un sello, no una ilustración.
 */
function PeakMark() {
  return (
    <svg viewBox="0 0 48 40" className="h-11 w-14 shrink-0" aria-hidden="true">
      <path d="M4 34 L18 10 L26 22 L32 15 L44 34 Z" fill="none" stroke="#2F4A3E" strokeWidth={2.5} strokeLinejoin="round" />
      {/* La nieve en oro: es el único acento y cae en la cima, que es de donde
          sale el nombre. */}
      <path d="M12.5 24 L18 10 L23.5 18.2 L20 20 L17 17.5 Z" fill="#E3A83B" />
    </svg>
  );
}

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
  // Una final son cuatro personas en una pared entera. Sin este tramo la tabla
  // se quedaba en el tamaño de una clasificatoria de catorce y el momento más
  // importante del día se veía igual de pequeño que el resto.
  { min: 96, row: 'py-5', rank: 'text-5xl', name: 'text-3xl', badge: 'h-14 min-w-14 text-2xl', score: 'text-4xl' },
  { min: 70, row: 'py-3', rank: 'text-4xl', name: 'text-2xl', badge: 'h-11 min-w-11 text-lg', score: 'text-3xl' },
  { min: 54, row: 'py-2', rank: 'text-3xl', name: 'text-xl', badge: 'h-9 min-w-9 text-base', score: 'text-2xl' },
  { min: 46, row: 'py-1.5', rank: 'text-2xl', name: 'text-lg', badge: 'h-8 min-w-8 text-sm', score: 'text-xl' },
  { min: 38, row: 'py-1', rank: 'text-xl', name: 'text-base', badge: 'h-7 min-w-7 text-xs', score: 'text-lg' },
  { min: 0, row: 'py-0.5', rank: 'text-lg', name: 'text-sm', badge: 'h-6 min-w-6 text-[11px]', score: 'text-base' },
] as const;

/** Alto del encabezado de la tabla, que no es una fila y no se reparte. */
const TABLE_HEADER_PX = 30;

function useRowTier(box: React.RefObject<HTMLElement | null>, rows: number) {
  const [perRow, setPerRow] = useState(0);
  // Cuánto alto sobra después de la tabla. Con una final de cuatro sobran más
  // de doscientos píxeles, y ese hueco es el que hay que resolver.
  const [free, setFree] = useState(0);

  useEffect(() => {
    const measure = () => {
      const element = box.current;
      if (element && rows > 0) {
        setPerRow((element.clientHeight - TABLE_HEADER_PX) / rows);
        const table = element.querySelector('table');
        setFree(element.clientHeight - (table?.scrollHeight ?? 0));
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (box.current) {
      observer.observe(box.current);
    }
    return () => observer.disconnect();
  }, [box, rows]);

  // Antes de medir se usa un tramo aproximado por cantidad de filas: así el
  // primer pintado ya sale cerca y no se ve el salto de un tamaño a otro.
  const tier =
    perRow === 0
      ? TIERS[Math.min(Math.max(Math.floor(rows / 6), 0), TIERS.length - 1)]!
      : (TIERS.find((t) => perRow >= t.min) ?? TIERS[TIERS.length - 1]!);
  return { ...tier, free };
}

function ProjectedTable({
  round,
  unit,
  isHeight,
  isPodiumRound,
  groups,
}: {
  round: LeaderboardRound;
  unit: { singular: string; plural: string };
  isHeight: boolean;
  isPodiumRound: boolean;
  groups: string[][];
}) {
  const box = useRef<HTMLDivElement>(null);
  const scale = useRowTier(box, round.rows.length);
  const header = 'px-1.5 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted';
  const headers = groups.flat();
  // Dónde empieza cada grupo: ahí va la divisoria y ahí va la cifra que manda.
  // Los desempates que la siguen van en gris, igual que en la tabla pública.
  const groupStarts = new Set<number>();
  groups.reduce((index, group) => {
    groupStarts.add(index);
    return index + group.length;
  }, 0);

  return (
    <div ref={box} className="flex h-full flex-col justify-center overflow-hidden">
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
            {headers.map((label, index) => (
              <th
                key={index}
                className={`${header} w-14 text-center ${
                  groupStarts.has(index) ? 'border-l border-cardborder/60' : ''
                }`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {round.rows.map((row) => {
            const podium = podiumStyle(row.result.rank, isPodiumRound);
            return (
              <tr key={row.registrationId} className={`border-b border-cardborder/60 ${podium?.row ?? ''}`}>
                <td className={`${scale.row} px-1.5 text-center ${podium?.rail ?? ''}`}>
                  <span className={`font-display font-bold tabular-nums ${scale.rank}`}>
                    {row.result.tied ? '=' : ''}
                    {row.result.rank}
                  </span>
                </td>
                <td className={`${scale.row} whitespace-nowrap px-1.5`}>
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
                {scoreCells(row.result).map((value, index) => (
                  <td
                    key={index}
                    className={`${scale.row} px-1.5 text-center tabular-nums ${
                      groupStarts.has(index)
                        ? `border-l border-cardborder/60 font-display font-bold ${scale.score}`
                        : 'font-display text-base text-muted'
                    }`}
                  >
                    {value}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* El hueco que deja una final de cuatro no se llena estirando la tabla
          —las filas quedarían absurdas— ni metiéndole más datos a una pantalla
          que se mira de lejos. Se llena con la marca: las mismas curvas de
          nivel del encabezado, en grande y calladas. Solo aparece cuando de
          verdad sobra espacio, así que en una clasificatoria de veinticinco no
          existe. */}
      {scale.free > 150 && (
        <div className="pointer-events-none mt-10 px-6 opacity-45" aria-hidden="true">
          <TopographicMotif />
        </div>
      )}
    </div>
  );
}

/**
 * El carril que hace que la gráfica de puestos llene el panel.
 *
 * Un SVG se escala entero y conserva su proporción, así que si su caja es más
 * ancha que alta y la gráfica es más apaisada todavía, sobra alto: se ve una
 * gráfica pequeña flotando en un panel grande. Eso se nota sobre todo en una
 * final de cuatro, donde la gráfica natural mide 274 unidades de alto contra
 * 1250 de ancho.
 *
 * La salida no es estirar —deformaría las curvas— sino separar los carriles
 * hasta que la proporción de la gráfica se acerque a la de su caja. Se apunta al
 * 90% y el carril tiene tope de 170: llenar el 100% con cuatro finalistas deja
 * las líneas a media pantalla una de otra, que se ve estirado, no lleno.
 */
const BUMP_VIEWBOX_WIDTH = 1250;
const BUMP_PAD = 78 + 82;

function useBumpLane(box: React.RefObject<HTMLElement | null>, rows: number) {
  const [lane, setLane] = useState<number | undefined>(undefined);

  useEffect(() => {
    const measure = () => {
      const element = box.current;
      if (!element || rows < 2 || element.clientWidth === 0) {
        return;
      }
      const targetHeight = BUMP_VIEWBOX_WIDTH * (element.clientHeight / element.clientWidth) * 0.9;
      const ideal = (targetHeight - BUMP_PAD) / (rows - 1);
      setLane(Math.round(Math.max(22, Math.min(170, ideal))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (box.current) {
      observer.observe(box.current);
    }
    return () => observer.disconnect();
  }, [box, rows]);

  return lane;
}

/** Las tres cifras de la ronda en una tira y no en tres tarjetas: en una fila de
 *  1900 px de ancho, tres tarjetas se estiran y quedan casi vacías. */
function HighlightStrip({ round, unit, isHeight }: { round: LeaderboardRound; unit: string; isHeight: boolean }) {
  const items = roundHighlights(round, unit, isHeight);
  if (items.length === 0) {
    return null;
  }
  return (
    // Tres columnas iguales y fijas: repartir el ancho entre las que haya dejaba
    // dos cifras estiradas en una final.
    <div className="grid shrink-0 grid-cols-3 divide-x divide-cardborder rounded-2xl border border-cardborder bg-card">
      {items.map((item) => (
        // `items-center` y no `items-baseline`: la línea base del número de
        // 36 px se alineaba con el rótulo de 11, y la cifra quedaba montada
        // por encima de su propio texto.
        <div key={item.key} className="flex min-w-0 items-center justify-center gap-4 px-6 py-3">
          <span className="shrink-0 font-display text-4xl font-bold leading-none tracking-tight tabular-nums text-pine">
            {item.value}
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              {item.label}
            </span>
            <span className="block truncate text-base text-ink">{item.detail}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Una categoría con algo que proyectar: las demás dejarían la pared en blanco. */
function projectableRound(category: LeaderboardCategory): LeaderboardRound | null {
  const judged = category.rounds.filter((r) => !r.error && r.rows.some((row) => row.cells.length > 0));
  return judged.at(-1) ?? category.rounds.find((r) => !r.error && r.problems.length > 0) ?? null;
}

export function ProjectionScreen({ initial, slug }: { initial: LeaderboardPayload; slug: string }) {
  const data = useLeaderboard(slug, initial);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [rotating, setRotating] = useState(false);
  const [slide, setSlide] = useState(0);
  // Una gráfica fija deja de turnarse: sirve para dejar la de puestos puesta
  // mientras corre una final.
  const [pinned, setPinned] = useState(false);
  const bumpBox = useRef<HTMLDivElement>(null);

  const unit = useMemo(() => problemUnit(data.event.discipline), [data.event.discipline]);
  const isHeight = data.event.scoringFormat === 'max_height';
  const groups = SCORE_HEADERS[data.event.scoringFormat] ?? [];

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
  // El mismo criterio que la tabla pública, a propósito: que una pantalla
  // muestre esta gráfica y la otra no, para la misma ronda, es un defecto que
  // se ve desde el otro lado del salón.
  const hasAttemptsPerTop =
    (round?.rows.filter((r) => r.result.format === 'classic_tops_zones' && r.result.tops >= 2).length ?? 0) >= 2;
  // Dos turnos, no tres: la de puestos es la nuestra y se queda con su tiempo;
  // el muro y los intentos al top son la misma pregunta —cómo se comportó la
  // ronda— y juntos se leen en diez segundos.
  const slides = [
    round && round.timeline.length > 1 ? ('bump' as const) : null,
    round && round.problemStats.length > 0 ? ('detail' as const) : null,
  ].filter((s): s is 'bump' | 'detail' => s !== null);

  const activeSlide = slides[slide % Math.max(slides.length, 1)];

  // Cada turno dura lo que dura leerlo, así que no puede ser un intervalo fijo:
  // se programa el siguiente cambio con la duración del que está en pantalla.
  useEffect(() => {
    if (pinned || slides.length < 2 || !activeSlide) {
      return;
    }
    const id = setTimeout(() => setSlide((s) => (s + 1) % slides.length), SLIDE_MS[activeSlide]);
    return () => clearTimeout(id);
  }, [activeSlide, slides.length, pinned]);

  const date = formatEventDate(data.event.date);
  const isPodiumRound = round?.type === 'final';
  const bumpLane = useBumpLane(bumpBox, round?.rows.length ?? 0);
  const chartTitle = {
    bump: `Puesto ${unit.singular} a ${unit.singular}`,
    detail: hasAttemptsPerTop ? `Los ${unit.plural} y los intentos al top` : `¿Qué tan duros estaban los ${unit.plural}?`,
  };

  // Nadie interactúa con una pared. Las gráficas piden estos tres porque en la
  // página sirven para resaltar a alguien; aquí no hay a quién resaltar.
  const inert = { hovered: null, onHover: () => {}, onSelect: () => {} };

  return (
    <main className="flex h-screen flex-col gap-3 overflow-hidden bg-stone px-6 py-4">
      <header className="flex shrink-0 items-center gap-6">
        <PeakMark />
        <div className="min-w-0 shrink-0">
          <span className={`${brandWordClass} text-sm`}>CRUX</span>
          <h1 className="truncate font-display text-4xl font-bold leading-tight">{data.event.name}</h1>
          <p className="text-base text-muted">
            {labelFor(DISCIPLINE_LABEL, data.event.discipline)}
            {date ? ` · ${date}` : ''}
            {round ? ` · ${labelFor(ROUND_TYPE_LABEL, round.type)}` : ''}
          </p>
        </div>

        {/* Las curvas de la marca se comen el aire que sobra entre el nombre y
            la categoría, que es donde el encabezado se veía vacío. */}
        <div className="min-w-0 flex-1 opacity-70">
          <TopographicMotif />
        </div>

        <div className="flex shrink-0 items-center gap-4">
          {current && (
            <span className="rounded-full bg-pine px-4 py-1.5 font-display text-lg font-semibold text-white">
              {current.category.name}
            </span>
          )}
          <span className="flex items-center gap-2 font-display text-lg font-semibold text-pine tabular-nums">
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
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-4">
            <section className="min-h-0 overflow-hidden rounded-2xl border border-cardborder bg-card px-4 py-3">
              <ProjectedTable
                round={round}
                unit={unit}
                isHeight={isHeight}
                isPodiumRound={isPodiumRound}
                groups={groups}
              />
            </section>

            <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-cardborder bg-card px-5 py-4">
              <div className="mb-2 flex shrink-0 items-center justify-between gap-4">
                <h2 className="font-display text-2xl font-bold leading-tight">
                  {activeSlide ? chartTitle[activeSlide] : ''}
                </h2>
                {/* Los puntos dicen cuántos turnos hay y en cuál va. Sin ellos,
                    una pantalla que cambia sola parece que se movió sola. */}
                {slides.length > 1 && (
                  <span className="flex shrink-0 items-center gap-2">
                    {slides.map((key, index) => {
                      const active = index === slide % slides.length;
                      return (
                        // Tocar un punto lleva a esa gráfica y la deja fija;
                        // tocar el que ya está activo suelta el turno y vuelve
                        // a rotar. El área de clic es de 24 px aunque el punto
                        // mida 8: nadie le apunta a ocho píxeles.
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            if (active) {
                              setPinned((value) => !value);
                              return;
                            }
                            setSlide(index);
                            setPinned(true);
                          }}
                          title={
                            active && pinned
                              ? 'Fija — toca para volver a rotar'
                              : active
                                ? 'Toca para fijar esta gráfica'
                                : 'Ver esta gráfica'
                          }
                          className="flex h-6 w-6 items-center justify-center"
                        >
                          <span
                            className={`rounded-full transition-all duration-300 ${
                              active
                                ? pinned
                                  ? 'h-2.5 w-2.5 bg-gold ring-2 ring-gold/30'
                                  : 'h-2.5 w-2.5 bg-pine'
                                : 'h-2 w-2 bg-cardborder'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </span>
                )}
              </div>
              {/* `key` en el contenedor: al cambiar de turno React monta uno
                  nuevo y la animación de entrada vuelve a correr. */}
              <div key={activeSlide} className="crux-fade flex min-h-0 flex-1 flex-col overflow-hidden">
                {activeSlide === 'bump' && (
                  <div ref={bumpBox} className="flex min-h-0 flex-1 items-center">
                    {/* `w-full max-h-full` y no `h-full`: con `h-full` el SVG se
                        ajusta al alto y deja franjas de aire a los lados —
                        pequeño en el centro de un panel ancho. Así usa todo el
                        ancho y solo se encoge si de verdad no cabe. */}
                    <BumpChart
                      round={round}
                      unit={unit.singular}
                      plural={unit.plural}
                      article={unit.article}
                      className="max-h-full w-full"
                      {...(bumpLane === undefined ? {} : { laneOverride: bumpLane })}
                      {...inert}
                    />
                  </div>
                )}
                {activeSlide === 'detail' && (
                  // `overflow-hidden` en cada bloque y no solo en el contenedor:
                  // en una columna flex los hijos se encogen por debajo de su
                  // contenido, y sin recortar cada uno, el muro se metía encima
                  // del título de los intentos.
                  <div className="flex min-h-0 flex-1 flex-col justify-center gap-8 overflow-hidden">
                    <div className="min-h-0 shrink overflow-hidden">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                        Qué tan duros estaban · del más duro al más fácil
                      </p>
                      <Wall round={round} unit={unit.singular} isHeight={isHeight} dense />
                    </div>
                    {hasAttemptsPerTop && (
                      <div className="min-h-0 shrink overflow-hidden">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                          Intentos por cada top · menos es mejor
                        </p>
                        {/* Cuatro y no diez: aquí comparte panel con el muro, y
                            lo que esta gráfica hace —comparar— ya se ve con los
                            cuatro primeros. */}
                        <AttemptsPerTop round={round} limit={4} fixedWidth={false} {...inert} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>

          <HighlightStrip round={round} unit={unit.singular} isHeight={isHeight} />
        </>
      )}

      <ProjectionControls
        slug={slug}
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
  slug,
  categories,
  activeIndex,
  rotating,
  onPick,
  onRotate,
}: {
  slug: string;
  categories: string[];
  activeIndex: number;
  rotating: boolean;
  onPick: (index: number) => void;
  onRotate: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  // Se esconde sola a los tres segundos de que nadie mueva el ratón, como los
  // controles de un video. Antes era `hover` sobre la página, y eso los dejaba
  // clavados en pantalla mientras el puntero estuviera encima de la ventana —
  // que en un portátil conectado a un proyector es siempre.
  const [visible, setVisible] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wake = useCallback(() => {
    setVisible(true);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => setVisible(false), CONTROLS_MS);
  }, []);

  useEffect(() => {
    wake();
    window.addEventListener('pointermove', wake);
    window.addEventListener('keydown', wake);
    return () => {
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('keydown', wake);
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [wake]);

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
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-0 flex justify-center pb-3 transition-opacity duration-500 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
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
        {/* La salida. Sin esto, de la pantalla de proyección no se vuelve. */}
        <Link href={`/resultados/${slug}`} className={`${pill} text-muted hover:text-pine`}>
          ← Volver a la tabla
        </Link>
      </div>
    </div>
  );
}
