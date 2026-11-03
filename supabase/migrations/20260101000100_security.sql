-- Seguridad específica de Supabase (no se ejecuta en PGlite): RLS deny-all y EXECUTE solo para service_role.
alter table games            enable row level security;
alter table players          enable row level security;
alter table game_events      enable row level security;
alter table idempotency_keys enable row level security;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
-- EXECUTE a PUBLIC es un privilegio por defecto GLOBAL: se revoca sin `in schema`.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;

grant usage on schema public to service_role;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
