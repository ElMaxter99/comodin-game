# Pendiente del propietario

Sin secretos aquí.

## Decisiones por confirmar
Las de `DECISIONES.md` marcadas «provisional» (1–11).

## Para poder jugar con móviles reales (lo hace el propietario)
Seguir [INFRA.md](INFRA.md): crear el proyecto de Supabase, aplicar las migraciones, configurar Auth (URL de vuelta y SMTP), poner las variables en Vercel y desplegar. **No se ha hecho ni se hará sin tu permiso.**

## No verificado
- **Supabase real:** el adaptador, el enlace mágico y Realtime se han probado solo contra un servidor simulado y con PGlite; falta probarlos con un proyecto real (especialmente el protocolo WebSocket de Realtime y el correo).
- Las reglas SQL se prueban en PGlite (`npm test`); falta Postgres 16 real y la concurrencia.
- **Sonido:** sintetizado, no oído con altavoces reales (lista de comprobación abajo).
- Las pruebas e2e (`npm run e2e`) cubren el flujo completo en un solo navegador con varios contextos, no móviles ni TV reales.

## Prueba de sonido en altavoces reales (la haces tú)
1. Abre la TV, pulsa 🔇 para activar el sonido. 2. Una ronda completa: reparto, tic de las respuestas, pulso en los últimos 5 s, campanilla al confirmar, acierto o fallo, subida del marcador, fanfarria del podio. 3. ¿Volumen equilibrado y nada estridente? 4. Con `prefers-reduced-motion` no cambia el sonido. Apunta lo que cambiarías.

## Siguiente
Importación CSV, modo sin móviles, votación/foto de retos (v2), preguntas de ordenar/respuesta corta, escala y frases por tema en el sonido, Halloween y otros temas (copiar `temas/navidad.css` del diseño), IA para preguntas (opt-in, gratuita y revisada).
