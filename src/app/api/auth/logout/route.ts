import { NextResponse } from 'next/server';
import { clearHostSession, fail, sameOrigin } from '@/lib/server/api';

export async function POST(req: Request) {
  try { sameOrigin(req); await clearHostSession(); return NextResponse.json({ ok: true }); } catch (e) { return fail(e); }
}
