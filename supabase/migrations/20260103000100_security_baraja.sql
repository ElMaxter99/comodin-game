-- Seguridad específica de Supabase (no se ejecuta en PGlite).
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
