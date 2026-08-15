import { notFound } from 'next/navigation';
import { getLeaderboard, getSiblingEvents } from '@/lib/leaderboard';
import { LeaderboardScreen } from './leaderboard-screen';

// The public face of the product: projected on a wall for hours while the
// competition runs. The first paint already carries standings — a spinner in
// front of a room is a spinner everyone watches.
export default async function ResultadosPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // En paralelo: son dos cachés distintas y la segunda no debe retrasar la
  // tabla, que es lo que la sala está esperando.
  const [leaderboard, siblings] = await Promise.all([getLeaderboard(slug), getSiblingEvents(slug)]);
  if (!leaderboard) {
    notFound();
  }

  return <LeaderboardScreen initial={leaderboard} slug={slug} siblings={siblings} />;
}
