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

  return NextResponse.json(leaderboard, {
    headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=30' },
  });
}
