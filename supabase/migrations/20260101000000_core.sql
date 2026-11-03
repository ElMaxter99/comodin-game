-- =============================================================================
-- Comodín Game · esquema núcleo común (PostgreSQL portable)
-- Prefijo de funciones: cg_  (sustitúyelo por el del juego, p. ej. qz_)
--
-- Toda la lógica que decide algo vive aquí, en funciones SQL transaccionales.
--   · Producción -> supabase.rpc('cg_*', { p: {...} })
--   · Tests / desarrollo local -> el mismo SQL sobre PGlite
-- Convenciones: cantidades en enteros; errores RAISE EXCEPTION 'ERR:codigo' (P0001);
-- cada función mutante bloquea la fila de la partida (FOR UPDATE).
-- =============================================================================

create table games (
  id            uuid primary key default gen_random_uuid(),
  room_code     text not null unique check (room_code ~ '^[A-Z0-9]{4,12}$'),
  host_id       uuid not null,
  name          text not null check (char_length(name) between 1 and 80),
  status        text not null default 'lobby' check (status in ('lobby','active','paused','finished')),
  max_players   integer not null default 10 check (max_players between 1 and 10),
  version       bigint not null default 1,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  finished_at   timestamptz
);
create index games_host_idx on games (host_id, created_at desc);

create table players (
  id             uuid primary key default gen_random_uuid(),
  game_id        uuid not null references games(id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 40),
  color          text not null default '#a78bfa' check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order     integer not null default 0,
  score          integer not null default 0,
  token_hash     text,
  joined_at      timestamptz,
  last_seen_at   timestamptz,
  retired_at     timestamptz,
  created_at     timestamptz not null default now()
);
create unique index players_game_name_uq on players (game_id, lower(name));
create unique index players_token_uq on players (game_id, token_hash) where token_hash is not null;
create index players_game_idx on players (game_id, sort_order);

create table game_events (
  id          bigint generated always as identity primary key,
  game_id     uuid not null references games(id) on delete cascade,
  actor_id    uuid,
  event_type  text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default clock_timestamp()
);
create index game_events_game_idx on game_events (game_id, id);

create table idempotency_keys (
  game_id     uuid not null references games(id) on delete cascade,
  key         text not null check (char_length(key) between 8 and 100),
  action      text not null,
  result      jsonb not null,
  created_at  timestamptz not null default now(),
  primary key (game_id, key)
);

-- ---------------------------------------------------------------------------
-- Utilidades internas
-- ---------------------------------------------------------------------------
create or replace function cg_err(code text) returns void language plpgsql as $$
begin
  raise exception 'ERR:%', code using errcode = 'P0001';
end $$;

create or replace function cg_gen_room_code() returns text language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from games where room_code = code);
  end loop;
  return code;
end $$;

-- Bloquea la partida y comprueba que `p_host` es su anfitrión.
create or replace function cg_lock_game(p_room text, p_host uuid) returns games language plpgsql as $$
declare g games;
begin
  select * into g from games where room_code = upper(coalesce(p_room, '')) for update;
  if not found then perform cg_err('game_not_found'); end if;
  if p_host is null or g.host_id <> p_host then perform cg_err('not_host'); end if;
  return g;
end $$;

-- Bloquea la partida sin exigir anfitrión (acciones de jugador).
create or replace function cg_lock_game_public(p_room text) returns games language plpgsql as $$
declare g games;
begin
  select * into g from games where room_code = upper(coalesce(p_room, '')) for update;
  if not found then perform cg_err('game_not_found'); end if;
  return g;
end $$;

create or replace function cg_touch(p_game uuid) returns void language sql as $$
  update games set version = version + 1, updated_at = now() where id = p_game;
$$;

create or replace function cg_log(p_game uuid, p_actor uuid, p_type text, p_payload jsonb default '{}'::jsonb)
returns void language sql as $$
  insert into game_events (game_id, actor_id, event_type, payload) values (p_game, p_actor, p_type, coalesce(p_payload, '{}'::jsonb));
$$;

create or replace function cg_idem_get(p_game uuid, p_key text, p_action text) returns jsonb language plpgsql as $$
declare r idempotency_keys;
begin
  if p_key is null then return null; end if;
  select * into r from idempotency_keys where game_id = p_game and key = p_key;
  if not found then return null; end if;
  if r.action <> p_action then perform cg_err('idempotency_conflict'); end if;
  return r.result;
end $$;

create or replace function cg_idem_put(p_game uuid, p_key text, p_action text, p_result jsonb) returns void language plpgsql as $$
begin
  if p_key is not null then
    insert into idempotency_keys (game_id, key, action, result) values (p_game, p_key, p_action, p_result)
    on conflict (game_id, key) do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Partida
-- ---------------------------------------------------------------------------
create or replace function cg_create_game(p jsonb) returns jsonb language plpgsql as $$
declare g_id uuid; code text;
begin
  if (p->>'host_id') is null then perform cg_err('not_host'); end if;
  code := cg_gen_room_code();
  insert into games (room_code, host_id, name, max_players)
  values (code, (p->>'host_id')::uuid, coalesce(nullif(trim(p->>'name'), ''), 'Partida'), coalesce((p->>'max_players')::int, 10))
  returning id into g_id;
  perform cg_log(g_id, (p->>'host_id')::uuid, 'game_created', jsonb_build_object('room_code', code));
  return jsonb_build_object('game_id', g_id, 'room_code', code);
end $$;

