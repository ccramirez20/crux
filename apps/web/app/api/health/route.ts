import { NextResponse } from 'next/server';
import { sql } from '@crux/db';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
