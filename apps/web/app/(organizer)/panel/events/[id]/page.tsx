import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  and,
  athletes,
  categories,
  eq,
  events,
  organizations,
  problems,
  registrations,
  rounds,
} from '@crux/db';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { TopographicMotif } from '@/components/topographic-motif';
import {
  DISCIPLINE_LABEL,
  SCORING_FORMAT_LABEL,
  formatEventDate,
  labelFor,
  problemUnit,
} from '@/lib/labels';
import { cardClass, eyebrowClass } from '@/lib/ui';
import { EventStructure } from './event-structure';
import { EventForm } from './event-form';
import { Roster, type RosterCategory } from './roster';
import { ShareLink } from './share-link';

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: eventId } = await params;

  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    redirect('/sign-in');
  }

  const db = getDb();

  // Scoped by owner, not just by id: this page hands out every problem id of the
  // event, and a problem id is the judge-capture URL. Filtering only the edit
  // forms left any signed-in organizer able to read — and then write attempts
  // into — someone else's competition by guessing nothing more than the event id.
  // An event that isn't yours is indistinguishable from one that doesn't exist.
  const [event] = await db
    .select({
      id: events.id,
      name: events.name,
      scoringFormat: events.scoringFormat,
      discipline: events.discipline,
      date: events.date,
      registrationDeadline: events.registrationDeadline,
      slug: events.slug,
      judgeCode: events.judgeCode,
      timezone: events.timezone,
      organizationName: organizations.name,
    })
    .from(events)
    .innerJoin(organizations, eq(organizations.id, events.organizationId))
    .where(and(eq(events.id, eventId), eq(events.ownerId, session.user.id)));
  if (!event) {
    redirect('/panel');
  }

  // One joined query instead of the categories → rounds → problems chain: each
  // hop to the database costs ~85ms, and this page waited out three of them.
  const treeRows = await db
    .select({
      categoryId: categories.id,
      categoryName: categories.name,
      categoryGender: categories.gender,
      categoryMinAge: categories.minAge,
      categoryMaxAge: categories.maxAge,
      categoryLevel: categories.level,
      roundId: rounds.id,
      roundType: rounds.type,
      roundOrder: rounds.order,
      roundAdvances: rounds.advances,
      problemId: problems.id,
      problemNumber: problems.number,
      problemName: problems.name,
      problemTopPoints: problems.topPoints,
      problemZonePoints: problems.zonePoints,
    })
    .from(categories)
    .leftJoin(rounds, eq(rounds.categoryId, categories.id))
    .leftJoin(problems, eq(problems.roundId, rounds.id))
    .where(eq(categories.eventId, eventId))
    .orderBy(categories.name, rounds.order, problems.number);

  // Los inscritos son otro eje: no cuelgan de la ronda ni del bloque, cuelgan de
  // la categoría. Consulta aparte y no otro `leftJoin` sobre el árbol, porque
  // unir 20 inscritos contra 5 bloques multiplica las filas por nada.
  const rosterRows = await db
    .select({
      registrationId: registrations.id,
      categoryId: registrations.categoryId,
      categoryName: categories.name,
      bibNumber: registrations.bibNumber,
      athleteFullName: athletes.fullName,
    })
    .from(registrations)
    .innerJoin(athletes, eq(registrations.athleteId, athletes.id))
    .innerJoin(categories, eq(registrations.categoryId, categories.id))
    .where(eq(registrations.eventId, eventId))
    .orderBy(categories.name, registrations.createdAt);

  // Todas las del evento, no solo las que tienen inscritos: son los destinos a
  // los que el organizador puede mover a alguien, y la categoría correcta suele
  // ser precisamente la que está vacía.
  const allCategories = [...new Map(treeRows.map((r) => [r.categoryId, r.categoryName])).entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const rosterCategories: RosterCategory[] = [];
  for (const row of rosterRows) {
    let category = rosterCategories.find((c) => c.id === row.categoryId);
    if (!category) {
      category = { id: row.categoryId, name: row.categoryName, entries: [] };
      rosterCategories.push(category);
    }
    category.entries.push({
      registrationId: row.registrationId,
      athleteFullName: row.athleteFullName,
      bibNumber: row.bibNumber,
    });
  }

  type Problem = {
    id: string;
    number: number;
    name: string | null;
    topPoints: number | null;
    zonePoints: number | null;
  };
  type Round = {
    id: string;
    type: string;
    order: number;
    advances: number | null;
    problems: Problem[];
  };
  type Category = {
    id: string;
    name: string;
    gender: string | null;
    minAge: number | null;
    maxAge: number | null;
    level: string | null;
    rounds: Round[];
  };

  const structuredCategories: Category[] = [];
  for (const row of treeRows) {
    let category = structuredCategories.find((c) => c.id === row.categoryId);
    if (!category) {
      category = {
        id: row.categoryId,
        name: row.categoryName,
        gender: row.categoryGender,
        minAge: row.categoryMinAge,
        maxAge: row.categoryMaxAge,
        level: row.categoryLevel,
        rounds: [],
      };
      structuredCategories.push(category);
    }
    if (row.roundId === null || row.roundType === null || row.roundOrder === null) {
      continue;
    }
    let round = category.rounds.find((r) => r.id === row.roundId);
    if (!round) {
      round = {
        id: row.roundId,
        type: row.roundType,
        order: row.roundOrder,
        advances: row.roundAdvances,
        problems: [],
      };
      category.rounds.push(round);
    }
    if (row.problemId === null || row.problemNumber === null) {
      continue;
    }
    round.problems.push({
      id: row.problemId,
      number: row.problemNumber,
      name: row.problemName,
      topPoints: row.problemTopPoints,
      zonePoints: row.problemZonePoints,
    });
  }

  const date = formatEventDate(event.date);

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 px-4 py-12">
      <div className="w-full max-w-2xl">
        <TopographicMotif />
      </div>

      <div className="flex w-full max-w-2xl flex-col gap-2">
        <Link href="/panel" className="text-sm font-medium text-pine underline">
          ← Tus eventos
        </Link>
        <span className={eyebrowClass}>{event.organizationName}</span>
        <h1 className="font-display text-3xl font-bold">{event.name}</h1>
        <p className="text-sm text-muted">
          {labelFor(DISCIPLINE_LABEL, event.discipline)}
          {date ? ` · ${date}` : ' · sin fecha'} ·{' '}
          {labelFor(SCORING_FORMAT_LABEL, event.scoringFormat)}
        </p>
        <EventForm
          eventId={event.id}
          name={event.name}
          date={event.date}
          registrationDeadline={event.registrationDeadline}
          timezone={event.timezone}
          judgeCode={event.judgeCode}
        />
      </div>

      {/* Cerrado por defecto. Estas cuatro tarjetas se usan una vez —copias el
          enlace, lo pegas y no vuelves— y ocupaban 600 px por delante de las dos
          secciones de uso diario, que en un teléfono son 600 px de bajar antes
          de poder armar la competencia. `details` nativo, el mismo gesto que ya
          usan el formulario del evento, los inscritos y la estructura. */}
      <details className="w-full max-w-2xl">
        <summary className={`${cardClass} cursor-pointer font-display font-semibold marker:text-muted`}>
          Enlaces para compartir
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <ShareLink
            path={`/inscripcion/${event.slug}`}
            title="Enlace de inscripción"
            description="Compártelo por WhatsApp o redes. Quien lo abra se inscribe sin crear cuenta."
          />
          <ShareLink
            path={`/resultados/${event.slug}`}
            title="Tabla de resultados"
            description="La pantalla pública, la que abre la gente desde el teléfono. Se actualiza sola y no pide cuenta."
          />
          {/* Igual que el enlace "Proyectar →" de la tabla pública: proyectar
              desde un teléfono no existe. Una tablet en horizontal sí lo ve. */}
          <div className="hidden lg:block">
            <ShareLink
              path={`/resultados/${event.slug}/proyectar`}
              title="Pantalla para proyectar"
              description="La misma competencia en una sola pantalla, sin desplazarse: la tabla, las gráficas turnándose solas y las cifras de la ronda. Ábrela en el computador del proyector y déjala ahí todo el día."
            />
          </div>
          {event.judgeCode && (
            <div className={`${cardClass} flex flex-col gap-1`}>
              <span className="font-display font-semibold">Código para los jueces</span>
              <p className="text-sm text-muted">
                Quien escanee un QR tendrá que escribirlo antes de registrar intentos. Dáselo solo a
                tus jueces, no lo pegues junto al QR.
              </p>
              <code className="mt-1 w-fit rounded bg-stone px-3 py-2 font-display text-xl font-bold tracking-widest">
                {event.judgeCode}
              </code>
            </div>
          )}
        </div>
      </details>

      <div className="w-full max-w-2xl">
        <h2 className="font-display text-xl font-bold">Inscritos</h2>
        <p className="mt-1 text-sm text-muted">
          Quién se inscribió y con qué dorsal. El dorsal es opcional: si lo dejas vacío, los jueces
          buscan por nombre, que también funciona.
        </p>
      </div>

      <div className="w-full max-w-2xl">
        <Roster eventId={event.id} categories={rosterCategories} allCategories={allCategories} />
      </div>

      <div className="w-full max-w-2xl">
        <h2 className="font-display text-xl font-bold">Estructura de la competencia</h2>
        <p className="mt-1 text-sm text-muted">
          Cada categoría agrupa competidores por edad, género o nivel. Dentro van sus rondas, y
          dentro de cada ronda, {problemUnit(event.discipline).plural} que los jueces puntúan.
        </p>
      </div>

      <EventStructure
        eventId={event.id}
        categories={structuredCategories}
        discipline={event.discipline}
        scoringFormat={event.scoringFormat}
        slug={event.slug}
      />
    </main>
  );
}
