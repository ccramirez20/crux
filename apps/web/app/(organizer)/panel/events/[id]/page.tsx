import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, categories, eq, events, problems, rounds } from '@crux/db';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { TopographicMotif } from '@/components/topographic-motif';
import { DISCIPLINE_LABEL, SCORING_FORMAT_LABEL, formatEventDate, labelFor } from '@/lib/labels';
import { cardClass } from '@/lib/ui';
import { EventStructure } from './event-structure';
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
      slug: events.slug,
      judgeCode: events.judgeCode,
    })
    .from(events)
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
      problemId: problems.id,
      problemNumber: problems.number,
      problemName: problems.name,
    })
    .from(categories)
    .leftJoin(rounds, eq(rounds.categoryId, categories.id))
    .leftJoin(problems, eq(problems.roundId, rounds.id))
    .where(eq(categories.eventId, eventId))
    .orderBy(categories.name, rounds.order, problems.number);

  type Problem = { id: string; number: number; name: string | null };
  type Round = { id: string; type: string; order: number; problems: Problem[] };
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
      round = { id: row.roundId, type: row.roundType, order: row.roundOrder, problems: [] };
      category.rounds.push(round);
    }
    if (row.problemId === null || row.problemNumber === null) {
      continue;
    }
    round.problems.push({ id: row.problemId, number: row.problemNumber, name: row.problemName });
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
        <h1 className="font-display text-3xl font-bold">{event.name}</h1>
        <p className="text-sm text-muted">
          {labelFor(DISCIPLINE_LABEL, event.discipline)}
          {date ? ` · ${date}` : ' · sin fecha'} ·{' '}
          {labelFor(SCORING_FORMAT_LABEL, event.scoringFormat)}
        </p>
      </div>

      <div className="flex w-full max-w-2xl flex-col gap-3">
        <ShareLink slug={event.slug} />
        {event.judgeCode && (
          <div className={`${cardClass} flex flex-col gap-1`}>
            <span className="font-display font-semibold">Código para los jueces</span>
            <p className="text-sm text-muted">
              Quien escanee el QR de un bloque tendrá que escribirlo antes de registrar intentos.
              Dáselo solo a tus jueces, no lo pegues junto al QR.
            </p>
            <code className="mt-1 w-fit rounded bg-stone px-3 py-2 font-display text-xl font-bold tracking-widest">
              {event.judgeCode}
            </code>
          </div>
        )}
      </div>

      <div className="w-full max-w-2xl">
        <h2 className="font-display text-xl font-bold">Estructura de la competencia</h2>
        <p className="mt-1 text-sm text-muted">
          Cada categoría agrupa competidores por edad, género o nivel. Dentro van sus rondas, y
          dentro de cada ronda, los bloques que los jueces puntúan.
        </p>
      </div>

      <EventStructure
        eventId={event.id}
        categories={structuredCategories}
        scoringFormat={event.scoringFormat}
        slug={event.slug}
      />
    </main>
  );
}
