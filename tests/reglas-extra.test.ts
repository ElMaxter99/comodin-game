import { describe, it, expect } from 'vitest';
import { makeDb, HOST } from './helpers';

/** Partida con 2 equipos y `n` preguntas (la correcta es la opción 1, 100 pts). Los ajustes se aplican en la sala antes de empezar. */
async function setup(opts: Record<string, unknown>, n = 4) {
  const h = await makeDb();
  const { rpc } = h;
  const { room_code: room } = await rpc('cg_create_game', { host_id: HOST, name: 'Reglas' });
  await rpc('cg_set_options', { room_code: room, host_id: HOST, ...opts });
  const mk = async (name: string, tok: string) => {
    const { team_id } = await rpc('cg_create_team', { room_code: room, host_id: HOST, name });
    await rpc('cg_join_new_player', { room_code: room, name: 'cap' + name, token_hash: tok });
    await rpc('cg_join_team', { room_code: room, token_hash: tok, team_id });
    return team_id as string;
  };
  const t1 = await mk('Rojos', 'tok1');
  const t2 = await mk('Azules', 'tok2');
  for (let i = 0; i < n; i++) {
    await rpc('cg_add_item', { room_code: room, host_id: HOST, kind: 'question', text: `P${i}`, options: ['a', 'b', 'c', 'd'], correct: 1, points: 100 });
  }
  await rpc('cg_add_item', { room_code: room, host_id: HOST, kind: 'challenge', text: 'Reto', points: 50 });
  await rpc('cg_start_game', { room_code: room, host_id: HOST });
  await h.db.query('update games set intro_seconds = 0, suspense_seconds = 0');
  const open = () => rpc('cg_open_round', { room_code: room, host_id: HOST });
  const ans = (tok: string, choice: number) => rpc('cg_answer', { room_code: room, token_hash: tok, choice });
  const bet = (tok: string) => rpc('cg_place_bet', { room_code: room, token_hash: tok });
  const state = (view = 'host', tok?: string) => rpc('cg_get_state', { room_code: room, view, token_hash: tok, host_id: HOST });
  const score = async (t: string) => (await state()).teams.find((x: any) => x.id === t).score;
  return { ...h, room, t1, t2, open, ans, bet, state, score };
}

