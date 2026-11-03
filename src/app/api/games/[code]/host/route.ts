import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rpc } from '@/lib/server/db';
import { fail, hostId, sameOrigin } from '@/lib/server/api';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const action = z.discriminatedUnion('type', [
  z.object({ type: z.literal('team'), name: z.string().trim().min(1).max(30), color: hex.optional() }),
  z.object({ type: z.literal('question'), text: z.string().trim().min(1).max(300),
    options: z.array(z.string().trim().min(1).max(120)).refine((a) => a.length === 2 || a.length === 4),
    correct: z.number().int().min(0).max(3), points: z.number().int().min(0).max(10000).optional() }),
  z.object({ type: z.literal('challenge'), text: z.string().trim().min(1).max(300), points: z.number().int().min(0).max(10000).optional() }),
  z.object({ type: z.literal('start') }), z.object({ type: z.literal('open') }),
  z.object({ type: z.literal('close') }), z.object({ type: z.literal('finish') }),
  z.object({ type: z.literal('time') }), z.object({ type: z.literal('reveal') }),
  z.object({ type: z.literal('pause'), on: z.boolean() }),
  z.object({ type: z.literal('validate'), success: z.boolean() }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    sameOrigin(req);
    const { code } = await params;
    const a = action.parse(await req.json());
    const b = { room_code: code, host_id: await hostId() };
    switch (a.type) {
      case 'team': return NextResponse.json(await rpc('cg_create_team', { ...b, name: a.name, color: a.color }));
      case 'question': return NextResponse.json(await rpc('cg_add_item', { ...b, kind: 'question', text: a.text, options: a.options, correct: a.correct, points: a.points }));
      case 'challenge': return NextResponse.json(await rpc('cg_add_item', { ...b, kind: 'challenge', text: a.text, points: a.points }));
      case 'start': return NextResponse.json(await rpc('cg_start_game', b));
      case 'open': return NextResponse.json(await rpc('cg_open_round', b));
      case 'close': return NextResponse.json(await rpc('cg_close_round', { ...b, by: 'host' }));
      case 'time': return NextResponse.json(await rpc('cg_close_round', { room_code: code, by: 'time' }));
      case 'reveal': return NextResponse.json(await rpc('cg_reveal', b));
      case 'pause': return NextResponse.json(await rpc('cg_set_pause', { ...b, on: a.on }));
      case 'validate': return NextResponse.json(await rpc('cg_validate_challenge', { ...b, success: a.success }));
      case 'finish': return NextResponse.json(await rpc('cg_finish_game', b));
    }
  } catch (e) { return fail(e); }
}
