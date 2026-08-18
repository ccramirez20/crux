import { NextResponse } from 'next/server';
import { getLeaderboard, type LeaderboardPayload } from '@/lib/leaderboard';

type LeaderboardResponse = LeaderboardPayload | { error: string };

// What the projected screen polls every 5s. The computation itself is cached
// for the same 5s (see getLeaderboard), so a full room of phones refreshing in
// step still costs one read of the database per tick; s-maxage lets anything
// in front absorb the rest.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse<LeaderboardResponse>> {
  const { slug } = await params;
  const leaderboard = await getLeaderboard(slug);
  if (!leaderboard) {
    return NextResponse.json({ error: 'Evento no encontrado.' }, { status: 404 });
  }

  // `stale-while-revalidate` bajó de 30 s a 5. Cronometrado contra producción
  // el 2026-08-14: 300 muestras a 1/s sobre /resultados/liga-paramo, p50 4.5s,
  // p90 5.7s. Re-medido el 2026-08-15: p50 4.7s, p90 5.96, p95 6.01 — el techo
  // de 15 s se cumple mientras alguien esté sondeando.
  //
  // Lo que no cubría el sondeo: tras un rato sin tráfico (ronda entre bloques,
  // teléfono bloqueado), la primera petición recibía una foto tan vieja como
  // el silencio —175 s exactos tras 175 s de pausa, con `X-Vercel-Cache: MISS`,
  // así que no era el CDN sino `unstable_cache` en getLeaderboard sirviendo su
  // copia vieja mientras revalidaba por detrás. El reloj de la esquina sale de
  // ese mismo `updatedAt`, así que la sala veía la hora congelada hasta el
  // pausa entero. Arreglado el 2026-08-18: getLeaderboard lleva
  // `tags: ['leaderboard']` y /api/attempts llama `revalidateTag('leaderboard')`
  // al recibir un intento, así que la próxima lectura ya no espera el
  // temporizador.
  return NextResponse.json(leaderboard, {
    headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=5' },
  });
}
