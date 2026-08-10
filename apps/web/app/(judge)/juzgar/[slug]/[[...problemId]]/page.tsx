import { notFound } from 'next/navigation';
import { athletes, categories, eq, events, inArray, problems, registrations, rounds } from '@crux/db';
import { getDb } from '@/lib/db';
import { TopographicMotif } from '@/components/topographic-motif';
import { CaptureApp } from '../capture-app';

// One optional catch-all instead of two pages: `/juzgar/[slug]` (free
// navigation) and `/juzgar/[slug]/[problemId]` (arrived by QR, block
// pre-locked) load exactly the same tree and differ only in whether a block
// starts selected.
export default async function JuzgarPage({
  params,
}: {
  params: Promise<{ slug: string; problemId?: string[] }>;
}) {
  const { slug, problemId } = await params;
  if (problemId && problemId.length > 1) {
    notFound();
  }
  const lockedProblemId = problemId?.[0] ?? null;

  const db = getDb();

  const [event] = await db
    .select({ id: events.id, slug: events.slug, discipline: events.discipline })
    .from(events)
    .where(eq(events.slug, slug));
  if (!event) {
    notFound();
  }

  const eventCategories = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.eventId, event.id))
    .orderBy(categories.name);
  const categoryIds = eventCategories.map((category) => category.id);

  const categoryRounds = categoryIds.length
    ? await db
        .select({ id: rounds.id, type: rounds.type, order: rounds.order, categoryId: rounds.categoryId })
        .from(rounds)
        .where(inArray(rounds.categoryId, categoryIds))
        .orderBy(rounds.order)
    : [];
  const roundIds = categoryRounds.map((round) => round.id);

  const roundProblems = roundIds.length
    ? await db
        .select({ id: problems.id, number: problems.number, name: problems.name, roundId: problems.roundId })
        .from(problems)
        .where(inArray(problems.roundId, roundIds))
        .orderBy(problems.number)
    : [];

  // A QR for another event's block must not open here, or a judge could
  // capture against a block this page never listed.
  if (lockedProblemId && !roundProblems.some((problem) => problem.id === lockedProblemId)) {
    notFound();
  }

  const structuredCategories = eventCategories.map((category) => ({
    ...category,
    rounds: categoryRounds
      .filter((round) => round.categoryId === category.id)
      .map((round) => ({
        ...round,
        problems: roundProblems.filter((problem) => problem.roundId === round.id),
      })),
  }));

  const eventRegistrations = categoryIds.length
    ? await db
        .select({
          id: registrations.id,
          bibNumber: registrations.bibNumber,
          categoryId: registrations.categoryId,
          athleteFullName: athletes.fullName,
        })
        .from(registrations)
        .innerJoin(athletes, eq(registrations.athleteId, athletes.id))
        .where(inArray(registrations.categoryId, categoryIds))
    : [];

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 px-4 py-12">
      <div className="w-full max-w-2xl">
        <TopographicMotif />
      </div>
      <h1 className="font-display text-2xl font-bold">Juzgar</h1>
      <CaptureApp
        event={event}
        categories={structuredCategories}
        registrations={eventRegistrations}
        lockedProblemId={lockedProblemId}
      />
    </main>
  );
}
