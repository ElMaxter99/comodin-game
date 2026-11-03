-- =============================================================================
-- Comodín Game · coreografía del diseño «Baraja» (partykit-casero · juegos/comodin-game/design/DESIGN.md §6, §7)
-- Reparto de la ronda (intro), suspense antes de revelar y pausa dramática.
-- La respuesta correcta y los puntos NO salen del servidor hasta que llega la revelación.
-- =============================================================================

alter table games add column intro_seconds    integer not null default 4 check (intro_seconds between 0 and 15);
alter table games add column suspense_seconds integer not null default 3 check (suspense_seconds between 0 and 15);
alter table games add column dramatic_pause   boolean not null default false;

alter table cg_rounds add column closed_at timestamptz;
alter table cg_rounds add column reveal_at timestamptz;   -- null en una ronda cerrada = esperando «Revelar» del presentador

-- Abrir ronda: el tiempo de respuesta empieza tras el reparto (intro).
create or replace function cg_open_round(p jsonb) returns jsonb language plpgsql as $$
declare g games; it cg_items; r uuid; n int; tid uuid;
begin
  g := cg_lock_game(p->>'room_code', (p->>'host_id')::uuid);
  if g.status <> 'active' then perform cg_err('invalid_state'); end if;
  if exists (select 1 from cg_rounds where game_id = g.id and status = 'open') then perform cg_err('round_open'); end if;
  -- Una ronda cerrada que aún espera «Revelar» se revela antes de abrir la siguiente.
  update cg_rounds set reveal_at = clock_timestamp() where game_id = g.id and status = 'revealed' and reveal_at is null;
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
    case when it.kind = 'question' then clock_timestamp() + make_interval(secs => g.intro_seconds + g.answer_seconds) end)
  returning id into r;
  perform cg_log(g.id, g.host_id, 'round_opened', jsonb_build_object('round_id', r, 'seq', n));
  perform cg_touch(g.id);
  return jsonb_build_object('round_id', r, 'seq', n);
end $$;

-- Núcleo único de cierre (versión con suspense). Host, tiempo y «todos han respondido» pasan por aquí.
create or replace function cg_close_round_core(p_round uuid, p_by text) returns void language plpgsql as $$
declare r cg_rounds; it cg_items; g games; ans record; pts int; total numeric; left_s numeric; rev timestamptz;
begin
  select * into r from cg_rounds where id = p_round;
  if r.status <> 'open' then return; end if;
  select * into it from cg_items where id = r.item_id;
  select * into g from games where id = r.game_id;
  if it.kind = 'question' then
    select greatest(extract(epoch from (r.closes_at - r.opened_at)) - g.intro_seconds, 1) into total;
    for ans in select x.* from cg_answers x where x.round_id = r.id and not x.passed and x.choice = it.correct loop
      pts := it.points;
      if g.speed_bonus and r.closes_at is not null then
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
  -- Retos: se revelan al momento (el presentador ya decidió). Preguntas: tras el suspense, o al pulsar «Revelar» si hay pausa dramática.
  rev := case when it.kind = 'challenge' then clock_timestamp()
              when g.dramatic_pause then null
              else clock_timestamp() + make_interval(secs => g.suspense_seconds) end;
  update cg_rounds set status = 'revealed', closed_by = p_by, closed_at = clock_timestamp(), reveal_at = rev where id = r.id;
  update players set score = (select score from cg_teams t where t.id = players.team_id)
   where game_id = r.game_id and team_id is not null;
end $$;

-- No se puede responder durante el reparto (preguntas); los retos no pasan por aquí.
create or replace function cg_answers_intro_guard() returns trigger language plpgsql as $$
declare r cg_rounds; intro int;
begin
  select * into r from cg_rounds where id = new.round_id;
  if r.closes_at is null then return new; end if;
  select g.intro_seconds into intro from games g where g.id = r.game_id;
  if clock_timestamp() < r.opened_at + make_interval(secs => intro) then
    raise exception 'ERR:round_not_started' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger cg_answers_intro before insert on cg_answers for each row execute function cg_answers_intro_guard();

