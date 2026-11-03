# Comodín Game · guía para Claude (léela primero)

Juego de fiesta original para casa: un presentador lanza **preguntas** (cuatro respuestas) y **retos** a **equipos de amigos**; la **TV** muestra la ronda, cada **móvil** es un mando, se usan **comodines** y al final hay podio. Diseño `base` primero; después temas por estación (Navidad, Halloween…). Es un juego original: no copia formatos, nombres ni marcas de programas de TV.

> Este juego sigue la arquitectura de **PartyKit Casero** (workspace privado `ElMaxter99/partykit-casero`): lee su `CLAUDE.md` y `docs/ARQUITECTURA.md` si tienes acceso. Antes de tocar nada lee `AGENTS.md` y `docs/README.md`.

## Stack
Next.js App Router · TypeScript estricto · Tailwind · Zod · Supabase (Postgres, Auth, Realtime Broadcast, Storage) · PGlite (tests y desarrollo) · Vitest · Playwright. Despliegue: Vercel. Idioma: español.

## Comandos
```bash
npm run dev                                     # sin credenciales arranca en modo de desarrollo (PGlite)
npm run lint && npm run typecheck && npm test   # comprobación rápida
npm run build && npm run scan:secrets           # antes de dar nada por terminado
```

## Regla de oro
Toda la lógica de decisión vive en funciones SQL `cg_*` (`p jsonb`, `RAISE 'ERR:codigo'`, bloqueo `FOR UPDATE`, idempotencia, `cg_touch` en cada cambio). TypeScript valida, autentica, llama a `ctx.db.rpc` y presenta. No dupliques reglas en TS.

## Añadir una función (receta)
1. Migración portable + `_security_` (nunca editar una aplicada).
2. Función grande ya existente → patrón envoltorio.
3. Acción del anfitrión: `schemas.ts` → `toRpc` → función SQL; error nuevo en `errors.ts`.
4. Tipos, UI en `components/{screen,host,play}`, ruta con `handle()`, `assertSameOrigin`, `limit()`.
5. Tests (PGlite; e2e si es de UI) y documentación.

## Diseño (el «figma» está en el workspace)
El diseño de este juego **no vive en este repo**: está en `partykit-casero/juegos/comodin-game/design/` ([DESIGN.md](https://github.com/ElMaxter99/partykit-casero/tree/main/juegos/comodin-game/design/DESIGN.md), [FLUJOS.md](https://github.com/ElMaxter99/partykit-casero/tree/main/juegos/comodin-game/design/FLUJOS.md), tokens, maquetas). Diseño primero: ningún cambio de interfaz o de flujo se programa aquí sin estar antes allí. `src/app/globals.css` porta sus tokens y componentes.

## Reglas que no se negocian
Honestidad (no simular IA ni despliegues) · solo servicios gratuitos, sin pago automático · secretos nunca en repo/logs/chat · migraciones inmutables · cliente sin `service_role` · README y docs al día · no crear PR si no te lo piden · no desplegar sin permiso.

## Mapa
```
supabase/migrations/   SQL autoritativo (núcleo común + cg_* del juego)
src/app/ (páginas y /api) · src/lib/server/ (db PGlite, api) · src/lib/live.ts (cliente) · docs/referencia/ (referencias de la plantilla)
docs/                  README, ARQUITECTURA, REGLAS-DE-JUEGO, DECISIONES, HISTORIAL, PENDIENTE
```
Estado: **reglas SQL con tests y app Next.js mínima (TV, panel, móvil) en modo de desarrollo**. Diseño de partida y decisiones en `partykit-casero/juegos/comodin-game.md`.
