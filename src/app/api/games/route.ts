import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rpc } from '@/lib/server/db';
import { fail, hostId, sameOrigin } from '@/lib/server/api';

const body = z.object({ name: z.string().trim().min(1).max(80).default('Partida') });

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const b = body.parse(await req.json().catch(() => ({})));
    const r = await rpc('cg_create_game', { host_id: await hostId(true), name: b.name, max_players: 10 });
    return NextResponse.json(r);
  } catch (e) { return fail(e); }
}
