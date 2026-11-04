# Arquitectura

Sigue la de `partykit-casero`. Hoy solo existe el núcleo común (`supabase/migrations/…_core.sql`: `games`, `players`, `game_events`, `idempotency_keys`, `cg_create_game`, `cg_join_new_player`, `cg_get_state`…).

## Migraciones (en orden)
1. `20260101000000_core.sql` + `…100_security.sql`: núcleo común de la plantilla.
2. `20260102000000_comodin.sql` + `…100_security_comodin.sql`: reglas del juego.

## Funciones del juego (`cg_*`)
`cg_create_team`, `cg_join_team` (el primero es capitán), `cg_add_item`, `cg_start_game`, `cg_open_round`, `cg_answer`, `cg_use_joker` (`fifty`, `double`, `pass`), `cg_validate_challenge`, `cg_close_round` (host o `by: time`), `cg_finish_game`. Todo cierre pasa por el núcleo único `cg_close_round_core` (host, tiempo o «han respondido todos»). `cg_get_state` es un envoltorio que filtra la opción correcta hasta el reveal.

Tablas: `cg_teams`, `cg_items`, `cg_rounds`, `cg_answers` (único por equipo y ronda), `cg_jokers`; columnas `theme`, `speed_bonus`, `answer_seconds` en `games`.

## Coreografía «Baraja» (migración `20260103000000_baraja.sql`)
`cg_open_round` añade el reparto (`intro_seconds`, 4 s por defecto) al tiempo de respuesta; un disparador impide responder durante el reparto. El cierre (`cg_close_round_core`) guarda `closed_at` y `reveal_at` (suspense de `suspense_seconds`, 3 s, o `null` si hay pausa dramática hasta `cg_reveal`). `cg_set_pause` activa la pausa. El envoltorio de `cg_get_state` añade `round.phase` (`open` · `suspense` · `revealed`) y, en suspense, **quita la correcta, las respuestas por equipo y el marcador nuevo** en las vistas pública y de jugador (el presentador sí los ve).
