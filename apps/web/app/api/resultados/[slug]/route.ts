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
  // el 2026-08-14: 300 muestras a 1/s sobre /resultados/liga-paramo, midiendo
  // la cabecera `Date` del servidor contra el `updatedAt` del payload, que se
  // sella al calcular. El atraso normal está bien —4.5 s de mediana, 5.7 s en
  // p90— pero el p99 daba 38.1 s: seis sondeos seguidos respondiendo
  // `X-Vercel-Cache: HIT` con la misma foto vieja.
  //
  // No era un fallo, era este encabezado autorizándolo. Las tres ventanas se
  // suman: 5 s de `unstable_cache` en getLeaderboard + 5 de `s-maxage` + 30 de
  // `stale-while-revalidate` = 40 s de techo, y 38.1 cabe ahí.
  //
  // Medio minuto de copia vieja es medio minuto de mentira en una pantalla que
  // dice "En vivo", y el reloj de la esquina sale de ese mismo `updatedAt`, así
  // que lo que ve la sala es la hora congelada. Con swr=5 el techo baja a 15 s
  // y el peor caso de punta a punta —con el sondeo de 5 s del cliente— queda en
  // 20 s contra los 45 de antes; lo típico son ~7 s. Lo que se paga: al vencer
  // la ventana, un sondeo por región espera al origen en vez de recibir la
  // copia vieja. 94 ms de mediana, 447 ms el peor de las 300 muestras, y lo
  // paga uno cada 5 s, no la sala.
  //
  // Re-medido contra producción el 2026-08-15, que era lo que faltaba: p50
  // 4.7 s, p90 5.96, p95 6.01. El techo de 15 s se cumple **mientras alguien
  // esté sondeando**. Lo que salió de nuevo: tras un rato sin tráfico, las
  // primeras peticiones reciben una foto tan vieja como el silencio —175 s
  // exactos tras 175 s de pausa, y ya con `X-Vercel-Cache: MISS`, así que no
  // es el CDN sino el `unstable_cache` de getLeaderboard sirviendo su copia
  // vieja mientras revalida por detrás. Duró siete sondeos; las 143 muestras
  // siguientes cayeron todas bajo el techo.
  //
  // No se toca por ahora: el cliente sondea cada 5 s y `use-leaderboard` se
  // queda con el `updatedAt` más nuevo, así que lo ve quien abre la pantalla
  // después de una pausa —entre rondas— y se corrige solo al siguiente sondeo.
  // El día que estorbe, el arreglo es etiquetar la caché y llamar
  // `revalidateTag` al recibir intentos, en vez de esperar al temporizador.
  return NextResponse.json(leaderboard, {
    headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=5' },
  });
}
