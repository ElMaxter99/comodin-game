import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { rpc } from '@/lib/server/db';
import { fail, hashToken, sameOrigin } from '@/lib/server/api';

const COLORS = ['#f87171', '#60a5fa', '#34d399', '#fbbf24', '#c084fc', '#fb923c'];
const body = z.object({ name: z.string().trim().min(1).max(40), token: z.string().min(16).max(100).optional() });

// El token lo genera el servidor y vive solo en el móvil; en la BD solo se guarda su hash.
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    sameOrigin(req);
    const { code } = await params;
    const b = body.parse(await req.json());
    const token = randomUUID() + randomUUID();
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const r = await rpc('cg_join_new_player', { room_code: code, name: b.name, color, token_hash: hashToken(token) });
    return NextResponse.json({ ...r, token });
  } catch (e) { return fail(e); }
}
