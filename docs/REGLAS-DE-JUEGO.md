# Reglas de juego (provisionales hasta confirmar las decisiones)

Un presentador lanza **rondas** (pregunta o reto) a **equipos**. Cada persona juega desde su móvil dentro de un equipo; la respuesta del equipo es la del capitán (o la primera si no hay capitán). Se permiten equipos de una persona.

## Bucle de una ronda
`intro → question | challenge → reveal → scoreboard`, y tras la última ronda `finished` (podio). Cierre por tiempo, porque han respondido todos los equipos activos, o a mano: las tres vías llaman al mismo núcleo `cg_close_round`.

## Fase × pantalla
| Fase | TV | Móvil | Game Master |
|---|---|---|---|
| `lobby` | Código + QR + equipos | Elegir/crear equipo | Ajustes, «Empezar» |
| `intro` | Tipo de ronda | «Atentos» | «Lanzar» |
| `question` | Enunciado y opciones A–D (o V/F) | Botones de color; comodines | Cuántos han respondido; «Cerrar ya» |
| `challenge` | Texto del reto, cuenta atrás | «¡Hecho!» del equipo; voto de los demás (si está activo) | Validar o abrir votación |
| `reveal` | Opción correcta y reparto | «¡Correcto! +N» | «Siguiente» |
| `scoreboard` | Marcador por equipos | Posición | «Siguiente ronda» |
| `finished` | Podio | Resultados | Finalizar / reiniciar |

## Secretos
La opción correcta hasta `reveal` (se vacía en SQL), la respuesta de cada equipo durante la ronda y el comodín jugado hasta el cierre.

## Puntuación (enteros)
Acierto = puntos base (× rapidez si está activa, apagada por defecto) (× 2 con comodín doble). Reto = puntos fijos al validarse. Empates comparten puesto.

## Reglas extra (opcionales, apagadas por defecto)
- **Puntos crecientes:** la ronda `n` vale `base + (n−1)·paso` (también los retos).
- **Mano segura:** cada `N` rondas cada equipo guarda su marcador; una apuesta perdida no baja de ahí.
- **Apuesta:** una vez por equipo y partida, antes de responder, solo en preguntas: acierto ×2; fallo o sin responder −puntos de la ronda (suelo: mano segura o 0). No se combina con Doble ni Pasar en la misma ronda. La apuesta no se ve en la TV hasta la revelación.

## Comodines
50 %, doble puntuación y pasar pregunta: uno de cada por equipo y partida.

## Modo sin móviles
El presentador marca a mano quién acierta.
