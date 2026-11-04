-- =============================================================================
-- Comodín Game · reglas extra opcionales (diseño §12): puntos crecientes, mano segura y apuesta.
-- Todas apagadas por defecto: una partida sin ajustes se comporta exactamente como antes.
-- =============================================================================
alter table games add column growing_step integer not null default 0 check (growing_step between 0 and 1000);
alter table games add column safe_every   integer not null default 0 check (safe_every between 0 and 20);
alter table games add column bets_enabled boolean not null default false;

alter table cg_teams  add column safe_score integer not null default 0;
alter table cg_rounds add column points integer;           -- puntos efectivos de la ronda (fijados al abrir)

-- Una apuesta por equipo y partida (unique(team_id)); delta = lo perdido (≤ 0), lo ganado ya va en cg_answers.points.
create table cg_bets (
  id        uuid primary key default gen_random_uuid(),
  round_id  uuid not null references cg_rounds(id) on delete cascade,
  team_id   uuid not null references cg_teams(id) on delete cascade,
  delta     integer not null default 0,
  created_at timestamptz not null default clock_timestamp(),
  unique (team_id)
);

-- Ajustes de la partida (solo anfitrión y solo antes de empezar).
create or replace function cg_set_options(p jsonb) returns jsonb language plpgsql as $$
declare g games;
begin
  g := cg_lock_game(p->>'room_code', (p->>'host_id')::uuid);
  if g.status <> 'lobby' then perform cg_err('invalid_state'); end if;
  update games set
    theme         = coalesce(p->>'theme', theme),
    speed_bonus   = coalesce((p->>'speed_bonus')::boolean, speed_bonus),
    growing_step  = coalesce((p->>'growing_step')::int, growing_step),
    safe_every    = coalesce((p->>'safe_every')::int, safe_every),
    bets_enabled  = coalesce((p->>'bets_enabled')::boolean, bets_enabled)
   where id = g.id;
  perform cg_log(g.id, g.host_id, 'options_set');
  perform cg_touch(g.id);
  return jsonb_build_object('ok', true);
end $$;

-- Abrir ronda: envoltorio que fija los puntos efectivos (puntos crecientes).
alter function cg_open_round(jsonb) rename to cg_open_round_pre_reglas;
create or replace function cg_open_round(p jsonb) returns jsonb language plpgsql as $$
declare res jsonb; g games;
begin
  res := cg_open_round_pre_reglas(p);
  select * into g from games where room_code = upper(p->>'room_code');
  update cg_rounds r set points = i.points + (r.seq - 1) * g.growing_step
    from cg_items i where r.id = (res->>'round_id')::uuid and i.id = r.item_id;
  return res;
end $$;

-- Reto: puntos efectivos de la ronda.
create or replace function cg_validate_challenge(p jsonb) returns jsonb language plpgsql as $$
declare g games; r cg_rounds; it cg_items; ok boolean := coalesce((p->>'success')::boolean, false); pts int;
begin
  g := cg_lock_game(p->>'room_code', (p->>'host_id')::uuid);
  select * into r from cg_rounds where game_id = g.id and status = 'open';
  if not found then perform cg_err('no_open_round'); end if;
  select * into it from cg_items where id = r.item_id;
  if it.kind <> 'challenge' then perform cg_err('invalid_state'); end if;
  pts := coalesce(r.points, it.points);
  if ok then
    update cg_teams set score = score + pts where id = r.team_id;
    insert into cg_answers (round_id, team_id, points) values (r.id, r.team_id, pts)
      on conflict (round_id, team_id) do update set points = excluded.points;
  end if;
  perform cg_close_round_core(r.id, 'host');
  perform cg_log(g.id, g.host_id, 'challenge_validated', jsonb_build_object('round_id', r.id, 'success', ok));
  perform cg_touch(g.id);
  return jsonb_build_object('success', ok);
end $$;

