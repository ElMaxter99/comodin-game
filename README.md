# 🃏 Comodín Game

Juego de fiesta para jugar en casa: **preguntas con cuatro respuestas y retos para equipos**. La **TV** muestra la ronda como una mesa de cartas, los **móviles** son la mano de cada equipo y un **presentador** (Game Master) lo dirige desde su panel. Con **comodines** (tachar dos, doble y pasar) **reglas extra opcionales** (puntos crecientes, mano segura, apuesta) y **temas por estación** (Base y Navidad; Halloween después) sobre el estilo «Baraja». Juego original: no usa formatos ni marcas de programas de TV.

> **Estado: jugable en modo de desarrollo y lista para Supabase.** Reglas en SQL con tests, app Next.js con TV, panel y móvil, adaptador de Supabase (Postgres, enlace mágico del presentador y Realtime) y pruebas e2e. **No desplegado ni probado contra Supabase real** (ver [`docs/INFRA.md`](docs/INFRA.md)). Sin IA. Lo no verificado está al final.

<p align="center">
  <img src="docs/img/13-tv-revelacion.png" alt="TV: la carta correcta se da la vuelta" width="62%">
  <img src="docs/img/11-movil-confirmar.png" alt="Móvil del capitán: elegir y confirmar" width="17%">
</p>