describe('reglas extra', () => {
  it('por defecto todo está apagado y la partida se comporta como antes', async () => {
    const x = await setup({});
    const s = await x.state();
    expect([s.growing_step, s.safe_every, s.bets_enabled]).toEqual([0, 0, false]);
    expect(await x.err('cg_place_bet', { room_code: x.room, token_hash: 'tok1' })).toContain('ERR:');
    await x.open(); await x.ans('tok1', 1); await x.ans('tok2', 0);
    expect(await x.score(x.t1)).toBe(100);
  });

  it('los ajustes solo se cambian antes de empezar', async () => {
    const x = await setup({ theme: 'navidad' });
    expect((await x.state()).theme).toBe('navidad');
    expect(await x.err('cg_set_options', { room_code: x.room, host_id: HOST, theme: 'base' })).toContain('ERR:invalid_state');
  });

  it('puntos crecientes: base + (ronda−1)·paso, también en el reto', async () => {
    const x = await setup({ growing_step: 100 }, 2);
    await x.open();
    expect((await x.state()).round.points).toBe(100);
    await x.ans('tok1', 1); await x.ans('tok2', 1);
    expect(await x.score(x.t1)).toBe(100);
    await x.open();
    expect((await x.state()).round.points).toBe(200);
    await x.ans('tok1', 1); await x.ans('tok2', 0);
    expect(await x.score(x.t1)).toBe(300);
    await x.open(); // reto, ronda 3: 50 + 2·100
    expect((await x.state()).round.points).toBe(250);
    await x.rpc('cg_validate_challenge', { room_code: x.room, host_id: HOST, success: true });
    expect(await x.score(x.t2)).toBe(350); // el reto va al equipo con menos puntos
  });

  it('apuesta: acierto vale el doble; fallo resta los puntos de la ronda; una sola vez por equipo', async () => {
    const x = await setup({ bets_enabled: true });
    await x.open();
    await x.bet('tok1'); await x.bet('tok2');
    await x.ans('tok1', 1); await x.ans('tok2', 0);
    expect(await x.score(x.t1)).toBe(200);
    expect(await x.score(x.t2)).toBe(0); // no baja de 0
    await x.open();
    expect(await x.err('cg_place_bet', { room_code: x.room, token_hash: 'tok1' })).toContain('ERR:bet_used');
    await x.ans('tok1', 0); await x.ans('tok2', 1);
    expect(await x.score(x.t1)).toBe(200); // sin apuesta, fallo sin coste
    expect(await x.score(x.t2)).toBe(100);
  });

  it('apuesta perdida con puntos previos y suelo en la mano segura', async () => {
    const x = await setup({ bets_enabled: true, safe_every: 2 });
    await x.open(); await x.ans('tok1', 1); await x.ans('tok2', 0);   // t1 100
    await x.open(); await x.ans('tok1', 1); await x.ans('tok2', 0);   // t1 200, ronda 2 → guarda 200
    expect((await x.state()).teams.find((t: any) => t.id === x.t1).safe).toBe(200);
    await x.open();
    await x.bet('tok1');
    await x.ans('tok1', 0); await x.ans('tok2', 0);
    expect(await x.score(x.t1)).toBe(200); // suelo = mano segura
    // sin la mano segura (safe_every=0) se perdería la ronda
    const y = await setup({ bets_enabled: true });
    await y.open(); await y.ans('tok1', 1); await y.ans('tok2', 0);
    await y.open(); await y.bet('tok1'); await y.ans('tok1', 0); await y.ans('tok2', 0);
    expect(await y.score(y.t1)).toBe(0);
  });

  it('apuesta sin responder (se acaba el tiempo) cuenta como perdida', async () => {
    const x = await setup({ bets_enabled: true });
    await x.open(); await x.ans('tok1', 1); await x.ans('tok2', 0);   // t1 100
    await x.open(); await x.bet('tok1'); await x.ans('tok2', 0);
    await x.rpc('cg_close_round', { room_code: x.room, host_id: HOST });
    expect(await x.score(x.t1)).toBe(0);
  });

  it('la apuesta no se combina con Doble ni Pasar (en ningún orden) ni vale en un reto', async () => {
    const x = await setup({ bets_enabled: true }, 1);
    await x.open();
    await x.bet('tok1');
    expect(await x.err('cg_use_joker', { room_code: x.room, token_hash: 'tok1', kind: 'double' })).toContain('ERR:bet_conflict');
    expect(await x.err('cg_use_joker', { room_code: x.room, token_hash: 'tok1', kind: 'pass' })).toContain('ERR:bet_conflict');
    await x.rpc('cg_use_joker', { room_code: x.room, token_hash: 'tok2', kind: 'double' });
    expect(await x.err('cg_place_bet', { room_code: x.room, token_hash: 'tok2' })).toContain('ERR:bet_conflict');
    await x.ans('tok1', 1); await x.ans('tok2', 1);
    await x.open(); // reto
    expect(await x.err('cg_place_bet', { room_code: x.room, token_hash: 'tok2' })).toContain('ERR:invalid_state');
  });

  it('durante el suspense nadie ve las apuestas ni el marcador nuevo (el anfitrión sí)', async () => {
    const x = await setup({ bets_enabled: true, safe_every: 1 });
    await x.open(); await x.ans('tok1', 1); await x.ans('tok2', 0);   // t1 100, guardado
    await x.open(); await x.bet('tok1');
    await x.db.query("update games set suspense_seconds = 10");
    await x.ans('tok1', 1); await x.ans('tok2', 1);                    // t1 +200 apostando
    const pub = await x.state('public');
    expect(pub.round.phase).toBe('suspense');
    expect(pub.round.bets).toBeUndefined();
    expect(pub.teams.find((t: any) => t.id === x.t1).score).toBe(100);
    expect(pub.teams.find((t: any) => t.id === x.t1).safe).toBeUndefined();
    const host = await x.state('host');
    expect(host.round.bets).toHaveLength(1);
    expect(host.teams.find((t: any) => t.id === x.t1).score).toBe(300);
    const pl = await x.state('player', 'tok2');
    expect(pl.bet.available).toBe(true);
  });
});
