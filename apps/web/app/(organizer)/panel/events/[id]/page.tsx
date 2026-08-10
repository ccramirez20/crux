import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { categories, eq, events, inArray, problems, rounds } from '@crux/db';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { TopographicMotif } from '@/components/topographic-motif';
import { EventStructure } from './event-structure';

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

  const [event] = await db
    .select({
      id: events.id,
      name: events.name,
      ownerId: events.ownerId,
      scoringFormat: events.scoringFormat,
      slug: events.slug,
    })
    .from(events)
    .where(eq(events.id, eventId));
  if (!event) {
    redirect('/panel');
  }

  const eventCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.eventId, eventId))
    .orderBy(categories.name);
  const categoryIds = eventCategories.map((category) => category.id);

  const categoryRounds = categoryIds.length
    ? await db
        .select()
        .from(rounds)
        .where(inArray(rounds.categoryId, categoryIds))
        .orderBy(rounds.order)
    : [];
  const roundIds = categoryRounds.map((round) => round.id);

  const roundProblems = roundIds.length
    ? await db
        .select()
        .from(problems)
        .where(inArray(problems.roundId, roundIds))
        .orderBy(problems.number)
    : [];

  const structuredCategories = eventCategories.map((category) => ({
    ...category,
    rounds: categoryRounds
      .filter((round) => round.categoryId === category.id)
      .map((round) => ({
        ...round,
        problems: roundProblems.filter((problem) => problem.roundId === round.id),
      })),
  }));

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 px-4 py-12">
      <div className="w-full max-w-2xl">
        <TopographicMotif />
      </div>
      <h1 className="font-display text-3xl font-bold">{event.name}</h1>
      <p className="max-w-2xl text-center text-sm text-muted">
        Cada categoría agrupa competidores (por edad, género o nivel). Dentro de cada categoría
        van sus rondas (clasificatoria, semifinal, final), y dentro de cada ronda, los bloques que
        los jueces van a puntuar.
      </p>
      <EventStructure
        eventId={event.id}
        categories={structuredCategories}
        isOwner={event.ownerId === session.user.id}
        scoringFormat={event.scoringFormat}
        slug={event.slug}
      />
    </main>
  );
}
