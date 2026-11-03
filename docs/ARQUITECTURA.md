# Arquitectura

Sigue la de `partykit-casero`. Hoy solo existe el núcleo común (`supabase/migrations/…_core.sql`: `games`, `players`, `game_events`, `idempotency_keys`, `cg_create_game`, `cg_join_new_player`, `cg_get_state`…).

Previsto (`cg_*`): `cg_teams`, `cg_items`, `cg_rounds`, `cg_answers` (único por equipo y ronda), `cg_jokers`, `cg_theme` en `games`; núcleo `cg_close_round`.