-- Núcleo único de cierre: puntos efectivos, apuesta (×2 o pérdida con suelo en la mano segura) y mano segura.
create or replace function cg_close_round_core(p_round uuid, p_by text) returns void language plpgsql as $$
declare r cg_rounds; it cg_items; g games; ans record; bet record; base int; pts int; total numeric; left_s numeric; rev timestamptz; cur int; loss int; floor_s int;
begin
  select * into r from cg_rounds where id = p_round;
  if r.status <> 'open' then return; end if;
  select * into it from cg_items where id = r.item_id;
  select * into g from games where id = r.game_id;
  base := coalesce(r.points, it.points);
  if it.kind = 'question' then
    select greatest(extract(epoch from (r.closes_at - r.opened_at)) - g.intro_seconds, 1) into total;
    for ans in select x.* from cg_answers x where x.round_id = r.id and not x.passed and x.choice = it.correct loop
      pts := base;
      if g.speed_bonus and r.closes_at is not null then
        left_s := greatest(extract(epoch from (r.closes_at - ans.answered_at)), 0);
        pts := pts + floor(base * least(left_s / total, 1) / 2)::int;
      end if;
      if exists (select 1 from cg_jokers j where j.team_id = ans.team_id and j.kind = 'double' and j.round_id = r.id)
         or exists (select 1 from cg_bets b where b.round_id = r.id and b.team_id = ans.team_id) then
        pts := pts * 2;
      end if;
      update cg_answers set points = pts where id = ans.id;
      update cg_teams set score = score + pts where id = ans.team_id;
    end loop;
    -- Apuestas perdidas (fallo o sin responder): pierden los puntos de la ronda, sin bajar de la mano segura.
    for bet in select b.* from cg_bets b where b.round_id = r.id
                  and not exists (select 1 from cg_answers a where a.round_id = r.id and a.team_id = b.team_id
                                   and not a.passed and a.choice = it.correct) loop
      select score, safe_score into cur, floor_s from cg_teams where id = bet.team_id;
      loss := least(base, greatest(cur - floor_s, 0));
      update cg_teams set score = score - loss where id = bet.team_id;
      update cg_bets set delta = -loss where id = bet.id;
    end loop;
  end if;
  rev := case when it.kind = 'challenge' then clock_timestamp()
              when g.dramatic_pause then null
              else clock_timestamp() + make_interval(secs => g.suspense_seconds) end;
  update cg_rounds set status = 'revealed', closed_by = p_by, closed_at = clock_timestamp(), reveal_at = rev where id = r.id;
  -- Mano segura: cada `safe_every` rondas cada equipo guarda su marcador.
  if g.safe_every > 0 and r.seq % g.safe_every = 0 then
    update cg_teams set safe_score = score where game_id = r.game_id;
  end if;
  update players set score = (select score from cg_teams t where t.id = players.team_id)
   where game_id = r.game_id and team_id is not null;
end $$;

-- Apuesta: una vez por equipo y partida, antes de responder, en preguntas, sin Doble ni Pasar en la misma ronda.
create or replace function cg_place_bet(p jsonb) returns jsonb language plpgsql as $$
declare g games; pl players; r cg_rounds; it cg_items;
begin
  g := cg_lock_game_public(p->>'room_code');
  if not g.bets_enabled then perform cg_err('bets_disabled'); end if;
  select * into pl from players where game_id = g.id and token_hash = p->>'token_hash';
  if not found or pl.team_id is null then perform cg_err('player_not_found'); end if;
  if not pl.is_captain and exists (select 1 from players c where c.team_id = pl.team_id and c.is_captain and c.token_hash is not null) then
    perform cg_err('not_captain');
  end if;
  select * into r from cg_rounds where game_id = g.id and status = 'open';
  if not found then perform cg_err('no_open_round'); end if;
  select * into it from cg_items where id = r.item_id;
  if it.kind <> 'question' then perform cg_err('invalid_state'); end if;
  if r.closes_at is not null and clock_timestamp() > r.closes_at then perform cg_err('round_closed'); end if;
  if exists (select 1 from cg_answers where round_id = r.id and team_id = pl.team_id) then perform cg_err('already_answered'); end if;
  if exists (select 1 from cg_bets where team_id = pl.team_id) then perform cg_err('bet_used'); end if;
  if exists (select 1 from cg_jokers where team_id = pl.team_id and round_id = r.id and kind in ('double','pass')) then perform cg_err('bet_conflict'); end if;
  insert into cg_bets (round_id, team_id) values (r.id, pl.team_id);
  perform cg_log(g.id, pl.id, 'bet_placed', jsonb_build_object('team_id', pl.team_id));
  perform cg_touch(g.id);
  return jsonb_build_object('ok', true);
