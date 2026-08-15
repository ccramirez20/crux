import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TopographicMotif } from '@/components/topographic-motif';
import {
  loadAthleteProfile,
  type AthleteEventResult,
  type DisciplineTotals,
  type Trend,
} from '@/lib/athlete-profile';
import {
  DISCIPLINE_LABEL,
  ROUND_TYPE_LABEL,
  attemptSummary,
  formatEventDate,
  labelFor,
  ordinal,
  problemUnit,
} from '@/lib/labels';
import { brandWordClass, cardClass, eyebrowClass } from '@/lib/ui';
import { ConversionBar } from './conversion-bar';

// Nombre completo e historial deportivo de terceros: gente que inscribió el
// organizador y que puede no tener ni cuenta, posiblemente menores de edad.
// Bajo la Ley 1581 de 2012 eso no se publica en un buscador sin consentimiento.
// La página se ve con el enlace; no entra a Google. La URL usa el UUID del
// atleta, nunca el documento.
export const metadata: Metadata = {
  title: 'Historial de competidor · Crux',
  robots: { index: false, follow: false },
};

/**
 * Una cifra grande con su rótulo. Es el bloque del que se arman las tiras.
 *
 * `large` es la talla de `StatTile` en la tabla pública, reservada para la
 * tarjeta de trayectoria: es el dato que la pantalla viene a dar, y a la talla
 * normal competía de igual a igual con los totales de abajo.
 */
function Figure({
  value,
  label,
  detail,
  unit,
  tone,
  large,
}: {
  value: string;
  label: string;
  /** De dónde sale la cifra: la fecha, el evento. Solo lo usa Trayectoria. */
  detail?: string | undefined;
  unit?: string;
  tone?: string;
  large?: boolean;
}) {
  const size = large ? 'text-[3.25rem] leading-none tracking-tight' : 'text-4xl';
  return (
    <div className="min-w-24">
      <span className={`font-display ${size} font-bold tabular-nums ${tone ?? ''}`}>
        {value}
        {unit && <span className="ml-1 font-body text-lg font-normal text-muted">{unit}</span>}
      </span>
      <span className={`${large ? 'mt-2' : 'mt-0.5'} block text-sm text-muted`}>{label}</span>
      {detail && <span className="mt-0.5 block text-sm text-bark">{detail}</span>}
    </div>
  );
}

/**
 * Pico con un punto en la cima. Mismo idioma de líneas finas que
 * `topographic-motif.tsx`, en 20px: un trazo y el punto en oro.
 */
function PeakIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} aria-hidden="true">
      <path
        d="M2 19 L9 9 L12.5 13.5 L17 6.5 L22 19"
        fill="none"
        stroke="#2F4A3E"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="17" cy="6.5" r="1.7" fill="#E3A83B" />
    </svg>
  );
}

/**
 * Rótulo de sección con el pico delante. Repetirlo en las cuatro secciones es
 * lo que le da un hilo visual a la pantalla; a 16px el ícono acompaña al rótulo
 * de 11px sin taparlo.
 */
function SectionTitle({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-2">
      <PeakIcon className="h-4 w-4" />
      <span className={eyebrowClass}>{children}</span>
    </div>
  );
}

/** "por encima del 69 % de tu categoría" — el puesto traducido a algo comparable. */
function aboveField(standing: number): number {
  return Math.round(standing * 100);
}

/** "1 top" y no "1 tops": la cifra puede ser uno y se lee en pantalla. */
function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * Una fila de la comparación: el mismo dato en las dos últimas competencias.
 *
 * `lowerIsBetter` existe por los intentos por top, que es la única cifra de la
 * pantalla donde bajar es mejorar. Sin ese parámetro la flecha diría que
 * empeoró justo cuando escaló más limpio.
 */
function TrendRow({
  label,
  now,
  before,
  nowValue,
  beforeValue,
  lowerIsBetter,
}: {
  label: string;
  now: number | null;
  before: number | null;
  nowValue: string;
  beforeValue: string;
  lowerIsBetter?: boolean;
}) {
  const delta = now !== null && before !== null ? now - before : 0;
  const better = lowerIsBetter ? delta < 0 : delta > 0;
  const worse = lowerIsBetter ? delta > 0 : delta < 0;
  return (
    <>
      <span className="self-center text-sm text-muted">{label}</span>
      <span className="flex items-baseline justify-center gap-1.5 font-display text-2xl font-bold tabular-nums">
        {nowValue}
        {better && <span className="text-base text-pine" aria-label="mejor que la anterior">▲</span>}
        {worse && <span className="text-base text-bronze" aria-label="peor que la anterior">▼</span>}
      </span>
      <span className="self-center text-center font-display text-lg tabular-nums text-muted">
        {beforeValue}
      </span>
    </>
  );
}

