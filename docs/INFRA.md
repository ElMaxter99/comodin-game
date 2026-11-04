# Infraestructura: Supabase y Vercel (sin desplegar todavía)

> **No está desplegado ni probado contra Supabase real.** El adaptador se ha probado contra un servidor simulado (`tests/supabase-adapter.test.ts`). Despliega solo con permiso del propietario; todo es gratuito (sin tarjeta).

## Cómo elige el backend la app
`src/lib/server/db.ts`: si existen `SUPABASE_URL` (o `NEXT_PUBLIC_SUPABASE_URL`) **y** `SUPABASE_SERVICE_ROLE_KEY`, las funciones `cg_*` se llaman por la API REST de Supabase (`POST /rest/v1/rpc/cg_…` con `{ "p": … }`). Si no, y fuera de Vercel, se usa PGlite (desarrollo). En Vercel sin Supabase la app avisa de que falta configurar. Es el mismo SQL en los dos casos.

## Variables de entorno
| Variable | Dónde | Para qué |
|---|---|---|
| `SUPABASE_URL` (o `NEXT_PUBLIC_SUPABASE_URL`) | servidor | URL del proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | **solo servidor** (nunca `NEXT_PUBLIC_`) | llamar a `cg_*` y emitir Broadcast |
| `NEXT_PUBLIC_SUPABASE_URL` | navegador | Realtime |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | navegador y servidor | Realtime (clave pública) y Supabase Auth (enlace mágico) |

## Pasos (los hace el propietario)
1. Crear un proyecto de Supabase (plan gratuito, propio de Comodín; prefijo `cg_`).
2. Aplicar **todas** las migraciones de `supabase/migrations/` en orden, incluidas las `_security_` (activan RLS y quitan permisos a `anon`/`authenticated`; solo `service_role` ejecuta `cg_*`).
3. Auth → URL Configuration: añadir `https://TU-DOMINIO/auth/callback` a las URLs de redirección permitidas. Auth → Providers → Email activado (enlace mágico). Para producción, configurar un SMTP propio (el de pruebas de Supabase tiene límites muy bajos).
4. Realtime: sirve el Broadcast público por defecto; la app solo envía un aviso `tick` sin datos (nunca la respuesta correcta ni puntos).
5. Poner las variables en Vercel y desplegar.

## Acceso del presentador
Enlace mágico por correo (`/entrar` → `/auth/callback`). Los tokens se guardan en cookies `httpOnly` (`cg_at`, `cg_rt`) y el servidor verifica cada petición con Supabase Auth; el id del usuario es el `host_id` de la partida. Los jugadores no necesitan cuenta: su token vive en `localStorage` del móvil y en la BD solo se guarda su hash. En desarrollo no hay correo: cookie `cg_host`.

## Sincronización
Tras cada cambio el servidor emite `game:CODIGO` / `tick`; TV, panel y móviles se suscriben por WebSocket y vuelven a pedir la instantánea. El sondeo sigue de respaldo (1 s sin Realtime, 5 s con él).
