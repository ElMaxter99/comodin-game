# Comodín Game · guía para agentes

Lee: `CLAUDE.md` → `docs/README.md` → el documento de tu tarea.

0. Si el cambio toca interfaz o flujo: primero el diseño en `partykit-casero/juegos/comodin-game/design/` (workspace), luego aquí.
1. Revisa el estado (`git status`, `docs/PENDIENTE.md`, `docs/DECISIONES.md`) antes de proponer cambios.
2. Capa autoritativa primero (SQL), luego Zod/servicios, luego UI; tests en la misma tarea.
3. Verifica: `npm run lint && npm run typecheck && npm test`; Postgres real si tocas SQL; e2e si tocas UI; `npm run build && npm run scan:secrets` al cerrar.
4. Actualiza README, `docs/`, `.env.example`, `docs/PENDIENTE.md` y `docs/DECISIONES.md`.
5. Informa con honestidad de lo verificado y lo no verificado.

Prohibido: secretos en el repo, simular IA o despliegues, planes de pago, duplicar reglas en TS, editar migraciones aplicadas, saltarse tests.
