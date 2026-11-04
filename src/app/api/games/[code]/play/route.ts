import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rpc } from '@/lib/server/db';
import { fail, hashToken, sameOrigin } from '@/lib/server/api';

const action = z.discriminatedUnion('type', [
  z.object({ type: z.literal('team'), team_id: z.uuid() }),
  z.object({ type: z.literal('answer'), choice: z.number().int().min(0).max(3), key: z.string().min(8).max(100).optional() }),
  z.object({ type: z.literal('bet') }),
  z.object({ type: z.literal('joker'), kind: z.enum(['fifty', 'double', 'pass']) }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    sameOrigin(req);
    const { code } = await params;
    const token = req.headers.get('x-player-token');
    if (!token) throw new Error('ERR:player_not_found');
    const a = action.parse(await req.json());
    const b = { room_code: code, token_hash: hashToken(token) };
    if (a.type === 'team') return NextResponse.json(await rpc('cg_join_team', { ...b, team_id: a.team_id }));
    if (a.type === 'answer') return NextResponse.json(await rpc('cg_answer', { ...b, choice: a.choice, idempotency_key: a.key }));
    if (a.type === 'bet') return NextResponse.json(await rpc('cg_place_bet', b));
    return NextResponse.json(await rpc('cg_use_joker', { ...b, kind: a.kind }));
  } catch (e) { return fail(e); }
}
