import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { eq, events } from '@crux/db';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getLeaderboard } from '@/lib/leaderboard';
import { buildLeaderboardCsv } from '@/lib/csv-export';

// Mismo chequeo de sesión + ownerId que la página del evento
// (app/(organizer)/panel/events/[id]/page.tsx): un evento que no es tuyo es
// indistinguible de uno que no existe.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: eventId } = await params;

  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const [event] = await getDb()
    .select({ slug: events.slug, ownerId: events.ownerId })
    .from(events)
    .where(eq(events.id, eventId));

  if (!event || event.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Evento no encontrado.' }, { status: 404 });
  }

  const leaderboard = await getLeaderboard(event.slug);
  if (!leaderboard) {
    return NextResponse.json({ error: 'Evento no encontrado.' }, { status: 404 });
  }

  const csv = buildLeaderboardCsv(leaderboard);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${event.slug}.csv"`,
    },
  });
}
