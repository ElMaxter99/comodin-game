import { NextResponse } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { supabaseConfigured, refreshSession, userFromToken } from './supabase';

const ERRORS: Record<string, [string, number]> = {
  game_not_found: ['Partida no encontrada.', 404], not_host: ['Solo el anfitrión puede hacer eso.', 403],
  invalid_state: ['Ahora no se puede hacer eso.', 409], invalid_input: ['Datos no válidos.', 400],
  duplicate_name: ['Ese nombre ya está en uso.', 409], join_closed: ['La partida ya ha empezado.', 409],
  too_many_players: ['Partida llena.', 409], player_not_found: ['No estás en esta partida.', 403],
  team_not_found: ['Equipo no encontrado.', 404], no_teams: ['Crea al menos un equipo.', 409],
  no_items: ['Añade al menos una pregunta o reto.', 409], round_open: ['Ya hay una ronda abierta.', 409],
  no_more_items: ['No quedan preguntas ni retos.', 409], no_open_round: ['No hay ronda abierta.', 409],
  round_closed: ['La ronda ya se ha cerrado.', 409], already_answered: ['Tu equipo ya ha respondido.', 409],
  not_captain: ['Responde el capitán del equipo.', 403], joker_used: ['Ese comodín ya está usado (o ya usaste uno en esta ronda).', 409],
  bets_disabled: ['Las apuestas no están activadas en esta partida.', 409], bet_used: ['Vuestro equipo ya ha usado su apuesta.', 409],
  bet_conflict: ['La apuesta no se combina con Doble ni Pasar en la misma ronda.', 409],
  login_required: ['Entra como presentador para hacer eso.', 401], login_failed: ['No se pudo enviar el enlace. Revisa el correo e inténtalo de nuevo.', 400],
  too_early: ['Todavía queda tiempo.', 409], round_not_started: ['Esperad: se están repartiendo las cartas.', 409],
};

export function fail(e: unknown) {
  const m = /ERR:([a-z_]+)/.exec(e instanceof Error ? e.message : String(e));
  const [msg, status] = (m && ERRORS[m[1]]) || ['Error inesperado.', 500];
  if (!m) console.error(e);
  return NextResponse.json({ error: msg, code: m?.[1] ?? 'internal' }, { status });
}

export function sameOrigin(req: Request) {
  const o = req.headers.get('origin');
  if (o && new URL(o).host !== req.headers.get('host')) throw new Error('ERR:not_host');
}

export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

const COOKIE = { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: process.env.NODE_ENV === 'production' };

/** Guarda la sesión del presentador (Supabase Auth) en cookies httpOnly; el token de acceso se verifica con Supabase en cada petición. */
export async function setHostSession(s: { access_token: string; refresh_token: string; expires_in: number }) {
  const jar = await cookies();
  jar.set('cg_at', s.access_token, { ...COOKIE, maxAge: Math.max(60, s.expires_in) });
  jar.set('cg_rt', s.refresh_token, { ...COOKIE, maxAge: 60 * 60 * 24 * 30 });
}
export async function clearHostSession() { const jar = await cookies(); jar.delete('cg_at'); jar.delete('cg_rt'); jar.delete('cg_host'); }

/**
 * Anfitrión. Con Supabase: el id del usuario autenticado (enlace mágico); sin sesión → undefined (o error si `create`).
 * En modo de desarrollo: cookie con un UUID propio, sin correo.
 */
export async function hostId(create = false): Promise<string | undefined> {
  const jar = await cookies();
  if (supabaseConfigured()) {
    const at = jar.get('cg_at')?.value;
    const id = at ? await userFromToken(at) : null;
    if (id) return id;
    const rt = jar.get('cg_rt')?.value;
    const fresh = rt ? await refreshSession(rt) : null;
    if (fresh) { await setHostSession(fresh); return fresh.id; }
    if (create) throw new Error('ERR:login_required');
    return undefined;
  }
  let id = jar.get('cg_host')?.value;
  if (!id && create) { id = randomUUID(); jar.set('cg_host', id, { ...COOKIE, maxAge: 60 * 60 * 24 * 30 }); }
  return id;
}
