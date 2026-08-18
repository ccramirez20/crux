import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { and, count, eq, events, organizations, registrations, sql } from '@crux/db';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { TopographicMotif } from '@/components/topographic-motif';
import { AdminBadge } from '@/components/admin-badge';
import { cardClass, primaryButtonClass } from '@/lib/ui';
import { isAdmin } from '@/lib/admin';
import { DISCIPLINE_LABEL, formatEventDate, labelFor } from '@/lib/labels';
import { ORGANIZATION_COOKIE, resolveSelectedOrganization } from '@/lib/organizations';
import { OrganizationPicker } from './organization-picker';
import { SignOutButton } from './sign-out-button';

export default async function OrganizerHomePage() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  const ownerId = session?.user.id ?? '';
  const db = getDb();

  const myOrganizations = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      location: organizations.location,
      logo: organizations.logo,
    })
    .from(organizations)
    .where(eq(organizations.ownerId, ownerId))
    .orderBy(organizations.createdAt);
  const selected = resolveSelectedOrganization(
    myOrganizations,
    (await cookies()).get(ORGANIZATION_COOKIE)?.value,
  );

  // Scoped to the signed-in organizer. Without this every organizer sees every
  // other gym's events — invisible today with a single account, a data leak the
  // moment there are two.
  //
  // El filtro por organización va **encima** de ese, no en su lugar: es
  // comodidad de vista para la cuenta que lleva dos (la de producción y la de
  // pruebas), y quien decide qué puede verse sigue siendo `ownerId`.
  const myEvents = await db
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
    .where(
      selected
        ? and(eq(events.ownerId, ownerId), eq(events.organizationId, selected.id))
        : eq(events.ownerId, ownerId),
    )
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
          <div className="flex items-center gap-4">
            {/* Solo para quien administra la plataforma. Para el resto el enlace
                no existe, igual que la ruta. */}
            {isAdmin(session?.user.email) && (
              <Link href="/panel/invites" className="text-sm font-medium text-pine underline">
                Invitaciones
              </Link>
            )}
            <a href="/manual.html" target="_blank" rel="noreferrer" className="text-sm font-medium text-pine underline">
              Manual
            </a>
            <SignOutButton />
          </div>
        </div>

        {/* Solo para quien administra la plataforma, igual que el enlace de
            invitaciones de arriba. Para el resto no existe. */}
        {isAdmin(session?.user.email) && <AdminBadge />}

        <div>
          <h1 className="font-display text-3xl font-bold">Tus eventos</h1>
          <p className="mt-1 text-sm text-muted">
            Crea un evento, arma sus categorías y bloques, y comparte el enlace de inscripción.
          </p>
        </div>

        {/* Quién organiza, en pantalla. Con una organización —el caso de un
            gimnasio— basta con nombrarla; con dos hay que poder cambiar, y eso
            solo le pasa a la cuenta que administra la plataforma. */}
        {selected && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {selected.logo && (
                // eslint-disable-next-line @next/next/no-img-element -- logo remoto de Vercel Blob, no un asset que next/image pueda optimizar
                <img
                  src={selected.logo}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-lg object-contain"
                />
              )}
              {myOrganizations.length > 1 ? (
                <OrganizationPicker organizations={myOrganizations} selectedId={selected.id} />
              ) : (
                <p className="text-sm text-muted">
                  <span className="font-display font-semibold text-pine">{selected.name}</span> ·{' '}
                  {selected.location}
                </p>
              )}
            </div>
            <Link href="/panel/organization" className="text-sm font-medium text-pine underline">
              Logo del gimnasio
            </Link>
          </div>
        )}

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
