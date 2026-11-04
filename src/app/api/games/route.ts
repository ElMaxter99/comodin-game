import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rpc } from '@/lib/server/db';
import { fail, hostId, sameOrigin } from '@/lib/server/api';

export const THEMES = ['base', 'navidad'] as const;
const body = z.object({
  name: z.string().trim().min(1).max(80).default('Partida'),
  theme: z.enum(THEMES).default('base'),
  growing_step: z.number().int().min(0).max(1000).default(0),
  safe_every: z.number().int().min(0).max(20).default(0),
  bets_enabled: z.boolean().default(false),
});

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const b = body.parse(await req.json().catch(() => ({})));
    const host_id = await hostId(true);
    const r = await rpc('cg_create_game', { host_id, name: b.name, max_players: 10 });
    await rpc('cg_set_options', { room_code: r.room_code, host_id, theme: b.theme, growing_step: b.growing_step, safe_every: b.safe_every, bets_enabled: b.bets_enabled });
    return NextResponse.json(r);
  } catch (e) { return fail(e); }
}
