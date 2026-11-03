-- =============================================================================
-- Comodín Game · reglas del juego (PostgreSQL portable)
-- Equipos, banco de ítems (preguntas y retos), rondas, respuestas y comodines.
-- Toda la decisión vive aquí; TypeScript solo valida y presenta.
-- =============================================================================

alter table games add column theme text not null default 'base' check (theme ~ '^[a-z0-9_-]{2,30}$');
alter table games add column speed_bonus boolean not null default false;
alter table games add column answer_seconds integer not null default 20 check (answer_seconds between 5 and 300);

create table cg_teams (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references games(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 30),
  color       text not null default '#a78bfa' check (color ~ '^#[0-9a-fA-F]{6}$'),
  score       integer not null default 0,
  created_at  timestamptz not null default now()
);
create unique index cg_teams_name_uq on cg_teams (game_id, lower(name));

alter table players add column team_id uuid references cg_teams(id) on delete set null;
alter table players add column is_captain boolean not null default false;

create table cg_items (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references games(id) on delete cascade,
  sort_order  integer not null default 0,
  kind        text not null check (kind in ('question','challenge')),
  text        text not null check (char_length(text) between 1 and 300),
  options     jsonb,                   -- preguntas: array de 2 (V/F) o 4 textos
  correct     integer,                 -- índice de la opción correcta
  points      integer not null default 100 check (points between 0 and 10000),
  created_at  timestamptz not null default now(),
  check (
    (kind = 'question' and jsonb_typeof(options) = 'array' and jsonb_array_length(options) in (2,4)
       and correct is not null and correct between 0 and jsonb_array_length(options) - 1)
    or (kind = 'challenge' and options is null and correct is null)
  )
);
create index cg_items_game_idx on cg_items (game_id, sort_order);

create table cg_rounds (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references games(id) on delete cascade,
  item_id     uuid not null references cg_items(id),
  seq         integer not null,
  team_id     uuid references cg_teams(id),     -- retos: equipo que lo hace
  status      text not null default 'open' check (status in ('open','revealed')),
  opened_at   timestamptz not null default clock_timestamp(),
  closes_at   timestamptz,
  closed_by   text check (closed_by in ('host','time','all')),
  unique (game_id, seq),
  unique (game_id, item_id)
);

create table cg_answers (
  id            uuid primary key default gen_random_uuid(),
  round_id      uuid not null references cg_rounds(id) on delete cascade,
  team_id       uuid not null references cg_teams(id) on delete cascade,
  choice        integer,                          -- null = pasar (comodín) o «¡Hecho!» en reto
  passed        boolean not null default false,
  answered_at   timestamptz not null default clock_timestamp(),
  points        integer not null default 0,
  unique (round_id, team_id)                      -- idempotencia natural
);

create table cg_jokers (
  id        uuid primary key default gen_random_uuid(),
  team_id   uuid not null references cg_teams(id) on delete cascade,
  kind      text not null check (kind in ('fifty','double','pass')),
  round_id  uuid references cg_rounds(id),        -- ronda donde se usó
  data      jsonb not null default '{}'::jsonb,   -- fifty: {"hidden":[i,j]}
  unique (team_id, kind)
);

-- ---------------------------------------------------------------------------
-- Equipos y contenido (anfitrión)
-- ---------------------------------------------------------------------------
create or replace function cg_create_team(p jsonb) returns jsonb language plpgsql as $$
declare g games; t uuid; nm text := trim(coalesce(p->>'name',''));
begin
  g := cg_lock_game(p->>'room_code', (p->>'host_id')::uuid);
  if g.status <> 'lobby' then perform cg_err('invalid_state'); end if;
  if char_length(nm) not between 1 and 30 then perform cg_err('invalid_input'); end if;
  if exists (select 1 from cg_teams where game_id = g.id and lower(name) = lower(nm)) then perform cg_err('duplicate_name'); end if;
  insert into cg_teams (game_id, name, color) values (g.id, nm, coalesce(p->>'color', '#a78bfa')) returning id into t;
  insert into cg_jokers (team_id, kind) values (t,'fifty'), (t,'double'), (t,'pass');
  perform cg_log(g.id, g.host_id, 'team_created', jsonb_build_object('team_id', t));
  perform cg_touch(g.id);
  return jsonb_build_object('team_id', t);
