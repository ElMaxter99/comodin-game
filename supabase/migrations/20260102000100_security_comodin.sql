-- Seguridad específica de Supabase (no se ejecuta en PGlite).
alter table cg_teams   enable row level security;
alter table cg_items   enable row level security;
alter table cg_rounds  enable row level security;
alter table cg_answers enable row level security;
alter table cg_jokers  enable row level security;

revoke all on cg_teams, cg_items, cg_rounds, cg_answers, cg_jokers from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
grant all on cg_teams, cg_items, cg_rounds, cg_answers, cg_jokers to service_role;
grant execute on all functions in schema public to service_role;
