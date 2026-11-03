import { NextResponse } from 'next/server';
import { rpc } from '@/lib/server/db';
import { fail, hashToken, hostId } from '@/lib/server/api';

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const u = new URL(req.url);
    const view = u.searchParams.get('view') ?? 'public';
    const token = req.headers.get('x-player-token');
    const s = await rpc('cg_get_state', {
      room_code: code, view: view === 'host' || view === 'player' ? view : 'public',
      host_id: view === 'host' ? await hostId() : undefined, token_hash: token ? hashToken(token) : undefined,
    });
    return NextResponse.json(s, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return fail(e); }
}
