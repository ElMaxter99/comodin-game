-- Seguridad específica de Supabase (no se ejecuta en PGlite).
alter table cg_bets enable row level security;
revoke all on cg_bets from anon, authenticated;
grant all on cg_bets to service_role;
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
