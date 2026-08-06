import { notFound } from 'next/navigation';
import { categories, eq, events } from '@crux/db';
import { getDb } from '@/lib/db';
import { TopographicMotif } from '@/components/topographic-motif';
import { RegistrationForm } from './registration-form';

export default async function InscripcionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = getDb();

  const [event] = await db
    .select({ id: events.id, name: events.name, date: events.date })
    .from(events)
    .where(eq(events.slug, slug));
  if (!event) {
    notFound();
  }

  const eventCategories = await db
    .select({
      id: categories.id,
      name: categories.name,
      gender: categories.gender,
      minAge: categories.minAge,
      maxAge: categories.maxAge,
    })
    .from(categories)
    .where(eq(categories.eventId, event.id))
    .orderBy(categories.name);

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 px-4 py-12">
      <div className="w-full max-w-2xl">
        <TopographicMotif />
      </div>
      <h1 className="font-display text-3xl font-bold">{event.name}</h1>
      {eventCategories.length === 0 ? (
        <p className="max-w-md text-center text-sm text-muted">
          Inscripciones aún no disponibles para este evento.
        </p>
      ) : (
        <RegistrationForm eventId={event.id} eventDate={event.date} categories={eventCategories} />
      )}
    </main>
  );
}