/**
 * Las dos últimas competencias, una al lado de la otra.
 *
 * Cifras y no una frase: la pregunta que responde —¿topé más o menos que la vez
 * pasada, y me costó más o menos?— se contesta de un vistazo comparando
 * columnas, y en prosa había que leerla entera para extraer dos números.
 *
 * Son las dos **últimas en orden cronológico**, nunca las dos mejores, y por eso
 * los nombres de los eventos encabezan las columnas: sin ellos la tarjeta
 * parecía escoger dos eventos por una razón que nunca explicaba.
 */
function TrendTable({ trend }: { trend: Trend }) {
  const now = aboveField(trend.latest.standing!);
  const before = aboveField(trend.previous.standing!);
  const a = trend.latestTotals;
  const b = trend.previousTotals;
  const rate = (t: typeof a) => (t.attemptsPerTop === null ? '—' : t.attemptsPerTop.toFixed(1));

  return (
    // Tres columnas iguales y cifras centradas bajo su encabezado. Con la
    // columna del rótulo en `1fr` se quedaba con todo el ancho sobrante y
    // empujaba los números contra el borde derecho, dejando un hueco en medio
    // que parecía que faltaba algo por llegar.
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 items-end gap-x-4 gap-y-1">
        <span />
        <span className="text-center text-sm font-semibold">{trend.latest.eventName}</span>
        <span className="text-center text-sm text-muted">{trend.previous.eventName}</span>

        <span />
        <span className={`${eyebrowClass} text-center`}>Última</span>
        <span className={`${eyebrowClass} text-center`}>Anterior</span>
      </div>

      <div className="grid grid-cols-3 gap-x-4 gap-y-3 border-t border-cardborder pt-3">
        <TrendRow
          label="Arriba de tu categoría"
          now={now}
          before={before}
          nowValue={`${now} %`}
          beforeValue={`${before} %`}
        />
        {/* Solo si las dos son de la misma modalidad: tops de bloque contra
            rutas de dificultad no se comparan. */}
        {trend.comparable && (
          <>
            <TrendRow
              label="Tops"
              now={a.tops}
              before={b.tops}
              nowValue={`${a.tops} de ${a.problems}`}
              beforeValue={`${b.tops} de ${b.problems}`}
            />
            <TrendRow
              label="Intentos por top"
              now={a.attemptsPerTop}
              before={b.attemptsPerTop}
              nowValue={rate(a)}
              beforeValue={rate(b)}
              lowerIsBetter
            />
          </>
        )}
      </div>
    </div>
  );
}

// Las variantes de texto, no las de relleno: aquí el color son cifras, y el oro
// y la plata de los rellenos no llegan al contraste mínimo como letras.
const PODIUM_TONE = ['text-gold-ink', 'text-silver-ink', 'text-bronze'];

/**
 * Oro, plata o bronce para el 1.º, 2.º y 3.º; pine para el resto.
 *
 * Con el `?? ` de por medio la búsqueda es total: fuera del podio el índice no
 * existe y devuelve el color normal, en vez de meter un `undefined` dentro de
 * una lista de clases.
 */
function podiumTone(rank: number): string {
  return PODIUM_TONE[rank - 1] ?? 'text-pine';
}

/**
 * Dónde quedó dentro del campo, dibujado. Es lo que hace comparables dos
 * competencias de tamaño distinto, y en barra se ve de una: un 4.º de 12 llena
 * más que un 8.º de 14 aunque el segundo número sea más grande.
 *
 * Una barra por resultado y no una línea de tendencia: la línea necesita
 * historia para decir algo, esto funciona desde la primera competencia.
 */
function StandingMeter({ standing }: { standing: number }) {
  return (
    // Envuelve en vez de empujar: en teléfono la etiqueta se va abajo de la
    // barra en lugar de comprimirla hasta que no se lea.
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <div className="h-1.5 w-full min-w-32 max-w-64 flex-1 overflow-hidden rounded-full bg-stone" aria-hidden>
        <div className="h-full rounded-full bg-pine" style={{ width: `${Math.max(aboveField(standing), 2)}%` }} />
      </div>
      <span className="text-sm text-muted">
        por encima del{' '}
        <span className="font-display font-semibold tabular-nums">{aboveField(standing)} %</span> de tu
        categoría
      </span>
    </div>
  );
}

function BestResult({ event }: { event: AthleteEventResult }) {
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span
          className={`font-display text-3xl font-bold tabular-nums ${podiumTone(event.rank!)}`}
        >
          {ordinal(event.rank!)}
        </span>
        {/* El puesto nunca va solo: un 3.º de 5 y un 3.º de 24 no son lo mismo. */}
        <span className="text-base text-muted">de {event.field}</span>
        <a href={`/resultados/${event.eventSlug}`} className="text-base text-pine underline decoration-gold decoration-2 underline-offset-4">
          {event.eventName}
        </a>
      </div>
      <StandingMeter standing={event.standing!} />
    </li>
  );
}