end $$;

-- El jugador entra en un equipo; el primero en entrar es el capitán.
create or replace function cg_join_team(p jsonb) returns jsonb language plpgsql as $$
declare g games; pl players; t cg_teams; cap boolean;
begin
  g := cg_lock_game_public(p->>'room_code');
  if g.status <> 'lobby' then perform cg_err('join_closed'); end if;
  select * into pl from players where game_id = g.id and token_hash = p->>'token_hash' for update;
  if not found then perform cg_err('player_not_found'); end if;
  select * into t from cg_teams where id = (p->>'team_id')::uuid and game_id = g.id;
  if not found then perform cg_err('team_not_found'); end if;
  cap := not exists (select 1 from players where team_id = t.id and is_captain and id <> pl.id);
  update players set team_id = t.id, is_captain = cap where id = pl.id;
  perform cg_log(g.id, pl.id, 'team_joined', jsonb_build_object('team_id', t.id));
  perform cg_touch(g.id);
  return jsonb_build_object('team_id', t.id, 'captain', cap);
end $$;

create or replace function cg_add_item(p jsonb) returns jsonb language plpgsql as $$
declare g games; i uuid; n int;
begin
  g := cg_lock_game(p->>'room_code', (p->>'host_id')::uuid);
  if g.status = 'finished' then perform cg_err('invalid_state'); end if;
  select coalesce(max(sort_order), -1) + 1 into n from cg_items where game_id = g.id;
  begin
    insert into cg_items (game_id, sort_order, kind, text, options, correct, points)
    values (g.id, n, p->>'kind', trim(p->>'text'), p->'options', (p->>'correct')::int, coalesce((p->>'points')::int, 100))
    returning id into i;
  exception when check_violation then perform cg_err('invalid_input');
  end;
  perform cg_touch(g.id);
  return jsonb_build_object('item_id', i);
end $$;

-- ---------------------------------------------------------------------------
-- Partida y rondas
-- ---------------------------------------------------------------------------
create or replace function cg_start_game(p jsonb) returns jsonb language plpgsql as $$
declare g games;
begin
  g := cg_lock_game(p->>'room_code', (p->>'host_id')::uuid);
  if g.status <> 'lobby' then perform cg_err('invalid_state'); end if;
  if (select count(*) from cg_teams where game_id = g.id) < 1 then perform cg_err('no_teams'); end if;
  if not exists (select 1 from cg_items where game_id = g.id) then perform cg_err('no_items'); end if;
  update games set status = 'active' where id = g.id;
  perform cg_log(g.id, g.host_id, 'game_started');
  perform cg_touch(g.id);
  return jsonb_build_object('status', 'active');
end $$;

-- Lanza el siguiente ítem sin jugar. En retos, `team_id` indica quién lo hace
-- (por defecto, el equipo con menos puntos).
create or replace function cg_open_round(p jsonb) returns jsonb language plpgsql as $$
declare g games; it cg_items; r uuid; n int; tid uuid;
begin
  g := cg_lock_game(p->>'room_code', (p->>'host_id')::uuid);
  if g.status <> 'active' then perform cg_err('invalid_state'); end if;
  if exists (select 1 from cg_rounds where game_id = g.id and status = 'open') then perform cg_err('round_open'); end if;
  select * into it from cg_items i where i.game_id = g.id
     and not exists (select 1 from cg_rounds x where x.item_id = i.id) order by sort_order limit 1;
  if not found then perform cg_err('no_more_items'); end if;
  select coalesce(max(seq), 0) + 1 into n from cg_rounds where game_id = g.id;
  if it.kind = 'challenge' then
    tid := coalesce((p->>'team_id')::uuid,
      (select id from cg_teams where game_id = g.id order by score, created_at limit 1));
  end if;
  insert into cg_rounds (game_id, item_id, seq, team_id, closes_at)
  values (g.id, it.id, n, tid,
    case when it.kind = 'question' then clock_timestamp() + make_interval(secs => g.answer_seconds) end)
  returning id into r;
  perform cg_log(g.id, g.host_id, 'round_opened', jsonb_build_object('round_id', r, 'seq', n));
  perform cg_touch(g.id);
  return jsonb_build_object('round_id', r, 'seq', n);
