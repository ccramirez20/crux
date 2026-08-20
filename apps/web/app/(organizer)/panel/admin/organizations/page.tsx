import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { count, eq, events, organizations, registrations, sql, user } from '@crux/db';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { TopographicMotif } from '@/components/topographic-motif';
import { cardClass, eyebrowClass } from '@/lib/ui';
import { isAdmin } from '@/lib/admin';
import { DISCIPLINE_LABEL, formatEventDate, labelFor } from '@/lib/labels';

export const metadata: Metadata = {
  title: 'Organizaciones · Crux',
  robots: { index: false, follow: false },
};

export default async function AdminOrganizationsPage() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  // Mismo patrón que /panel/invites: notFound y no un "no tienes permiso",
  // para que la ruta parezca no existir a quien no administra la plataforma.
  if (!session || !isAdmin(session.user.email)) {
    notFound();
  }

  const db = getDb();

  const orgs = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      location: organizations.location,
      ownerName: user.name,
      ownerEmail: user.email,
    })
    .from(organizations)
    .innerJoin(user, eq(user.id, organizations.ownerId))
    .orderBy(organizations.createdAt);

  // Sin filtro de ownerId a propósito: es la única vista que junta el evento
  // de todas las organizaciones, para llevar control desde la cuenta que
  // administra la plataforma — el resto del panel sigue filtrando por dueño.
  const allEvents = await db
    .select({
      id: events.id,
      organizationId: events.organizationId,
      name: events.name,
      slug: events.slug,
      date: events.date,
      discipline: events.discipline,
      registrationCount: count(registrations.id),
    })
    .from(events)
    .leftJoin(registrations, eq(registrations.eventId, events.id))
    .groupBy(events.id)
    .orderBy(sql`${events.date} desc nulls last`);

  const eventsByOrg = new Map<string, typeof allEvents>();
  for (const event of allEvents) {
    const list = eventsByOrg.get(event.organizationId) ?? [];
    list.push(event);
    eventsByOrg.set(event.organizationId, list);
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-8 px-4 py-12">
      <div className="w-full max-w-2xl">
        <TopographicMotif />
      </div>
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Link href="/panel" className="text-sm font-medium text-pine underline">
            ← Panel
          </Link>
          <Link href="/panel" className="font-display text-lg font-bold tracking-wide text-pine">
            CRUX
          </Link>
        </div>

        <div>
          <span className={eyebrowClass}>Administración</span>
          <h1 className="mt-1 font-display text-3xl font-bold">Organizaciones</h1>
          <p className="mt-2 leading-relaxed text-muted">
            Todas las organizaciones y sus eventos, sin importar quién los creó. Solo lectura.
          </p>
        </div>

        {orgs.length === 0 ? (
          <p className="text-muted">Todavía no hay organizaciones.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {orgs.map((org) => {
              const orgEvents = eventsByOrg.get(org.id) ?? [];
              return (
                <li key={org.id} className={`${cardClass} flex flex-col gap-3`}>
                  <div>
                    <p className="font-display text-lg font-semibold text-pine">
                      {org.name} · {org.location}
                    </p>
                    <p className="text-sm text-muted">
                      {org.ownerName} · {org.ownerEmail}
                    </p>
                  </div>

                  {orgEvents.length === 0 ? (
                    <p className="text-sm text-muted">Sin eventos.</p>
                  ) : (
                    <ul className="flex flex-col gap-2 border-t border-cardborder pt-3">
                      {orgEvents.map((event) => {
                        const date = formatEventDate(event.date);
                        return (
                          <li
                            key={event.id}
                            className="flex flex-wrap items-center justify-between gap-2 text-sm"
                          >
                            <span>
                              <span className="font-medium text-ink">{event.name}</span> ·{' '}
                              {labelFor(DISCIPLINE_LABEL, event.discipline)}
                              {date ? ` · ${date}` : ' · sin fecha'} ·{' '}
                              {event.registrationCount === 1
                                ? '1 inscrito'
                                : `${event.registrationCount} inscritos`}
                            </span>
                            <span className="flex gap-3">
                              <a
                                href={`/resultados/${event.slug}`}
                                className="font-medium text-pine underline"
                              >
                                Resultados
                              </a>
                              {/* Solo funciona si esta cuenta es la dueña del evento —
                                  el panel sigue exigiendo ownerId, esta vista no lo
                                  cambia. */}
                              <a
                                href={`/panel/events/${event.id}`}
                                className="font-medium text-pine underline"
                              >
                                Panel
                              </a>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
