# Pendiente del propietario

Sin secretos aquí.

## Decisiones por confirmar
Las 11 de `DECISIONES.md` (marcadas «provisional»).

## Migraciones por aplicar
Ninguna (nada desplegado).

## Variables en Vercel
Ninguna todavía.

## No verificado
Las reglas SQL tienen 8 tests en PGlite (`npm test`). No probado en Postgres real ni Supabase, ni la concurrencia. La app (TV, panel, móvil) solo se ha probado con llamadas HTTP a `next start` y comprobando que las páginas devuelven 200; no se ha visto en un navegador ni con dos móviles reales.

## Siguiente
Adaptador de Supabase (`rpc` con `service_role`), Realtime (hoy sondeo cada 1,5 s), autenticación real del anfitrión (hoy cookie de desarrollo), pruebas e2e, capturas, tema Navidad, sonido, podio compartible.
Votación de retos por otros equipos y foto del reto (v2); preguntas de ordenar/respuesta corta; modo sin móviles (marcar a mano) en el panel.
Proyecto Next.js y módulos base de Subasta (`env`, `db`, `context`, `api`), rutas y pantallas.
