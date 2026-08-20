import { notFound } from 'next/navigation';
import { isRegistrationOpen } from '@crux/core';
import { categories, eq, events } from '@crux/db';
import { getDb } from '@/lib/db';
import { TopographicMotif } from '@/components/topographic-motif';
import { DISCIPLINE_LABEL, formatEventDate, labelFor } from '@/lib/labels';
import { RegistrationForm } from './registration-form';

export default async function InscripcionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = getDb();

  const [event] = await db
    .select({
      id: events.id,
      name: events.name,
      date: events.date,
      discipline: events.discipline,
      timezone: events.timezone,
      registrationDeadline: events.registrationDeadline,
    })
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
      <div className="flex max-w-sm flex-col items-center gap-1 text-center">
        <span className="text-xs uppercase tracking-wide text-muted">Inscripción</span>
        <h1 className="font-display text-3xl font-bold">{event.name}</h1>
        <p className="text-sm text-muted">
          {labelFor(DISCIPLINE_LABEL, event.discipline)}
          {formatEventDate(event.date) ? ` · ${formatEventDate(event.date)}` : ''}
        </p>
      </div>
      {!isRegistrationOpen(event.registrationDeadline, event.timezone) ? (
        // Se dice la fecha, no solo que cerró: quien llega tarde necesita saber
        // si se le pasó por un día o por un mes, y a quién acudir.
        <p className="max-w-sm rounded-lg border border-cardborder bg-card px-4 py-5 text-center text-sm text-muted">
          Las inscripciones se cerraron
          {formatEventDate(event.registrationDeadline)
            ? ` el ${formatEventDate(event.registrationDeadline)}`
            : ''}
          . Si necesitas inscribirte, habla con quien organiza.
        </p>
      ) : eventCategories.length === 0 ? (
        <p className="max-w-sm rounded-lg border border-cardborder bg-card px-4 py-5 text-center text-sm text-muted">
          Las inscripciones todavía no están abiertas: quien organiza aún no ha creado las
          categorías. Vuelve a intentarlo más tarde.
        </p>
      ) : (
        <RegistrationForm eventId={event.id} eventDate={event.date} categories={eventCategories} />
      )}
    </main>
  );
}
