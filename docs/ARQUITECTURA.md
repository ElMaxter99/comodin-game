# Arquitectura

Sigue la de `partykit-casero`. Hoy solo existe el núcleo común (`supabase/migrations/…_core.sql`: `games`, `players`, `game_events`, `idempotency_keys`, `cg_create_game`, `cg_join_new_player`, `cg_get_state`…).

## Migraciones (en orden)
1. `20260101000000_core.sql` + `…100_security.sql`: núcleo común de la plantilla.
2. `20260102000000_comodin.sql` + `…100_security_comodin.sql`: reglas del juego.

## Funciones del juego (`cg_*`)
`cg_create_team`, `cg_join_team` (el primero es capitán), `cg_add_item`, `cg_start_game`, `cg_open_round`, `cg_answer`, `cg_use_joker` (`fifty`, `double`, `pass`), `cg_validate_challenge`, `cg_close_round` (host o `by: time`), `cg_finish_game`. Todo cierre pasa por el núcleo único `cg_close_round_core` (host, tiempo o «han respondido todos»). `cg_get_state` es un envoltorio que filtra la opción correcta hasta el reveal.

Tablas: `cg_teams`, `cg_items`, `cg_rounds`, `cg_answers` (único por equipo y ronda), `cg_jokers`; columnas `theme`, `speed_bonus`, `answer_seconds` en `games`.