end $$;

-- Equipos activos: con algún jugador conectado.
create or replace function cg_active_teams(p_game uuid) returns setof uuid language sql stable as $$
  select distinct pl.team_id from players pl
   where pl.game_id = p_game and pl.team_id is not null and pl.token_hash is not null and pl.retired_at is null
$$;

-- Núcleo ÚNICO de cierre: host, tiempo y «han respondido todos» pasan por aquí.
create or replace function cg_close_round_core(p_round uuid, p_by text) returns void language plpgsql as $$
declare r cg_rounds; it cg_items; ans record; pts int; total numeric; left_s numeric;
begin
  select * into r from cg_rounds where id = p_round;
  if r.status <> 'open' then return; end if;
  select * into it from cg_items where id = r.item_id;
  if it.kind = 'question' then
    select greatest(extract(epoch from (r.closes_at - r.opened_at)), 1) into total;
    for ans in select x.*, g.speed_bonus from cg_answers x join cg_rounds rr on rr.id = x.round_id
             join games g on g.id = rr.game_id where x.round_id = r.id and not x.passed and x.choice = it.correct loop
      pts := it.points;
      if ans.speed_bonus and r.closes_at is not null then
        left_s := greatest(extract(epoch from (r.closes_at - ans.answered_at)), 0);
        pts := pts + floor(it.points * least(left_s / total, 1) / 2)::int;
      end if;
      if exists (select 1 from cg_jokers j where j.team_id = ans.team_id and j.kind = 'double' and j.round_id = r.id) then
        pts := pts * 2;
      end if;
      update cg_answers set points = pts where id = ans.id;
      update cg_teams set score = score + pts where id = ans.team_id;
    end loop;
  end if;
  update cg_rounds set status = 'revealed', closed_by = p_by where id = r.id;
  update players set score = (select score from cg_teams t where t.id = players.team_id)
   where game_id = r.game_id and team_id is not null;
end $$;

create or replace function cg_close_round(p jsonb) returns jsonb language plpgsql as $$
declare g games; r cg_rounds; via text := coalesce(p->>'by', 'host');
begin
  if via = 'time' then
    g := cg_lock_game_public(p->>'room_code');
  else
    g := cg_lock_game(p->>'room_code', (p->>'host_id')::uuid);
  end if;
  select * into r from cg_rounds where game_id = g.id and status = 'open';
  if not found then return jsonb_build_object('closed', false); end if;
  if via = 'time' and (r.closes_at is null or clock_timestamp() < r.closes_at) then perform cg_err('too_early'); end if;
  perform cg_close_round_core(r.id, via);
  perform cg_log(g.id, g.host_id, 'round_closed', jsonb_build_object('round_id', r.id, 'by', via));
  perform cg_touch(g.id);
  return jsonb_build_object('closed', true);
end $$;

-- Reto: el presentador lo da por bueno o no.
create or replace function cg_validate_challenge(p jsonb) returns jsonb language plpgsql as $$
declare g games; r cg_rounds; it cg_items; ok boolean := coalesce((p->>'success')::boolean, false);
begin
  g := cg_lock_game(p->>'room_code', (p->>'host_id')::uuid);
  select * into r from cg_rounds where game_id = g.id and status = 'open';
  if not found then perform cg_err('no_open_round'); end if;
  select * into it from cg_items where id = r.item_id;
  if it.kind <> 'challenge' then perform cg_err('invalid_state'); end if;
  if ok then
    update cg_teams set score = score + it.points where id = r.team_id;
    insert into cg_answers (round_id, team_id, points) values (r.id, r.team_id, it.points)
      on conflict (round_id, team_id) do update set points = excluded.points;
  end if;
  perform cg_close_round_core(r.id, 'host');
  perform cg_log(g.id, g.host_id, 'challenge_validated', jsonb_build_object('round_id', r.id, 'success', ok));
  perform cg_touch(g.id);
  return jsonb_build_object('success', ok);
end $$;

