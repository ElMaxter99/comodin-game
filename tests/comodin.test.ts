import { describe, it, expect } from 'vitest';
import { makeDb, HOST } from './helpers';

async function setup() {
  const h = await makeDb();
  const { rpc } = h;
  const { room_code: room } = await rpc('cg_create_game', { host_id: HOST, name: 'Navidad' });
  const mk = async (name: string, tok: string) => {
    const { team_id } = await rpc('cg_create_team', { room_code: room, host_id: HOST, name });
    await rpc('cg_join_new_player', { room_code: room, name: 'cap' + name, token_hash: tok });
    await rpc('cg_join_team', { room_code: room, token_hash: tok, team_id });
    return team_id as string;
  };
  const t1 = await mk('Rojos', 'tok1');
  const t2 = await mk('Azules', 'tok2');
  await rpc('cg_add_item', { room_code: room, host_id: HOST, kind: 'question', text: '¿2+2?', options: ['3', '4', '5', '6'], correct: 1, points: 100 });
  await rpc('cg_add_item', { room_code: room, host_id: HOST, kind: 'challenge', text: 'Imita un villancico', points: 50 });
  await rpc('cg_start_game', { room_code: room, host_id: HOST });
  // Los tests de reglas no esperan al reparto ni al suspense (se prueban aparte).
  await h.db.query('update games set intro_seconds = 0, suspense_seconds = 0');
  return { ...h, room, t1, t2 };
}

