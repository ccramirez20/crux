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
    // Y otra vez pasado el pintado: en el primer render la caja puede medir
    // cero, y con eso el hueco daba cero y el panel se quedaba sin nada que
    // ponerle. El observador no lo salva: la caja no cambia de tamaño después,
    // lo que cambia es que por fin existe.
    const frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    if (box.current) {
      observer.observe(box.current);
    }
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [box, rows]);

  // El hueco se vuelve a medir cuando cambia el tramo: se midió con el tamaño
  // de arranque, y al asentarse la tabla encoge o crece.
  useEffect(() => {
    const element = box.current;
    const table = element?.querySelector('table');
    if (element && table) {
      setFree(element.clientHeight - table.scrollHeight);
    }
  }, [box, perRow]);

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
  now,
}: {
  round: LeaderboardRound;
  unit: { singular: string; plural: string };
  isHeight: boolean;
  isPodiumRound: boolean;
  groups: string[][];
  now: number;
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
      <PanelFill free={scale.free} round={round} unit={unit.singular} now={now} />
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
 * 90% y el carril tiene tope de 145: con cuatro finalistas, llenar el panel deja
 * las líneas a media pantalla una de otra y la gráfica se ve estirada. Mejor que
 * mida lo que mide, y que debajo vaya el podio.
 */
const BUMP_VIEWBOX_WIDTH = 1250;
const BUMP_PAD = 78 + 82;

function useBumpLane(box: React.RefObject<HTMLElement | null>, rows: number) {
  const [lane, setLane] = useState<number | undefined>(undefined);
  // Lo que le sobra al panel después de dibujar. El carril tiene tope, así que
  // con cuatro finalistas la gráfica llega hasta donde llega y debajo queda un
  // hueco — el mismo problema de la tabla, y aquí sí lo cierran las olas,
  // porque en este panel no compiten con nada.
  const [leftover, setLeftover] = useState(0);

  useEffect(() => {
    const measure = () => {
      const element = box.current;
      if (!element || rows < 2 || element.clientWidth === 0) {
        return;
      }
      const targetHeight = BUMP_VIEWBOX_WIDTH * (element.clientHeight / element.clientWidth) * 0.9;
      const ideal = (targetHeight - BUMP_PAD) / (rows - 1);
      const chosen = Math.round(Math.max(22, Math.min(145, ideal)));
      setLane(chosen);
      const drawn = BUMP_PAD + (rows - 1) * chosen;
      setLeftover(element.clientHeight - (element.clientWidth * drawn) / BUMP_VIEWBOX_WIDTH);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (box.current) {
      observer.observe(box.current);
    }
    return () => observer.disconnect();
  }, [box, rows]);

  return { lane, leftover };
}

/**
 * Qué va en el alto que le sobra a la tabla.
 *
 * Sobra porque la tabla está limitada por el **ancho** —con cuatro bloques y
 * cuatro columnas de puntaje ya toca los bordes de su tarjeta— así que ese
 * hueco no se arregla agrandando filas: se llena. Y sobra justo cuando hay
 * poca gente, que es cuando se está corriendo una final.
 *
 * Se llena en orden de lo que más le dice a la sala, mientras quepa:
 *
 * 1. **El podio.** Solo en una final, porque solo ahí existe. Son los mismos
 *    tres nombres de la tabla, dibujados como lo que son.
 * 2. **La última captura.** Hace que la pared se sienta viva entre
 *    actualizaciones; sirve en cualquier ronda.
 * 3. **Las curvas de la marca**, que cierran lo que quede.
 *
 * Nada de esto aparece si no cabe entero, así que una clasificatoria de
 * veinticinco no ve ninguno y la tabla se queda con toda la tarjeta.
 */
/** Lo que ocupa cada pieza, medido contra lo que ocupa de verdad en pantalla. */
const FILL = { capturesHeader: 34, capture: 44, podium: 250, motif: 76 };

function Podium({ round }: { round: LeaderboardRound }) {
  const three = round.rows.slice(0, 3);
  if (three.length < 3) {
    return null;
  }
  // Plata, oro, bronce — en ese orden, que es como se para un podio. La altura
  // de cada cajón dice el puesto sin necesidad de leer el número.
  // Degradado y no color plano: al lado de las curvas de nivel y de las líneas
  // de la gráfica, tres rectángulos macizos se leen como un cuerpo extraño. El
  // tono baja hacia el pie de cada cajón, que es como cae la luz en un podio de
  // verdad.
  const order = [
    { row: three[1]!, height: 'h-24', from: '#A6B7C0', to: '#7B8F9B', rank: 2, ink: 'text-white' },
    { row: three[0]!, height: 'h-36', from: '#EFC069', to: '#D89A2A', rank: 1, ink: 'text-ink' },
    { row: three[2]!, height: 'h-16', from: '#9A6740', to: '#6B4224', rank: 3, ink: 'text-white' },
  ];
  return (
    <div className="mx-auto flex w-full max-w-[34rem] items-end justify-center gap-3">
      {order.map(({ row, height, from, to, rank, ink }) => (
        <div key={row.registrationId} className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <span className="text-balance text-center font-display text-base font-semibold leading-tight text-ink">
            {row.athleteName}
          </span>
          <div
            className={`flex w-full items-start justify-center rounded-t-xl pt-3 ${height}`}
            style={{ background: `linear-gradient(180deg, ${from} 0%, ${to} 100%)` }}
          >
            <span className={`font-display text-4xl font-bold leading-none ${ink}`}>{rank}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** "hace 40 s" — del reloj del juez, que es cuando de verdad pasó. */
function sinceLabel(iso: string, now: number): string {
  const seconds = Math.round((now - new Date(iso).getTime()) / 1000);
  if (seconds < 45) {
    return 'ahora mismo';
  }
  if (seconds < 3600) {
    return `hace ${Math.round(seconds / 60)} min`;
  }
  return `hace ${Math.round(seconds / 3600)} h`;
}

/**
 * Lo último que capturó un juez, hasta tres.
 *
 * Es lo que hace que una pared se sienta viva entre refrescos: alguien acaba de
 * escalar y la sala lo ve sin buscar su fila. Cuántas se muestran lo decide el
 * alto que sobre — con una final de cuatro caben las tres, con una
 * clasificatoria llena no cabe ninguna y no pasa nada.
 */
function RecentCaptures({
  captures,
  unit,
  now,
}: {
  captures: LeaderboardRound['lastAttempts'];
  unit: string;
  now: number;
}) {
  if (captures.length === 0) {
    return null;
  }
  const article = unit === 'ruta' ? 'la' : 'el';
  const mark = (n: number) => `${unit.slice(0, 1).toUpperCase()}${n}`;
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        <span className="h-2 w-2 animate-pulse rounded-full bg-gold" aria-hidden />
        {captures.length === 1 ? 'Última captura' : 'Últimas capturas'}
      </span>
      <ul className="flex flex-col gap-1.5">
        {captures.map((capture) => {
          const what = capture.top
            ? `hizo TOP en ${article} ${mark(capture.problemNumber)}`
            : capture.zone
              ? `llegó a la zona en ${article} ${mark(capture.problemNumber)}`
              : `intentó ${article} ${mark(capture.problemNumber)}`;
          const goes = capture.attempts
            ? ` · ${capture.attempts} ${capture.attempts === 1 ? 'intento' : 'intentos'}`
            : '';
          return (
            <li
              key={`${capture.athleteName}-${capture.capturedAt}`}
              className={`flex items-baseline justify-between gap-4 rounded-lg border-l-4 bg-stone/40 px-4 py-2 ${
                capture.top
                  ? 'border-gold'
                  : capture.zone
                    ? 'border-sage'
                    : 'border-cardborder'
              }`}
            >
              <span className="min-w-0 truncate font-display text-lg font-semibold leading-tight text-ink">
                {capture.athleteName} {what}
                <span className="font-normal text-muted">{goes}</span>
              </span>
              <span className="shrink-0 text-sm text-muted">{sinceLabel(capture.capturedAt, now)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Debajo de la tabla van las últimas capturas, y nada más.
 *
 * Una sola cosa y no tres: apilar podio, captura y olas dejaba la tarjeta
 * cargada, y las olas eran justo lo único que no decía nada. El podio se mudó
 * al panel de la gráfica, que es donde de verdad sobra sitio.
 */
function PanelFill({
  free,
  round,
  unit,
  now,
}: {
  free: number;
  round: LeaderboardRound;
  unit: string;
  now: number;
}) {
  const room = Math.floor((free - FILL.capturesHeader) / FILL.capture);
  const howMany = Math.max(0, Math.min(room, round.lastAttempts.length));
  if (howMany === 0) {
    return null;
  }
  return (
    <div className="mt-6">
      <RecentCaptures captures={round.lastAttempts.slice(0, howMany)} unit={unit} now={now} />
    </div>
  );
}

/** Las tres cifras de la ronda en una tira y no en tres tarjetas: en una fila de
 *  1900 px de ancho, tres tarjetas se estiran y quedan casi vacías. */
function HighlightStrip({
  round,
  unit,
  isHeight,
}: {
  round: LeaderboardRound;
  unit: string;
  isHeight: boolean;
}) {
  const items = roundHighlights(round, unit, isHeight);
  // Tres a la vez, siempre las mismas cuatro y en el mismo orden en toda
  // categoría. Cuando hay una de más la ventana corre de a una: rotar es mejor
  // que esconder la cuarta para siempre y mejor que apretar cuatro en el ancho
  // de tres. Veinte segundos, porque son dos renglones leídos desde el fondo
  // del salón, no un titular.
  const [offset, setOffset] = useState(0);
  const rota = items.length > 3;

  useEffect(() => {
    if (!rota) {
      return;
    }
    const id = setInterval(() => setOffset((value) => (value + 1) % items.length), 20_000);
    return () => clearInterval(id);
  }, [rota, items.length]);

  if (items.length === 0) {
    return null;
  }
  const shown = Array.from(
    { length: Math.min(3, items.length) },
    (_, index) => items[(offset + index) % items.length]!,
  );

  return (
    <div className="grid shrink-0 grid-cols-3 divide-x divide-cardborder rounded-2xl border border-cardborder bg-card">
      {shown.map((item) => (
        <div key={item.key} className="crux-fade flex min-w-0 items-center justify-center gap-5 px-6 py-5">
          <span className="shrink-0 font-display text-5xl font-bold leading-none tracking-tight tabular-nums text-pine">
            {item.value}
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              {item.label}
            </span>
            <span className="mt-0.5 block truncate text-lg text-ink">{item.detail}</span>
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
  // El reloj de "hace 40 s" cuelga del sondeo: cada respuesta nueva vuelve a
  // pintar, así que no hace falta un temporizador aparte.
  const now = Date.parse(data.updatedAt);
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
  const { lane: bumpLane, leftover: bumpLeftover } = useBumpLane(bumpBox, round?.rows.length ?? 0);
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
                now={now}
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
                  <div ref={bumpBox} className="flex min-h-0 flex-1 flex-col">
                    <div className="flex min-h-0 flex-1 items-center">
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
                    {/* Lo que sobra debajo de la gráfica: el podio si esto es
                        una final —es el momento del día y aquí tiene sitio
                        propio— y si no, las olas. La gráfica no se estira para
                        taparlo: con cuatro finalistas, estirada se ve peor. */}
                    {isPodiumRound && round.rows.length >= 3 ? (
                      // Sitio reservado, no lo que sobre: medir primero y
                      // decidir después dejaba el podio fuera justo en las
                      // pantallas grandes, que es donde más sitio hay.
                      <div className="mt-4 shrink-0 pb-2">
                        <Podium round={round} />
                      </div>
                    ) : bumpLeftover >= FILL.motif ? (
                      <div className="pointer-events-none mt-6 px-10 opacity-45" aria-hidden="true">
                        <TopographicMotif />
                      </div>
                    ) : null}
                  </div>
                )}
                {activeSlide === 'detail' && (
                  // `overflow-hidden` en cada bloque y no solo en el contenedor:
                  // en una columna flex los hijos se encogen por debajo de su
                  // contenido, y sin recortar cada uno, el muro se metía encima
                  // del título de los intentos.
                  <div className="relative flex min-h-0 flex-1 flex-col gap-10 overflow-hidden pt-6">
                    <div className="min-h-0 shrink-0 overflow-hidden">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                        Qué tan duros estaban · del más duro al más fácil
                      </p>
                      <Wall round={round} unit={unit.singular} isHeight={isHeight} dense />
                    </div>
                    {hasAttemptsPerTop && (
                      <div className="min-h-0 shrink-0 overflow-hidden">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                          Intentos por cada top · menos es mejor
                        </p>
                        {/* Cuatro y no diez: aquí comparte panel con el muro, y
                            lo que esta gráfica hace —comparar— ya se ve con los
                            cuatro primeros. */}
                        <AttemptsPerTop round={round} limit={4} fixedWidth={false} {...inert} />
                      </div>
                    )}
                    {/* Con dos gráficas ya hay bastante que leer: lo que sobre
                        lo cierran las curvas y nada más. La medida es la del
                        otro turno, que comparte panel y tamaño. */}
                    {/* Las curvas al fondo y no como un bloque más: lo que
                        sobraba era blanco suelto debajo de las dos gráficas, y
                        un motivo apoyado ahí abajo seguía siendo una tercera
                        cosa apilada. Puestas de fondo, el panel se cierra solo
                        y las gráficas se apoyan encima. Mismo umbral que el
                        otro turno: si no cabe entero, no aparece. */}
                    {bumpLeftover >= FILL.motif && (
                      <div
                        className="pointer-events-none absolute inset-x-6 bottom-4 opacity-40"
                        aria-hidden="true"
                      >
                        <TopographicMotif />
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
