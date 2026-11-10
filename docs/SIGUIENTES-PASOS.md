# Siguientes pasos para desplegar y configurar (proyecto aparcado)

> **Estado: aparcado a propósito.** `main` tiene el juego completo en modo de desarrollo (reglas SQL, TV, panel, móvil, reglas extra, tema Navidad, adaptador de Supabase, login del presentador, Realtime y e2e). **No está desplegado ni probado contra Supabase real.** Este documento es la lista de lo que haría falta para sacarlo adelante; nada de esto se ha hecho. Detalle técnico en [`INFRA.md`](INFRA.md); lo pendiente general en [`PENDIENTE.md`](PENDIENTE.md).

Todo es gratuito y sin tarjeta (plan gratuito de Supabase y de Vercel). No actives servicios de pago.

## 1. Supabase (≈30 min)
1. Crear un proyecto nuevo en Supabase (propio de Comodín).
2. Aplicar **todas** las migraciones de `supabase/migrations/` en orden (SQL Editor o `supabase db push`), incluidas las `_security_` (RLS y permisos solo para `service_role`).
3. Anotar: URL del proyecto, clave `anon` (pública) y clave `service_role` (**secreta**: no pegarla en chats, repos ni logs).
4. Auth → Providers → Email: activado (enlace mágico).
5. Auth → URL Configuration: de momento `Site URL` = la URL de Vercel (paso 2) y añadir `https://TU-DOMINIO/auth/callback` a las URLs de redirección permitidas.
6. Auth → SMTP: configurar un SMTP propio gratuito antes de usarlo en serio (el correo de pruebas de Supabase tiene un límite muy bajo y solo envía a miembros del proyecto).
7. Realtime: nada que activar (Broadcast público); la app solo envía un aviso `tick` sin datos.

## 2. Vercel (≈15 min)
1. Importar `ElMaxter99/comodin-game` en Vercel (plan Hobby).
2. Variables de entorno (Production y Preview):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (solo servidor; **nunca** con prefijo `NEXT_PUBLIC_`)
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Desplegar y volver al paso 1.5 con la URL definitiva.

## 3. Primera prueba real (lo que aún no se ha verificado)
- [ ] Entrar como presentador: `/entrar` → llega el correo → el enlace vuelve a `/auth/callback` y abre sesión. *(Si el enlace no trae los tokens, revisar el flujo implícito en Supabase Auth; el código espera `#access_token` en la URL.)*
- [ ] Crear partida con tema y reglas extra; comprobar que `cg_set_options` guarda los ajustes.
- [ ] Dos móviles + TV: ronda completa con apuesta, comodines y revelación.
- [ ] **Realtime:** comprobar en el navegador que el WebSocket se conecta y que los cambios llegan sin esperar al sondeo (el cliente es propio, sin SDK; el protocolo no se ha probado contra Supabase real). Si falla, el sondeo de 1 s sigue funcionando.
- [ ] Respuestas de PostgREST: que los errores `ERR:codigo` lleguen como `message` y se traduzcan bien al español.
- [ ] Postgres 16 real y concurrencia (dos capitanes respondiendo a la vez): `PG_TEST_URL=… npx vitest run`.

## 4. Antes de jugar de verdad
- [ ] Prueba de sonido con altavoces reales (lista en `PENDIENTE.md`).
- [ ] Confirmar las decisiones «provisional» de `DECISIONES.md` (1–11).
- [ ] Revisar `docs/INFRA.md` por si Supabase cambió nombres de ajustes.

## 5. Ideas para más adelante (no urgentes)
Importación CSV de preguntas, modo sin móviles, votación o foto de retos, escala y frases por tema en el sonido, Halloween y otros temas (copiar `temas/navidad.css` del diseño en `partykit-casero`), IA para preguntas (opt-in, gratuita y revisada).

## Cómo retomarlo
1. Sigue los pasos 1–3.
2. Cualquier cambio visual o de flujo se diseña primero en `partykit-casero/juegos/comodin-game/design/`.
3. `npm test`, `npm run e2e` y `npm run build` antes de dar nada por terminado.