> **Diseño primero:** el «figma» de Comodín (estilo «Baraja», maquetas y flujos) vive en el workspace privado: [`partykit-casero/juegos/comodin-game/design/`](https://github.com/ElMaxter99/partykit-casero/tree/main/juegos/comodin-game/design/DESIGN.md). Aquí solo está el código; `src/app/globals.css` porta sus tokens y componentes.

## Cómo se juega

1. El presentador crea la partida, añade **equipos** y **preguntas/retos** y abre la pantalla de la TV.
2. Cada jugador entra con el **código** (o el QR) desde su móvil y elige equipo. **El primero de cada equipo es el capitán**: es quien responde y usa comodines.
3. El presentador lanza rondas. En una **pregunta** responden los equipos; en un **reto** un equipo lo hace y el presentador decide si lo ha conseguido.
4. Al final de la partida, podio.

### Ritmo de una pregunta
Reparto de la ronda (4 s) → carta de pregunta → las cuatro respuestas llegan boca abajo y se giran → cuenta atrás de 20 s (10 fichas que se apagan) → el capitán **elige y confirma** → luces bajas (3 s de suspense) → la carta correcta se da la vuelta. Con la **pausa dramática** activada, el presentador decide cuándo revelar. Durante el suspense la TV no muestra ni la respuesta ni el marcador nuevo: lo oculta el servidor.

### Pregunta
- Opciones A–D (o verdadero/falso). Cuenta atrás de 20 s por defecto.
- Acierto = puntos de la pregunta. Con **comodín doble**, ×2. Con **rapidez** activada (opcional, apagada por defecto), un extra de hasta el 50 % según el tiempo que sobre.
- La ronda se cierra cuando **todos los equipos activos han respondido**, cuando se acaba el tiempo o cuando el presentador pulsa «Cerrar ya». Las tres vías pasan por la misma función SQL.
- La **respuesta correcta no sale del servidor** hasta que la ronda se cierra, ni siquiera en la API.

### Reglas extra (opcionales; se activan al crear la partida)
- **Puntos crecientes:** cada ronda vale más (`base + (n−1)·100`).
- **Mano segura:** cada 4 rondas cada equipo «guarda» su marcador.
- **Apuesta:** una vez por equipo, antes de responder: acierto ×2, fallo −puntos (sin bajar de la mano segura). No se combina con Doble ni Pasar.
- **Tema Navidad:** bosque, estrella dorada, bombillas, dorso rojo acebo y nieve suave; misma estructura.

### Comodines (uno de cada por equipo y partida, solo uno por ronda)
| Comodín | Efecto |
|---|---|
| ★ Tachar dos | Oculta dos respuestas incorrectas (solo en preguntas de cuatro opciones) |
| ★ Doble | Duplica los puntos si aciertan |
| ★ Pasar | No puntúa y cuenta como respondida |

### Reto
Se asigna al equipo con menos puntos. El presentador pulsa «Lo han conseguido» (suma los puntos) o «No».

## Flujo de una partida

```mermaid
stateDiagram-v2
    [*] --> lobby: Crear partida
    lobby --> active: Empezar (≥1 equipo y ≥1 ítem)
    active --> ronda_abierta: Lanzar siguiente
    ronda_abierta --> revelada: Cerrar (presentador · tiempo · todos han respondido)
    revelada --> ronda_abierta: Lanzar siguiente
    revelada --> finished: Terminar / sin más ítems
    ronda_abierta --> finished: Terminar
    finished --> [*]
```

## Quién hace qué en cada fase

| Fase | TV | Móvil | Presentador |
|---|---|---|---|
| Sala | Código, QR y equipos | Nombre y elegir equipo | Equipos, preguntas y retos; «Empezar» |
| Pregunta | Enunciado, opciones y cuenta atrás | Opciones y comodines (capitán) | «Cerrar ya» |
| Reto | Texto y equipo que lo hace | Aviso al equipo | «Lo han conseguido» / «No» |
| Resultado | Respuesta correcta y qué equipo eligió cada una | «¡Correcto! +N» | «Lanzar siguiente» |
| Final | Podio | Resultados | — |

## Arquitectura

```mermaid
flowchart LR
    TV[TV · /game/CODE/screen] -- Realtime + sondeo --> API
    HOST[Panel · /game/CODE/host] --> API
    MOV[Móvil · /game/CODE/play] --> API
    API[Rutas /api<br/>Zod · cookie/token · mismo origen] -- rpc cg_* --> SQL[(SQL cg_*<br/>PGlite en desarrollo · Supabase en producción)]
    SQL -- instantánea filtrada --> API
```

Toda la lógica de decisión (puntos, quién puede responder, cierre, secretos) está en funciones SQL `cg_*` con bloqueo por partida e idempotencia; TypeScript solo valida, autentica y presenta. Detalle en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) y [`docs/REGLAS-DE-JUEGO.md`](docs/REGLAS-DE-JUEGO.md). Es parte de [`partykit-casero`](https://github.com/ElMaxter99/partykit-casero).

## Galería

| Inicio | Panel (sala) | TV (sala) |
|---|---|---|
| <img src="docs/img/01-inicio.png" width="260"> | <img src="docs/img/02-panel-sala.png" width="260"> | <img src="docs/img/03-tv-sala.png" width="260"> |

| TV: reparto | TV: pregunta | TV: suspense |
|---|---|---|
| <img src="docs/img/07-tv-reparto.png" width="260"> | <img src="docs/img/08-tv-pregunta.png" width="260"> | <img src="docs/img/12-tv-suspenso.png" width="260"> |

| TV: revelación | TV: marcador | TV: reto |
|---|---|---|
| <img src="docs/img/13-tv-revelacion.png" width="260"> | <img src="docs/img/15-tv-marcador.png" width="260"> | <img src="docs/img/17-tv-reto.png" width="260"> |

| Móvil: unirse | Móvil: equipo | Móvil: espera |
|---|---|---|
| <img src="docs/img/04-movil-unirse.png" width="120"> | <img src="docs/img/05-movil-equipo.png" width="120"> | <img src="docs/img/06-movil-espera.png" width="120"> |

| Móvil: pregunta | Móvil: comodín | Móvil: confirmar | Móvil: acierto | Móvil: final |
|---|---|---|---|---|
| <img src="docs/img/09-movil-pregunta.png" width="110"> | <img src="docs/img/10-movil-comodin.png" width="110"> | <img src="docs/img/11-movil-confirmar.png" width="110"> | <img src="docs/img/14-movil-acierto.png" width="110"> | <img src="docs/img/20-movil-final.png" width="110"> |

| Inicio con tema y reglas extra | TV Navidad: pregunta | Móvil: apuesta |
|---|---|---|
| <img src="docs/img/21-inicio-navidad.png" width="120"> | <img src="docs/img/22-tv-navidad-pregunta.png" width="260"> | <img src="docs/img/23-movil-apuesta.png" width="110"> |

| TV Navidad: revelación (♥ = apuesta) | TV Navidad: marcador con mano segura |
|---|---|
| <img src="docs/img/24-tv-navidad-revelacion.png" width="300"> | <img src="docs/img/25-tv-navidad-marcador.png" width="300"> |

| Panel: ronda | Panel: reto | TV: podio |
|---|---|---|
| <img src="docs/img/16-panel-ronda.png" width="260"> | <img src="docs/img/18-panel-reto.png" width="260"> | <img src="docs/img/19-tv-podio.png" width="260"> |

## Probarlo

```bash
npm install
npm test               # 25 tests: reglas SQL (PGlite) y adaptador de Supabase (servidor simulado)
npm run e2e            # Playwright: partida completa con TV, panel y dos móviles (construye la app; PW_CHROMIUM_PATH si hace falta)
npm run typecheck
npm run dev            # http://localhost:3000 (datos en memoria)
npm run build && npm run docs:screenshots   # regenera docs/img/
```
Requiere Node ≥ 20. Para jugar con varios móviles, abre `http://IP-de-tu-ordenador:3000` en la red local.

## Qué no está verificado ni hecho todavía

- **Supabase real:** el adaptador, el enlace mágico y Realtime solo se han probado contra un servidor simulado; las reglas, con PGlite (no Postgres 16 real ni concurrencia).
- Sonido sintetizado con WebAudio **no oído con altavoces reales** (hay una lista de comprobación en `docs/PENDIENTE.md`).
- e2e: un solo navegador con varios contextos; sin móviles ni TV reales. Sin podio descargable.
- Retos: solo los valida el presentador (votación y foto, en una versión futura). Sin modo sin móviles ni importación CSV.
- Nada desplegado. Lista completa en [`docs/PENDIENTE.md`](docs/PENDIENTE.md); decisiones en [`docs/DECISIONES.md`](docs/DECISIONES.md).

## Privacidad y almacenamiento local
Los jugadores no tienen cuenta: su token se guarda en `localStorage` del móvil (`cg_token_CODIGO`) y en el servidor solo su hash. El presentador usa la cookie `cg_host` en desarrollo y, con Supabase, las cookies `httpOnly` `cg_at` y `cg_rt` de la sesión; no hay analítica ni cookies de terceros. Servicios externos solo si se despliega: Supabase (base de datos, Auth, Realtime) y Vercel.
