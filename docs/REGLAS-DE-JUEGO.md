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

## Comodines
50 %, doble puntuación y pasar pregunta: uno de cada por equipo y partida.

## Modo sin móviles
El presentador marca a mano quién acierta.
