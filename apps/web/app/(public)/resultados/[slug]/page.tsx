import { notFound } from 'next/navigation';
import { getLeaderboard } from '@/lib/leaderboard';
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
  const leaderboard = await getLeaderboard(slug);
  if (!leaderboard) {
    notFound();
  }

  return <LeaderboardScreen initial={leaderboard} slug={slug} />;
}