describe('Comodín Game', () => {
  it('oculta la correcta hasta el reveal y puntúa al cerrar con todos respondidos', async () => {
    const { rpc, room, t1, t2 } = await setup();
    await rpc('cg_open_round', { room_code: room, host_id: HOST });
    const pub = await rpc('cg_get_state', { room_code: room, view: 'public' });
    expect(pub.round.correct).toBeUndefined();
    expect(JSON.stringify(pub)).not.toContain('"correct"');
    await rpc('cg_answer', { room_code: room, token_hash: 'tok1', choice: 1 });
    const mid = await rpc('cg_answer', { room_code: room, token_hash: 'tok2', choice: 0 });
    expect(mid.closed).toBe(true);
    const st = await rpc('cg_get_state', { room_code: room, view: 'public' });
    expect(st.round.status).toBe('revealed');
    expect(st.round.correct).toBe(1);
    const sc = Object.fromEntries(st.teams.map((t: any) => [t.id, t.score]));
    expect(sc[t1]).toBe(100); expect(sc[t2]).toBe(0);
  });

  it('no deja responder dos veces ni sin ser capitán, y es idempotente', async () => {
    const { rpc, err, room } = await setup();
    await rpc('cg_open_round', { room_code: room, host_id: HOST });
    await rpc('cg_answer', { room_code: room, token_hash: 'tok1', choice: 1, idempotency_key: 'abcdefgh1' });
    const again = await rpc('cg_answer', { room_code: room, token_hash: 'tok1', choice: 1, idempotency_key: 'abcdefgh1' });
    expect(again.ok).toBe(true);
    expect(await err('cg_answer', { room_code: room, token_hash: 'tok1', choice: 2 })).toContain('already_answered');
  });

  it('comodín doble multiplica y solo se usa una vez', async () => {
    const { rpc, err, room, t1 } = await setup();
    await rpc('cg_open_round', { room_code: room, host_id: HOST });
    await rpc('cg_use_joker', { room_code: room, token_hash: 'tok1', kind: 'double' });
    expect(await err('cg_use_joker', { room_code: room, token_hash: 'tok1', kind: 'fifty' })).toContain('joker_used');
    await rpc('cg_answer', { room_code: room, token_hash: 'tok1', choice: 1 });
    await rpc('cg_close_round', { room_code: room, host_id: HOST });
    const st = await rpc('cg_get_state', { room_code: room, view: 'public' });
    expect(st.teams.find((t: any) => t.id === t1).score).toBe(200);
  });

  it('50 % oculta dos incorrectas y rechaza elegirlas', async () => {
    const { rpc, err, room } = await setup();
    await rpc('cg_open_round', { room_code: room, host_id: HOST });
    await rpc('cg_use_joker', { room_code: room, token_hash: 'tok1', kind: 'fifty' });
    const me = await rpc('cg_get_state', { room_code: room, view: 'player', token_hash: 'tok1' });
    const hid: number[] = me.round.hidden;
    expect(hid).toHaveLength(2); expect(hid).not.toContain(1);
    expect(await err('cg_answer', { room_code: room, token_hash: 'tok1', choice: hid[0] })).toContain('invalid_input');
  });

  it('pasar no puntúa y cuenta como respondida', async () => {
    const { rpc, room } = await setup();
    await rpc('cg_open_round', { room_code: room, host_id: HOST });
    await rpc('cg_use_joker', { room_code: room, token_hash: 'tok1', kind: 'pass' });
    const r = await rpc('cg_answer', { room_code: room, token_hash: 'tok2', choice: 1 });
    expect(r.closed).toBe(true);
  });

  it('cierre por tiempo exige que haya vencido', async () => {
    const { rpc, err, room } = await setup();
    await rpc('cg_open_round', { room_code: room, host_id: HOST });
    expect(await err('cg_close_round', { room_code: room, by: 'time' })).toContain('too_early');
  });

  it('reto: el presentador valida y suma puntos; solo el anfitrión', async () => {
    const { rpc, err, room } = await setup();
    await rpc('cg_open_round', { room_code: room, host_id: HOST });
    await rpc('cg_close_round', { room_code: room, host_id: HOST });
    await rpc('cg_open_round', { room_code: room, host_id: HOST });
    expect(await err('cg_validate_challenge', { room_code: room, host_id: '22222222-2222-2222-2222-222222222222', success: true })).toContain('not_host');
    await rpc('cg_validate_challenge', { room_code: room, host_id: HOST, success: true });
    const st = await rpc('cg_get_state', { room_code: room, view: 'public' });
    expect(st.teams.reduce((a: number, t: any) => a + t.score, 0)).toBe(50);
  });

  it('rapidez opcional da bonus', async () => {
    const { rpc, db, room, t1 } = await setup();
    await db.query("update games set speed_bonus = true");
    await rpc('cg_open_round', { room_code: room, host_id: HOST });
    await rpc('cg_answer', { room_code: room, token_hash: 'tok1', choice: 1 });
    await rpc('cg_close_round', { room_code: room, host_id: HOST });
    const st = await rpc('cg_get_state', { room_code: room, view: 'public' });
    expect(st.teams.find((t: any) => t.id === t1).score).toBeGreaterThan(100);
  });

  it('durante el suspense no salen la correcta, las respuestas ni el marcador; luego sí', async () => {
    const { rpc, db, room, t1 } = await setup();
    await db.query('update games set suspense_seconds = 2');
    await rpc('cg_open_round', { room_code: room, host_id: HOST });
    await rpc('cg_answer', { room_code: room, token_hash: 'tok1', choice: 1 });
    await rpc('cg_answer', { room_code: room, token_hash: 'tok2', choice: 0 });
    const s = await rpc('cg_get_state', { room_code: room, view: 'public' });
    expect(s.round.phase).toBe('suspense');
    expect(s.round.correct).toBeUndefined();
    expect(s.round.results).toBeUndefined();
    expect(s.teams.every((t: any) => t.score === 0)).toBe(true);
    expect(s.players.every((p: any) => p.score === undefined)).toBe(true);
    const host = await rpc('cg_get_state', { room_code: room, view: 'host', host_id: HOST });
    expect(host.round.correct).toBe(1);          // el presentador sí la ve
    await db.query("update cg_rounds set reveal_at = clock_timestamp() - interval '1 second'");
    const after = await rpc('cg_get_state', { room_code: room, view: 'public' });
    expect(after.round.phase).toBe('revealed');
    expect(after.round.correct).toBe(1);
    expect(after.teams.find((t: any) => t.id === t1).score).toBe(100);
  });

  it('pausa dramática: espera a «Revelar» del presentador', async () => {
    const { rpc, err, room } = await setup();
    await rpc('cg_set_pause', { room_code: room, host_id: HOST, on: true });
    await rpc('cg_open_round', { room_code: room, host_id: HOST });
    await rpc('cg_close_round', { room_code: room, host_id: HOST });
    const s = await rpc('cg_get_state', { room_code: room, view: 'public' });
    expect(s.round.phase).toBe('suspense'); expect(s.round.hold).toBe(true);
    expect(await err('cg_reveal', { room_code: room, host_id: '22222222-2222-2222-2222-222222222222' })).toContain('not_host');
    await rpc('cg_reveal', { room_code: room, host_id: HOST });
    const r = await rpc('cg_get_state', { room_code: room, view: 'public' });
    expect(r.round.phase).toBe('revealed');
  });

  it('no se responde durante el reparto', async () => {
    const { rpc, err, db, room } = await setup();
    await db.query('update games set intro_seconds = 5');
    await rpc('cg_open_round', { room_code: room, host_id: HOST });
    expect(await err('cg_answer', { room_code: room, token_hash: 'tok1', choice: 1 })).toContain('round_not_started');
  });

  it('un reto se revela al momento', async () => {
    const { rpc, db, room } = await setup();
    await db.query('update games set suspense_seconds = 5');
    await rpc('cg_open_round', { room_code: room, host_id: HOST });
    await rpc('cg_close_round', { room_code: room, host_id: HOST });
    await db.query("update cg_rounds set reveal_at = clock_timestamp()");
    await rpc('cg_open_round', { room_code: room, host_id: HOST });
    await rpc('cg_validate_challenge', { room_code: room, host_id: HOST, success: true });
    const s = await rpc('cg_get_state', { room_code: room, view: 'public' });
    expect(s.round.phase).toBe('revealed');
  });
});