end $$;

-- Comodines: Doble y Pasar no se combinan con una apuesta de la misma ronda.
alter function cg_use_joker(jsonb) rename to cg_use_joker_pre_reglas;
create or replace function cg_use_joker(p jsonb) returns jsonb language plpgsql as $$
declare g games; pl players;
begin
  if p->>'kind' in ('double', 'pass') then
    select * into g from games where room_code = upper(coalesce(p->>'room_code', ''));
    select * into pl from players where game_id = g.id and token_hash = p->>'token_hash';
    if exists (select 1 from cg_bets b join cg_rounds r on r.id = b.round_id
                where b.team_id = pl.team_id and r.status = 'open') then
      perform cg_err('bet_conflict');
    end if;
  end if;
  return cg_use_joker_pre_reglas(p);
end $$;

-- Instantánea: ajustes, marca de apuesta y mano segura (sin delatar nada durante el suspense).
alter function cg_get_state(jsonb) rename to cg_get_state_pre_reglas;
create or replace function cg_get_state(p jsonb) returns jsonb language plpgsql as $$
declare s jsonb; g games; r cg_rounds; v text := coalesce(p->>'view', 'public'); suspense boolean; myteam uuid; pts int; bets jsonb;
begin
  s := cg_get_state_pre_reglas(p);
  select * into g from games where room_code = upper(coalesce(p->>'room_code', ''));
  s := s || jsonb_build_object('growing_step', g.growing_step, 'safe_every', g.safe_every, 'bets_enabled', g.bets_enabled);
  select * into r from cg_rounds where game_id = g.id order by seq desc limit 1;
  suspense := found and (s->'round'->>'phase') = 'suspense' and v <> 'host';
  if not suspense then
    s := jsonb_set(s, '{teams}', coalesce((select jsonb_agg(e || jsonb_build_object('safe', coalesce((select t.safe_score from cg_teams t where t.id = (e->>'id')::uuid), 0)) order by ord)
                                             from jsonb_array_elements(s->'teams') with ordinality as x(e, ord)), '[]'::jsonb));
  end if;
  if r.id is not null then
    pts := coalesce(r.points, (select i.points from cg_items i where i.id = r.item_id));
    s := jsonb_set(s, '{round,points}', to_jsonb(pts));
    -- Apuestas: el anfitrión las ve siempre; TV y móviles solo al revelar (como las respuestas).
    if not suspense and r.status = 'revealed' or v = 'host' then
      bets := coalesce((select jsonb_agg(jsonb_build_object('team_id', b.team_id, 'delta', b.delta)) from cg_bets b where b.round_id = r.id), '[]'::jsonb);
      s := jsonb_set(s, '{round,bets}', bets);
    end if;
    if suspense then
      -- El marcador previo no incluye lo perdido en apuestas de esta ronda.
      s := jsonb_set(s, '{teams}', coalesce((
        select jsonb_agg(jsonb_set(e, '{score}', to_jsonb((e->>'score')::int - coalesce((select sum(b.delta) from cg_bets b where b.round_id = r.id and b.team_id = (e->>'id')::uuid), 0))) order by ord)
          from jsonb_array_elements(s->'teams') with ordinality as x(e, ord)), '[]'::jsonb));
    end if;
  end if;
  if v = 'player' and p->>'token_hash' is not null then
    select team_id into myteam from players where game_id = g.id and token_hash = p->>'token_hash';
    if myteam is not null then
      s := s || jsonb_build_object('bet', jsonb_build_object(
        'enabled', g.bets_enabled,
        'available', g.bets_enabled and not exists (select 1 from cg_bets where team_id = myteam),
        'placed_now', r.id is not null and exists (select 1 from cg_bets b where b.round_id = r.id and b.team_id = myteam)));
    end if;
  end if;
  return s;
end $$;