-- ---------------------------------------------------------------------------
-- Móvil: responder y usar comodines
-- ---------------------------------------------------------------------------
create or replace function cg_answer(p jsonb) returns jsonb language plpgsql as $$
declare g games; pl players; r cg_rounds; it cg_items; ch int := (p->>'choice')::int; hidden jsonb; pending int; res jsonb;
begin
  g := cg_lock_game_public(p->>'room_code');
  res := cg_idem_get(g.id, p->>'idempotency_key', 'answer');
  if res is not null then return res; end if;
  select * into pl from players where game_id = g.id and token_hash = p->>'token_hash';
  if not found or pl.team_id is null then perform cg_err('player_not_found'); end if;
  select * into r from cg_rounds where game_id = g.id and status = 'open';
  if not found then perform cg_err('no_open_round'); end if;
  select * into it from cg_items where id = r.item_id;
  if it.kind <> 'question' then perform cg_err('invalid_state'); end if;
  if r.closes_at is not null and clock_timestamp() > r.closes_at then perform cg_err('round_closed'); end if;
  -- responde el capitán; si el equipo no tiene capitán conectado, cualquiera
  if not pl.is_captain and exists (select 1 from players c where c.team_id = pl.team_id and c.is_captain and c.token_hash is not null) then
    perform cg_err('not_captain');
  end if;
  if ch is null or ch < 0 or ch >= jsonb_array_length(it.options) then perform cg_err('invalid_input'); end if;
  select data->'hidden' into hidden from cg_jokers where team_id = pl.team_id and kind = 'fifty' and round_id = r.id;
  if hidden is not null and hidden @> to_jsonb(ch) then perform cg_err('invalid_input'); end if;
  if exists (select 1 from cg_answers where round_id = r.id and team_id = pl.team_id) then perform cg_err('already_answered'); end if;
  insert into cg_answers (round_id, team_id, choice) values (r.id, pl.team_id, ch);
  perform cg_log(g.id, pl.id, 'answered', jsonb_build_object('team_id', pl.team_id));
  select count(*) into pending from cg_active_teams(g.id) t
   where not exists (select 1 from cg_answers a where a.round_id = r.id and a.team_id = t);
  if pending = 0 then perform cg_close_round_core(r.id, 'all'); end if;
  perform cg_touch(g.id);
  res := jsonb_build_object('ok', true, 'closed', pending = 0);
  perform cg_idem_put(g.id, p->>'idempotency_key', 'answer', res);
  return res;
end $$;

-- Comodines: fifty (oculta 2 incorrectas), double (x2 si acierta), pass (no puntúa y cuenta como respondida).
create or replace function cg_use_joker(p jsonb) returns jsonb language plpgsql as $$
declare g games; pl players; r cg_rounds; it cg_items; j cg_jokers; jk text := p->>'kind'; wrong int[]; hid jsonb; pending int;
begin
  g := cg_lock_game_public(p->>'room_code');
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
  select * into j from cg_jokers where team_id = pl.team_id and kind = jk for update;
  if not found then perform cg_err('invalid_input'); end if;
  if j.round_id is not null then perform cg_err('joker_used'); end if;
  if exists (select 1 from cg_jokers where team_id = pl.team_id and round_id = r.id) then perform cg_err('joker_used'); end if;
  if jk = 'fifty' then
    if jsonb_array_length(it.options) < 4 then perform cg_err('invalid_input'); end if;
    select array_agg(i) into wrong from (
      select i from generate_series(0, 3) i where i <> it.correct order by random() limit 2) s;
    hid := to_jsonb(wrong);
    update cg_jokers set round_id = r.id, data = jsonb_build_object('hidden', hid) where id = j.id;
  else
    update cg_jokers set round_id = r.id where id = j.id;
    if jk = 'pass' then
      insert into cg_answers (round_id, team_id, passed) values (r.id, pl.team_id, true);
      select count(*) into pending from cg_active_teams(g.id) t
       where not exists (select 1 from cg_answers a where a.round_id = r.id and a.team_id = t);
      if pending = 0 then perform cg_close_round_core(r.id, 'all'); end if;
    end if;
  end if;
  perform cg_log(g.id, pl.id, 'joker_used', jsonb_build_object('team_id', pl.team_id, 'kind', jk));
  perform cg_touch(g.id);
  return jsonb_build_object('ok', true);
end $$;