-- Presentador: revelar una ronda en pausa dramática.
create or replace function cg_reveal(p jsonb) returns jsonb language plpgsql as $$
declare g games; n int;
begin
  g := cg_lock_game(p->>'room_code', (p->>'host_id')::uuid);
  update cg_rounds set reveal_at = clock_timestamp()
   where game_id = g.id and status = 'revealed' and (reveal_at is null or reveal_at > clock_timestamp());
  get diagnostics n = row_count;
  if n > 0 then perform cg_log(g.id, g.host_id, 'round_revealed'); perform cg_touch(g.id); end if;
  return jsonb_build_object('revealed', n > 0);
end $$;

-- Presentador: activar o desactivar la pausa dramática (no afecta a rondas ya cerradas).
create or replace function cg_set_pause(p jsonb) returns jsonb language plpgsql as $$
declare g games; v boolean := coalesce((p->>'on')::boolean, false);
begin
  g := cg_lock_game(p->>'room_code', (p->>'host_id')::uuid);
  if g.status = 'finished' then perform cg_err('invalid_state'); end if;
  update games set dramatic_pause = v where id = g.id;
  perform cg_log(g.id, g.host_id, 'pause_' || case when v then 'on' else 'off' end);
  perform cg_touch(g.id);
  return jsonb_build_object('dramatic_pause', v);
end $$;

-- Instantánea: envoltorio que añade la fase y oculta lo secreto durante el suspense.
alter function cg_get_state(jsonb) rename to cg_get_state_pre_baraja;

create or replace function cg_get_state(p jsonb) returns jsonb language plpgsql as $$
declare s jsonb; g games; r cg_rounds; v text := coalesce(p->>'view', 'public'); suspense boolean := false; phase text;
begin
  s := cg_get_state_pre_baraja(p);
  select * into g from games where room_code = upper(coalesce(p->>'room_code', ''));
  s := s || jsonb_build_object('dramatic_pause', g.dramatic_pause, 'intro_seconds', g.intro_seconds, 'suspense_seconds', g.suspense_seconds);
  select * into r from cg_rounds where game_id = g.id order by seq desc limit 1;
  if not found then return s; end if;
  suspense := r.status = 'revealed' and (r.reveal_at is null or clock_timestamp() < r.reveal_at);
  phase := case when r.status = 'open' then 'open' when suspense then 'suspense' else 'revealed' end;
  s := jsonb_set(s, '{round}', (s->'round') || jsonb_build_object(
    'phase', phase,
    'intro_until', r.opened_at + make_interval(secs => g.intro_seconds),
    'closed_at', r.closed_at, 'reveal_at', r.reveal_at,
    'hold', suspense and r.reveal_at is null,
    -- Qué equipos ya han confirmado (no QUÉ han elegido).
    'answered_teams', coalesce((select jsonb_agg(a.team_id) from cg_answers a where a.round_id = r.id), '[]'::jsonb)));
  if suspense and v <> 'host' then
    -- Nada que delate el resultado: sin correcta, sin respuestas, marcador anterior.
    s := s #- '{round,correct}' #- '{round,results}';
    s := jsonb_set(s, '{teams}', coalesce((
      select jsonb_agg(t.obj order by (t.obj->>'score')::int desc, t.ord)
        from (select jsonb_set(e, '{score}', to_jsonb(greatest((e->>'score')::int - coalesce(
                       (select sum(a.points) from cg_answers a where a.round_id = r.id and a.team_id = (e->>'id')::uuid), 0), 0))) as obj, ord
                from jsonb_array_elements(s->'teams') with ordinality as x(e, ord)) t), '[]'::jsonb));
    s := jsonb_set(s, '{players}', coalesce((select jsonb_agg(e - 'score') from jsonb_array_elements(s->'players') e), '[]'::jsonb));
  end if;
  return s;
end $$;
