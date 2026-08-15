'use client';

import { useEffect, useState } from 'react';
import type { LeaderboardPayload } from '@/lib/leaderboard';

const REFRESH_MS = 5000;

/**
 * La tabla, refrescándose sola.
 *
 * Vive aquí y no dentro de una pantalla porque son dos las que la miran: la
 * tabla pública y el modo proyección. Duplicar el sondeo significaría duplicar
 * las tres decisiones que tiene dentro, que no son evidentes y ya costaron
 * medirse.
 *
 * Decisión #4 del repo: se sondea una respuesta cacheada, sin sockets. Una
 * pestaña oculta es un portátil con la tapa cerrada al lado del proyector — no
 * hay razón para seguir preguntando, pero en cuanto vuelve tiene que ponerse al
 * día en vez de esperar el siguiente tic.
 */
export function useLeaderboard(slug: string, initial: LeaderboardPayload): LeaderboardPayload {
  const [data, setData] = useState(initial);

  useEffect(() => {
    const controller = new AbortController();

    const refresh = async () => {
      if (document.hidden) {
        return;
      }
      try {
        const response = await fetch(`/api/resultados/${slug}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (response.ok) {
          const next = (await response.json()) as LeaderboardPayload;
          // Nunca retroceder. La respuesta se sirve con
          // `stale-while-revalidate=30`, así que dos refrescos seguidos pueden
          // caer en copias de distinta edad y el reloj "En vivo" se devolvía
          // unos segundos delante de toda la sala. Una foto más vieja que la
          // que ya está en pantalla no aporta nada, tenga los datos que tenga.
          setData((prev) => (next.updatedAt > prev.updatedAt ? next : prev));
        }
      } catch {
        // Wifi at a gym drops. Keep the last standings on screen and try again
        // on the next tick — a blank wall is worse than a five-second-old one.
      }
    };

    const id = setInterval(refresh, REFRESH_MS);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', refresh);
      controller.abort();
    };
  }, [slug]);

  return data;
}
