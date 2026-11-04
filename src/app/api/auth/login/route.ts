import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fail, sameOrigin } from '@/lib/server/api';
import { sendMagicLink, supabaseConfigured } from '@/lib/server/supabase';

const body = z.object({ email: z.string().trim().toLowerCase().email().max(200) });

/** Envía el enlace mágico. Solo existe con Supabase; en desarrollo no hace falta entrar. */
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    if (!supabaseConfigured()) throw new Error('ERR:invalid_state');
    const b = body.parse(await req.json().catch(() => ({})));
    await sendMagicLink(b.email, `${new URL(req.url).origin}/auth/callback`);
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
