import Link from 'next/link';
import { headers } from 'next/headers';
import { count, eq, events, registrations, sql } from '@crux/db';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { TopographicMotif } from '@/components/topographic-motif';
import { cardClass, primaryButtonClass } from '@/lib/ui';
import { DISCIPLINE_LABEL, formatEventDate, labelFor } from '@/lib/labels';
import { SignOutButton } from './sign-out-button';

export default async function OrganizerHomePage() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  const ownerId = session?.user.id ?? '';

  // Scoped to the signed-in organizer. Without this every organizer sees every
  // other gym's events — invisible today with a single account, a data leak the
  // moment there are two.
  const myEvents = await getDb()
    .select({
      id: events.id,
      name: events.name,
      slug: events.slug,
      date: events.date,
      discipline: events.discipline,
      registrationCount: count(registrations.id),
    })
    .from(events)
    .leftJoin(registrations, eq(registrations.eventId, events.id))
    .where(eq(events.ownerId, ownerId))
    .groupBy(events.id)
    .orderBy(sql`${events.date} desc nulls last`);

  return (
    <main className="flex min-h-screen flex-col items-center gap-8 px-4 py-12">
      <div className="w-full max-w-2xl">
        <TopographicMotif />
      </div>
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <span className="font-display text-lg font-bold tracking-wide text-pine">CRUX</span>
          <SignOutButton />
        </div>

        <div>
          <h1 className="font-display text-3xl font-bold">Tus eventos</h1>
          <p className="mt-1 text-sm text-muted">
            Crea un evento, arma sus categorías y bloques, y comparte el enlace de inscripción.
          </p>
        </div>

        {myEvents.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {myEvents.map((event) => {
              const date = formatEventDate(event.date);
              return (
                <li key={event.id}>
                  <Link
                    href={`/panel/events/${event.id}`}
                    className={`${cardClass} block transition hover:border-pine`}
                  >
                    <span className="font-display text-[17px] font-semibold text-pine">
                      {event.name}
                    </span>
                    <span className="mt-1 block text-sm text-muted">
                      {labelFor(DISCIPLINE_LABEL, event.discipline)}
                      {date ? ` · ${date}` : ' · sin fecha'} ·{' '}
                      {event.registrationCount === 1
                        ? '1 inscrito'
                        : `${event.registrationCount} inscritos`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className={`${cardClass} flex flex-col items-start gap-3`}>
            <p className="font-display text-lg font-semibold">Aún no tienes eventos</p>
            <p className="text-sm text-muted">
              Un evento agrupa las categorías, las rondas y los bloques de una competencia. Crea el
              primero para poder abrir inscripciones.
            </p>
          </div>
        )}

        <Link href="/panel/events/new" className={`${primaryButtonClass} w-fit`}>
          Crear evento
        </Link>
      </div>
    </main>
  );
}
