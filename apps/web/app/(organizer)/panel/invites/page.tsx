import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { desc, eq, inviteCodes, user } from '@crux/db';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { TopographicMotif } from '@/components/topographic-motif';
import { cardClass, eyebrowClass, primaryButtonClass } from '@/lib/ui';
import { isAdmin } from '@/lib/admin';
import { createInvite } from './actions';

export const metadata: Metadata = {
  title: 'Invitaciones · Crux',
  robots: { index: false, follow: false },
};

function formatIssued(at: Date): string {
  return at.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Bogota',
  });
}

export default async function InvitesPage() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  // notFound y no un "no tienes permiso": para quien no es administrador, la
  // ruta no existe. Un 403 confirma que sí existe algo aquí.
  if (!session || !isAdmin(session.user.email)) {
    notFound();
  }

  const codes = await getDb()
    .select({
      id: inviteCodes.id,
      code: inviteCodes.code,
      createdAt: inviteCodes.createdAt,
      usedAt: inviteCodes.usedAt,
      usedByName: user.name,
    })
    .from(inviteCodes)
    .leftJoin(user, eq(user.id, inviteCodes.usedBy))
    .orderBy(desc(inviteCodes.createdAt));

  const available = codes.filter((invite) => invite.usedAt === null);

  return (
    <main className="flex min-h-screen flex-col items-center gap-8 px-4 py-12">
      <div className="w-full max-w-2xl">
        <TopographicMotif />
      </div>
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <Link href="/panel" className="font-display text-lg font-bold tracking-wide text-pine">
          CRUX
        </Link>

        <div>
          <span className={eyebrowClass}>Administración</span>
          <h1 className="mt-1 font-display text-3xl font-bold">Invitaciones</h1>
          <p className="mt-2 leading-relaxed text-muted">
            Cada código sirve para crear una cuenta de organizador, una sola vez. Genera uno por
            persona y compártelo directo; el código muere al usarse.
          </p>
        </div>

        {/* La lectura agregada de la pantalla: cuántas quedan sin repartir. */}
        <section className={`${cardClass} flex items-baseline gap-3`}>
          <span className="font-display text-[3.25rem] font-bold leading-none tabular-nums text-pine">
            {available.length}
          </span>
          <span className="text-muted">
            {available.length === 1 ? 'invitación sin usar' : 'invitaciones sin usar'} de{' '}
            {codes.length} {codes.length === 1 ? 'emitida' : 'emitidas'}
          </span>
        </section>

        <form action={createInvite}>
          <button type="submit" className={primaryButtonClass}>
            Generar código
          </button>
        </form>

        {codes.length === 0 ? (
          <p className="text-muted">Todavía no has generado ninguna invitación.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {codes.map((invite) => (
              <li
                key={invite.id}
                className={`${cardClass} flex flex-wrap items-center justify-between gap-3`}
              >
                <span
                  className={`font-display text-xl font-bold tracking-[0.18em] tabular-nums ${
                    invite.usedAt ? 'text-muted line-through' : 'text-ink'
                  }`}
                >
                  {invite.code}
                </span>
                <span className="text-sm text-muted">
                  {invite.usedAt
                    ? `Usada por ${invite.usedByName ?? 'un organizador'}`
                    : `Emitida el ${formatIssued(invite.createdAt)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
