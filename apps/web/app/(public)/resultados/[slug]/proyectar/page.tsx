import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLeaderboard } from '@/lib/leaderboard';
import { ProjectionScreen } from '../projection-screen';

export const metadata: Metadata = {
  title: 'Proyectar · Crux',
  // Esta es la pantalla de una pared, no una página que alguien deba encontrar
  // buscando. El enlace lo reparte quien organiza.
  robots: { index: false, follow: false },
};

// Misma consulta cacheada que la tabla pública: el primer pintado ya trae los
// resultados. Una rueda girando frente a una sala es una rueda que mira la sala.
export default async function ProyectarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const leaderboard = await getLeaderboard(slug);
  if (!leaderboard) {
    notFound();
  }

  return <ProjectionScreen initial={leaderboard} slug={slug} />;
}
