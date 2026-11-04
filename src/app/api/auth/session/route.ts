import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fail, sameOrigin, setHostSession } from '@/lib/server/api';
import { supabaseConfigured, userFromToken } from '@/lib/server/supabase';

const body = z.object({ access_token: z.string().min(20).max(4000), refresh_token: z.string().min(5).max(500), expires_in: z.number().int().min(60).max(86400 * 7).default(3600) });

/** Recibe los tokens que Supabase pone en la URL del enlace mágico, los verifica y los guarda en cookies httpOnly. */
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    if (!supabaseConfigured()) throw new Error('ERR:invalid_state');
    const b = body.parse(await req.json().catch(() => ({})));
    if (!(await userFromToken(b.access_token))) throw new Error('ERR:login_required');
    await setHostSession(b);
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
