import { notFound } from 'next/navigation';
import { athletes, categories, eq, events, problems, registrations, rounds } from '@crux/db';
import { getDb } from '@/lib/db';
import { TopographicMotif } from '@/components/topographic-motif';
import { CaptureApp, type JudgeCategory } from '../capture-app';

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

  // Two round trips, not five. Every query here costs a ~85ms hop to the
  // database, and a judge opening this on gym wifi feels each one: the old
  // categories → rounds → problems → registrations chain spent most of a
  // second waiting. The tree comes back as one joined result, and
  // registrations filter on eventId directly so they don't have to wait for
  // the category ids.
  const [treeRows, eventRegistrations] = await Promise.all([
    db
      .select({
        categoryId: categories.id,
        categoryName: categories.name,
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
      .where(eq(categories.eventId, event.id))
      .orderBy(categories.name, rounds.order, problems.number),
    db
      .select({
        id: registrations.id,
        bibNumber: registrations.bibNumber,
        categoryId: registrations.categoryId,
        athleteFullName: athletes.fullName,
      })
      .from(registrations)
      .innerJoin(athletes, eq(registrations.athleteId, athletes.id))
      .where(eq(registrations.eventId, event.id)),
  ]);

  const structuredCategories: JudgeCategory[] = [];
  for (const row of treeRows) {
    let category = structuredCategories.find((c) => c.id === row.categoryId);
    if (!category) {
      category = { id: row.categoryId, name: row.categoryName, rounds: [] };
      structuredCategories.push(category);
    }
    // A category with no rounds, or a round with no blocks, still comes back
    // from the left join — with null columns. Both are ordinary states while
    // an organizer is still setting the event up.
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

  // A QR for another event's block must not open here, or a judge could
  // capture against a block this page never listed.
  const knownProblem = structuredCategories.some((category) =>
    category.rounds.some((round) => round.problems.some((problem) => problem.id === lockedProblemId)),
  );
  if (lockedProblemId && !knownProblem) {
    notFound();
  }

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