create or replace function cg_game_status(p jsonb) returns jsonb language plpgsql as $$
declare g games; target text := p->>'status';
begin
  g := cg_lock_game(p->>'room_code', (p->>'host_id')::uuid);
  if target not in ('active','paused','finished') then perform cg_err('invalid_input'); end if;
  if g.status = 'finished' then perform cg_err('invalid_state'); end if;
  if target = 'active' and g.status not in ('lobby','paused') then perform cg_err('invalid_state'); end if;
  if target = 'paused' and g.status <> 'active' then perform cg_err('invalid_state'); end if;
  update games set status = target, finished_at = case when target = 'finished' then now() else finished_at end where id = g.id;
  perform cg_log(g.id, g.host_id, 'game_' || target);
  perform cg_touch(g.id);
  return jsonb_build_object('status', target);
end $$;

-- ---------------------------------------------------------------------------
-- Jugadores (móviles): unirse con token hasheado
-- ---------------------------------------------------------------------------
create or replace function cg_identify_player(p jsonb) returns jsonb language plpgsql as $$
declare pid uuid;
begin
  select pl.id into pid from players pl join games g on g.id = pl.game_id
   where g.room_code = upper(coalesce(p->>'room_code','')) and pl.token_hash = p->>'token_hash';
  return jsonb_build_object('player_id', pid);
end $$;

create or replace function cg_join_new_player(p jsonb) returns jsonb language plpgsql as $$
declare g games; pid uuid; n int; nm text := trim(coalesce(p->>'name',''));
begin
  g := cg_lock_game_public(p->>'room_code');
  if g.status <> 'lobby' then perform cg_err('join_closed'); end if;
  if char_length(nm) not between 1 and 40 then perform cg_err('invalid_input'); end if;
  select count(*) into n from players where game_id = g.id;
  if n >= g.max_players then perform cg_err('too_many_players'); end if;
  if exists (select 1 from players where game_id = g.id and lower(name) = lower(nm)) then perform cg_err('duplicate_name'); end if;
  insert into players (game_id, name, color, sort_order, token_hash, joined_at, last_seen_at)
  values (g.id, nm, coalesce(p->>'color', '#a78bfa'), n, p->>'token_hash', clock_timestamp(), clock_timestamp())
  returning id into pid;
  perform cg_log(g.id, pid, 'player_joined');
  perform cg_touch(g.id);
  return jsonb_build_object('player_id', pid);
end $$;

create or replace function cg_claim_player(p jsonb) returns jsonb language plpgsql as $$
declare g games; pl players;
begin
  g := cg_lock_game_public(p->>'room_code');
  select * into pl from players where id = (p->>'player_id')::uuid and game_id = g.id for update;
  if not found then perform cg_err('player_not_found'); end if;
  if pl.token_hash is not null then perform cg_err('player_taken'); end if;
  update players set token_hash = p->>'token_hash', joined_at = coalesce(joined_at, clock_timestamp()), last_seen_at = clock_timestamp() where id = pl.id;
  perform cg_log(g.id, pl.id, 'player_claimed');
  perform cg_touch(g.id);
  return jsonb_build_object('player_id', pl.id);
end $$;

create or replace function cg_release_player(p jsonb) returns jsonb language plpgsql as $$
declare g games; pl players;
begin
  g := cg_lock_game_public(p->>'room_code');
  select * into pl from players where game_id = g.id and token_hash = p->>'token_hash' for update;
  if not found then return jsonb_build_object('replay', true); end if;
  update players set token_hash = null where id = pl.id;
  perform cg_log(g.id, pl.id, 'player_released');
  perform cg_touch(g.id);
  return jsonb_build_object('replay', false);
end $$;

-- Latido de presencia: camino rápido sin bloqueo y SIN subir la versión.
create or replace function cg_player_ping(p jsonb) returns jsonb language plpgsql as $$
begin
  update players pl set last_seen_at = clock_timestamp()
    from games g
   where g.id = pl.game_id and g.room_code = upper(coalesce(p->>'room_code',''))
     and pl.token_hash = p->>'token_hash' and coalesce((p->>'bye')::boolean, false) = false;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- Instantánea
-- ---------------------------------------------------------------------------
create or replace function cg_presence_window() returns interval language sql immutable as $$ select interval '40 seconds' $$;

create or replace function cg_get_state(p jsonb) returns jsonb language plpgsql as $$
declare g games; v text := coalesce(p->>'view', 'public'); s jsonb;
begin
  select * into g from games where room_code = upper(coalesce(p->>'room_code',''));
  if not found then perform cg_err('game_not_found'); end if;
  if v = 'host' and (p->>'host_id' is null or g.host_id <> (p->>'host_id')::uuid) then perform cg_err('not_host'); end if;
  s := jsonb_build_object(
    'version', g.version,
    'server_time', clock_timestamp(),
    'game', jsonb_build_object('id', g.id, 'room_code', g.room_code, 'name', g.name, 'status', g.status, 'max_players', g.max_players),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pl.id, 'name', pl.name, 'color', pl.color, 'score', pl.score,
        'claimed', pl.token_hash is not null,
        'joined', pl.joined_at is not null,
        'retired', pl.retired_at is not null,
        'online', pl.token_hash is not null and pl.last_seen_at > clock_timestamp() - cg_presence_window()
      ) order by pl.sort_order) from players pl where pl.game_id = g.id), '[]'::jsonb)
  );
  if v = 'host' then s := s || jsonb_build_object('host_id', g.host_id); end if;
  return s;
end $$;