function EventCard({ event }: { event: AthleteEventResult }) {
  const unit = problemUnit(event.discipline);
  const isHeight = event.discipline !== 'boulder';
  const date = formatEventDate(event.eventDate);

  return (
    <article className={cardClass}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <a
            href={`/resultados/${event.eventSlug}`}
            className="font-display text-2xl font-semibold text-pine underline decoration-gold decoration-2 underline-offset-4"
          >
            {event.eventName}
          </a>
          <p className="mt-1 text-sm text-muted">
            {[
              date,
              event.categoryName,
              event.roundType ? labelFor(ROUND_TYPE_LABEL, event.roundType) : null,
              labelFor(DISCIPLINE_LABEL, event.discipline),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        {event.rank === null ? (
          <span className="text-sm text-muted">Sin resultado publicado</span>
        ) : (
          <div className="text-right">
            <span className={`font-display text-4xl font-bold tabular-nums ${event.rank <= 3 ? PODIUM_TONE[event.rank - 1] : ''}`}>
              {ordinal(event.rank)}
            </span>
            <span className="ml-2 text-base text-muted">de {event.field}</span>
            {event.tied && <span className="ml-2 text-sm text-muted">(empate)</span>}
          </div>
        )}
      </div>

      {event.problems.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2 border-t border-cardborder pt-4">
          {event.problems.map((problem) => (
            <li key={problem.id} className="rounded-lg border border-cardborder bg-stone px-3 py-2">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                {unit.singular} {problem.number}
                {problem.name ? ` · ${problem.name}` : ''}
              </span>
              <span className="font-display text-base font-semibold">
                {attemptSummary(
                  event.cells.find((c) => c.problemId === problem.id),
                  isHeight,
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function BoulderTotals({ totals }: { totals: DisciplineTotals }) {
  // `zones` incluye los tops, igual que en la tabla pública. Para la barra hay
  // que separarlos, y el Math.max protege contra un juez que haya marcado top
  // sin zona: en ese caso el tramo se encoge, no se vuelve negativo.
  const zoneOnly = Math.max(0, totals.zones - totals.tops);
  const none = Math.max(0, totals.problems - totals.tops - zoneOnly);

  return (
    <section className={`${cardClass} flex flex-col gap-5`}>
      <SectionTitle>Boulder / Bloque</SectionTitle>
      {/* Grid y no flex-wrap: con gaps fijos las cuatro cifras se empaquetaban a
          la izquierda y dejaban el resto del ancho vacío. Dos columnas en
          teléfono, cuatro cuando hay ancho. */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
        <Figure value={String(totals.problems)} label="Bloques intentados" />
        <Figure value={String(totals.tops)} label="Tops" />
        {/* Sin la aclaración de que la cifra incluye los tops: la barra que va
            justo debajo ya separa «zona sin top», que es donde se resuelve la
            duda, y el paréntesis en el rótulo pesaba más que el dato. */}
        <Figure value={String(totals.zones)} label="Zonas" />
        <Figure value={String(totals.flashes)} label="Flash" />
      </div>
      <ConversionBar
        segments={[
          {
            label: plural(totals.tops, 'top', 'tops'),
            count: totals.tops,
            fill: 'bg-gold',
            swatch: 'bg-gold',
          },
          { label: 'zona sin top', count: zoneOnly, fill: 'bg-pine', swatch: 'bg-pine' },
          { label: 'sin zona', count: none, fill: 'bg-cardborder', swatch: 'bg-cardborder' },
        ]}
      />
    </section>
  );
}

function LeadTotals({ totals }: { totals: DisciplineTotals }) {
  return (
    <section className={`${cardClass} flex flex-col gap-5`}>
      <SectionTitle>Lead / Dificultad</SectionTitle>
      {/* Mismo grid que Boulder. Son dos o tres cifras según haya altura
          máxima, así que tres columnas en vez de cuatro. */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3">
        <Figure value={String(totals.problems)} label="Rutas intentadas" />
        <Figure value={String(totals.tops)} label="Rutas completadas" />
        {totals.maxHeight !== null && (
          <Figure value={String(totals.maxHeight)} unit="m" label="Altura máxima" />
        )}
      </div>
      <ConversionBar
        segments={[
          {
            label: plural(totals.tops, 'completada', 'completadas'),
            count: totals.tops,
            fill: 'bg-gold',
            swatch: 'bg-gold',
          },
          {
            label: 'sin completar',
            count: Math.max(0, totals.problems - totals.tops),
            fill: 'bg-pine',
            swatch: 'bg-pine',
          },
        ]}
      />
    </section>
  );
}

export default async function CompetidorPage({ params }: { params: Promise<{ athleteId: string }> }) {
  const { athleteId } = await params;
  // Postgres tumba la consulta si el texto no es un uuid, así que la forma se
  // revisa antes de ir a la base y una URL inventada es un 404, no un 500.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(athleteId)) {
    notFound();
  }

  const profile = await loadAthleteProfile(athleteId);
  if (!profile) {
    notFound();
  }

  const { career, best, trend } = profile;
  const sinceLabel = career.since ? formatEventDate(career.since) : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-4 py-12">
      <TopographicMotif />

      <header>
        <span className={eyebrowClass}>Historial de competidor</span>
        <h1 className="mt-1 font-display text-4xl font-bold">{profile.fullName}</h1>
      </header>

      {/* El filete de oro es lo que distingue esta tarjeta; el fondo se queda en
          el hueso de `cardClass` como las demás, porque un tinte de pine sobre
          el stone del `body` quedaba casi del color de la página y se
          camuflaba. */}
      <section className={`${cardClass} relative overflow-hidden`}>
        <span className="absolute inset-x-0 top-0 h-1 bg-gold" aria-hidden />
        <div className="mt-1">
          <SectionTitle>Trayectoria</SectionTitle>
        </div>
        {/* Las tres en pine, no una en oro: son tres hechos del mismo rango, y
            el oro sobre el hueso de la tarjeta queda en 1.8:1 y se pierde a esta
            talla — el mismo hallazgo que ya fijó el color de `StatTile`. */}
        {/* Cada cifra dice de dónde sale. Es lo que hace que esta tarjeta
            resalte por informar más y no por pesar más, y de paso contesta la
            pregunta que cada número dejaba abierta: ¿desde cuándo?, ¿dónde? */}
        <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-3">
          <Figure
            value={String(career.events)}
            label={career.events === 1 ? 'Competencia' : 'Competencias'}
            // formatEventDate devuelve null si la fecha no se puede leer, y sin
            // este segundo chequeo la tarjeta decía "desde null".
            detail={sinceLabel ? `desde ${sinceLabel}` : undefined}
            tone="text-pine"
            large
          />
          {/* Oro, plata o bronce cuando el mejor puesto es de podio: se ve de una
              si llegó al cajón, sin leer la cifra. Misma tripleta que ya usan
              "tus mejores resultados" abajo, así que las dos secciones dicen lo
              mismo con el mismo color. Fuera del podio se queda en pine. */}
          {career.bestRank !== null && (
            <Figure
              value={ordinal(career.bestRank)}
              label="Mejor puesto"
              detail={career.bestRankEvent ?? undefined}
              tone={podiumTone(career.bestRank)}
              large
            />
          )}
          {/* Un cero grande en pantalla pesa más que la ausencia del dato. */}
          {career.podiums > 0 && (
            <Figure
              value={String(career.podiums)}
              label={career.podiums === 1 ? 'Podio' : 'Podios'}
              // El último y no el primero: con varios podios, el que importa es
              // el más reciente.
              detail={
                career.lastPodiumEvent
                  ? career.podiums === 1
                    ? career.lastPodiumEvent
                    : `el último en ${career.lastPodiumEvent}`
                  : undefined
              }
              tone="text-pine"
              large
            />
          )}
        </div>
      </section>

      {career.boulder && <BoulderTotals totals={career.boulder} />}
      {career.lead && <LeadTotals totals={career.lead} />}

      {best.length > 0 && (
        <section className={`${cardClass} flex flex-col gap-5`}>
          <SectionTitle>Tus mejores resultados</SectionTitle>
          <ul className="flex flex-col gap-4">
            {best.map((event) => (
              <BestResult key={event.eventSlug} event={event} />
            ))}
          </ul>
        </section>
      )}

      {/* Sección propia y no un pie de "tus mejores resultados": son dos cosas
          distintas. Arriba están los tres mejores de toda la carrera; esto son
          los dos últimos en el calendario, le haya ido bien o mal. */}
      <section className={`${cardClass} flex flex-col gap-5`}>
        <SectionTitle>Últimas dos competencias</SectionTitle>
        {trend ? (
          <TrendTable trend={trend} />
        ) : (
          <p className="text-base text-muted">Con una segunda competencia hay con qué comparar.</p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle>Competencias</SectionTitle>
        {profile.events.map((event) => (
          <EventCard key={event.eventSlug} event={event} />
        ))}
      </section>

      <p className="border-t border-cardborder pt-6 text-base text-muted">
        Este historial lo lleva{' '}
        <a href="/" className={`${brandWordClass} underline decoration-gold decoration-2 underline-offset-4`}>
          CRUX
        </a>
        , plataforma de competencias de escalada.
      </p>
    </main>
  );
}
