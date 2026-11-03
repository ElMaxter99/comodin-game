import { NextResponse } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';

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

/** Anfitrión en modo de desarrollo: cookie con un UUID propio. */
export async function hostId(create = false) {
  const jar = await cookies();
  let id = jar.get('cg_host')?.value;
  if (!id && create) { id = randomUUID(); jar.set('cg_host', id, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 }); }
  return id;
}
