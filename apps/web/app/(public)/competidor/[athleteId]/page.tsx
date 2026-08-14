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
import { cardClass, eyebrowClass } from '@/lib/ui';

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
  unit,
  tone,
  large,
}: {
  value: string;
  label: string;
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
    </div>
  );
}

/**
 * Pico con un punto en la cima. Mismo idioma de líneas finas que
 * `topographic-motif.tsx`, en 20px: un trazo y el punto en oro.
 */
function PeakIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
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
 * Cómo terminó cada bloque intentado, en una barra. Es la lectura que ningún
 * evento suelto puede dar: qué tan seguido convierte.
 *
 * Colores: oro para el top y verde para la zona son los mismos de la tabla
 * pública, para que las dos pantallas hablen el mismo idioma. El verde es pine
 * y no el sage de las insignias porque aquí los rellenos se tocan: sage contra
 * oro se cae a ΔE 12.4 en visión normal, bajo el piso de 15. Pine contra oro da
 * 41.1 (36.1 en protanopía). Validado con validate_palette.js, no elegido a ojo.
 */
function ConversionBar({ segments }: { segments: { label: string; count: number; fill: string; swatch: string }[] }) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) {
    return null;
  }
  const shown = segments.filter((s) => s.count > 0);
  return (
    <div className="flex flex-col gap-3">
      {/* 2 px de hueso entre tramos: el corte hace legible el límite sin
          depender solo del color. */}
      <div className="flex h-5 gap-[2px] overflow-hidden rounded" role="presentation">
        {shown.map((segment) => (
          <div
            key={segment.label}
            className={segment.fill}
            style={{ width: `${(segment.count / total) * 100}%` }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {shown.map((segment) => (
          <li key={segment.label} className="flex items-center gap-2 text-sm">
            <span className={`h-3 w-3 shrink-0 rounded-sm ${segment.swatch}`} aria-hidden />
            <span className="font-display font-semibold tabular-nums">{segment.count}</span>
            <span className="text-muted">
              {segment.label} · {Math.round((segment.count / total) * 100)} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "por encima del 69 % del campo" — el puesto traducido a algo comparable. */
function aboveField(standing: number): number {
  return Math.round(standing * 100);
}

/** "1 topado" y no "1 topados": la cifra puede ser uno y se lee en pantalla. */
function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function TrendLine({ trend }: { trend: Trend }) {
  const now = aboveField(trend.latest.standing!);
  const before = aboveField(trend.previous.standing!);
  return (
    <p className="text-base leading-relaxed">
      En <span className="font-semibold">{trend.latest.eventName}</span> quedaste por encima del{' '}
      <span className="font-display font-bold tabular-nums">{now} %</span> del campo
      {/* Antes decía "92 puntos abajo de", y "puntos" ya significa otra cosa en
          esta misma pantalla: en un evento de liga el puntaje son puntos de
          verdad. Los dos porcentajes uno al lado del otro dicen lo mismo sin
          inventar una unidad que compita con la que ya existe. */}
      {now === before ? (
        <>, lo mismo que en {trend.previous.eventName}.</>
      ) : (
        <>
          , contra el <span className="font-display font-bold tabular-nums">{before} %</span> en{' '}
          {trend.previous.eventName}.
        </>
      )}
    </p>
  );
}

const PODIUM_TONE = ['text-gold', 'text-silver', 'text-bronze'];

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
        por encima del <span className="font-display font-semibold tabular-nums">{aboveField(standing)} %</span> del campo
      </span>
    </div>
  );
}

function BestResult({ event }: { event: AthleteEventResult }) {
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span
          className={`font-display text-3xl font-bold tabular-nums ${
            event.rank! <= 3 ? PODIUM_TONE[event.rank! - 1] : ''
          }`}
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
      <span className={eyebrowClass}>Boulder / Bloque</span>
      <div className="flex flex-wrap gap-x-10 gap-y-5">
        <Figure value={String(totals.problems)} label="Bloques intentados" />
        <Figure value={String(totals.tops)} label="Tops" />
        <Figure value={String(totals.zones)} label="Zonas (incluye tops)" />
        <Figure value={String(totals.flashes)} label="Flash" />
      </div>
      <ConversionBar
        segments={[
          {
            label: plural(totals.tops, 'topado', 'topados'),
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
      <span className={eyebrowClass}>Lead / Dificultad</span>
      <div className="flex flex-wrap gap-x-10 gap-y-5">
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

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-4 py-12">
      <TopographicMotif />

      <header>
        <span className={eyebrowClass}>Historial de competidor</span>
        <h1 className="mt-1 font-display text-4xl font-bold">{profile.fullName}</h1>
      </header>

      {/* La tarjeta destacada de la página: filete de oro arriba y fondo con un
          tinte de pine para que no se lea como una más de la lista. Grid y no
          flex-wrap — con tres cifras, `flex-wrap` las amontonaba a la izquierda
          y dejaba medio ancho vacío. */}
      <section className={`${cardClass} relative overflow-hidden border-pine/30 bg-pine/[0.04]`}>
        <span className="absolute inset-x-0 top-0 h-1 bg-gold" aria-hidden />
        <div className="mt-1 flex items-center gap-2">
          <PeakIcon />
          <span className={eyebrowClass}>Trayectoria</span>
        </div>
        {/* Las tres en pine, no una en oro: son tres hechos del mismo rango, y
            el oro sobre el hueso de la tarjeta queda en 1.8:1 y se pierde a esta
            talla — el mismo hallazgo que ya fijó el color de `StatTile`. */}
        <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-3">
          <Figure
            value={String(career.events)}
            label={career.events === 1 ? 'Competencia' : 'Competencias'}
            tone="text-pine"
            large
          />
          {career.bestRank !== null && (
            <Figure value={ordinal(career.bestRank)} label="Mejor puesto" tone="text-pine" large />
          )}
          {/* Un cero grande en pantalla pesa más que la ausencia del dato. */}
          {career.podiums > 0 && (
            <Figure
              value={String(career.podiums)}
              label={career.podiums === 1 ? 'Podio' : 'Podios'}
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
          <span className={eyebrowClass}>Tus mejores resultados</span>
          <ul className="flex flex-col gap-4">
            {best.map((event) => (
              <BestResult key={event.eventSlug} event={event} />
            ))}
          </ul>

          <div className="border-t border-cardborder pt-5">
            {trend ? (
              <TrendLine trend={trend} />
            ) : (
              <p className="text-base text-muted">Con una segunda competencia aparece tu tendencia.</p>
            )}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <span className={eyebrowClass}>Competencias</span>
        {profile.events.map((event) => (
          <EventCard key={event.eventSlug} event={event} />
        ))}
      </section>

      <p className="border-t border-cardborder pt-6 text-base text-muted">
        Este historial lo lleva{' '}
        <a href="/" className="font-display font-semibold text-pine underline decoration-gold decoration-2 underline-offset-4">
          Crux
        </a>
        , plataforma de competencias de escalada.
      </p>
    </main>
  );
}
