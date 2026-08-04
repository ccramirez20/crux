import { NextResponse } from 'next/server';
import { sql } from '@crux/db';
import { db } from '@/lib/db';

export async function GET() {
  await db.execute(sql`select 1`);
  return NextResponse.json({ ok: true });
}
