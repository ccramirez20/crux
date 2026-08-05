import Link from 'next/link';
import { events } from '@crux/db';
import { getDb } from '@/lib/db';
import { TopographicMotif } from '@/components/topographic-motif';
import { cardClass, primaryButtonClass } from '@/lib/ui';

export default async function OrganizerHomePage() {
  const allEvents = await getDb().select({ id: events.id, name: events.name }).from(events);

  return (
    <main className="flex min-h-screen flex-col items-center gap-8 px-4 py-12">
      <div className="w-full max-w-2xl">
        <TopographicMotif />
      </div>
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div className="font-display text-lg font-bold tracking-wide text-pine">CRUX</div>
        <h1 className="font-display text-3xl font-bold">Panel del organizador</h1>

        {allEvents.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {allEvents.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/panel/events/${event.id}`}
                  className={`${cardClass} block font-display text-[17px] font-semibold text-pine transition hover:border-pine`}
                >
                  {event.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Todavía no has creado ningún evento.</p>
        )}

        <Link href="/panel/events/new" className={`${primaryButtonClass} w-fit`}>
          + Crear evento
        </Link>
      </div>
    </main>
  );
}