-- Cierre de la partida: el podio sale del marcador.
create or replace function cg_finish_game(p jsonb) returns jsonb language plpgsql as $$
declare g games;
begin
  g := cg_lock_game(p->>'room_code', (p->>'host_id')::uuid);
  if g.status = 'finished' then return jsonb_build_object('status', 'finished'); end if;
  perform cg_close_round_core(r.id, 'host') from cg_rounds r where r.game_id = g.id and r.status = 'open';
  update games set status = 'finished', finished_at = now() where id = g.id;
  perform cg_log(g.id, g.host_id, 'game_finished');
  perform cg_touch(g.id);
  return jsonb_build_object('status', 'finished');
end $$;

-- ---------------------------------------------------------------------------
-- Instantánea: envoltorio de cg_get_state. Filtra lo secreto en SQL.
-- ---------------------------------------------------------------------------
alter function cg_get_state(jsonb) rename to cg_get_state_base;

create or replace function cg_get_state(p jsonb) returns jsonb language plpgsql as $$
declare s jsonb; g games; v text := coalesce(p->>'view','public'); r cg_rounds; it cg_items;
        my players; myteam uuid; round_j jsonb := null; opts jsonb; hidden jsonb;
begin
  s := cg_get_state_base(p);
  select * into g from games where room_code = upper(coalesce(p->>'room_code',''));
  s := s || jsonb_build_object(
    'theme', g.theme, 'speed_bonus', g.speed_bonus, 'answer_seconds', g.answer_seconds,
    'teams', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color, 'score', t.score,
        'members', (select count(*) from players pl where pl.team_id = t.id)) order by t.score desc, t.created_at)
        from cg_teams t where t.game_id = g.id), '[]'::jsonb),
    'items_total', (select count(*) from cg_items where game_id = g.id),
    'rounds_played', (select count(*) from cg_rounds where game_id = g.id and status = 'revealed'));
  if v = 'player' and p->>'token_hash' is not null then
    select * into my from players where game_id = g.id and token_hash = p->>'token_hash';
    myteam := my.team_id;
    s := s || jsonb_build_object('me', jsonb_build_object('player_id', my.id, 'team_id', my.team_id, 'captain', my.is_captain));
  end if;
  select * into r from cg_rounds where game_id = g.id order by seq desc limit 1;
  if found then
    select * into it from cg_items where id = r.item_id;
    opts := it.options;
    round_j := jsonb_build_object('id', r.id, 'seq', r.seq, 'status', r.status, 'kind', it.kind, 'text', it.text,
      'options', opts, 'points', it.points, 'team_id', r.team_id, 'opened_at', r.opened_at, 'closes_at', r.closes_at,
      'closed_by', r.closed_by,
      'answered', (select count(*) from cg_answers where round_id = r.id),
      'active_teams', (select count(*) from cg_active_teams(g.id)));
    if r.status = 'revealed' then
      round_j := round_j || jsonb_build_object('correct', it.correct,
        'results', coalesce((select jsonb_agg(jsonb_build_object('team_id', a.team_id, 'choice', a.choice, 'passed', a.passed, 'points', a.points))
                   from cg_answers a where a.round_id = r.id), '[]'::jsonb));
    end if;
    if v = 'player' and myteam is not null then
      select data->'hidden' into hidden from cg_jokers where team_id = myteam and kind = 'fifty' and round_id = r.id;
      round_j := round_j || jsonb_build_object(
        'my_answer', (select jsonb_build_object('choice', a.choice, 'passed', a.passed) from cg_answers a where a.round_id = r.id and a.team_id = myteam),
        'hidden', coalesce(hidden, '[]'::jsonb));
    end if;
    s := s || jsonb_build_object('round', round_j);
  end if;
  if v = 'player' and myteam is not null then
    s := s || jsonb_build_object('jokers', coalesce((select jsonb_object_agg(kind, round_id is null) from cg_jokers where team_id = myteam), '{}'::jsonb));
  end if;
  if v = 'host' then
    s := s || jsonb_build_object('items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'kind', i.kind, 'text', i.text,
        'options', i.options, 'correct', i.correct, 'points', i.points) order by i.sort_order) from cg_items i where i.game_id = g.id), '[]'::jsonb));
  end if;
  return s;
end $$;
