# 🃏 Comodín Game

Juego de fiesta para jugar en casa: **preguntas con cuatro respuestas y retos para equipos**. La TV muestra la ronda, los móviles son los mandos y un presentador (Game Master) lo dirige. Con **comodines** (50 %, doble puntuación, pasar) y **temas por estación** (Navidad, Halloween…) sobre un diseño base.

> **Estado: primera versión jugable en modo de desarrollo.** Reglas en SQL con tests en PGlite y app Next.js con TV, panel y móvil. Sin capturas ni despliegue; solo datos en memoria.

## Probarlo
```bash
npm install
npm test        # reglas SQL
npm run dev     # http://localhost:3000
```
1. En `/` crea una partida (eres el presentador) y abre «pantalla de la TV».
2. En el panel añade equipos, preguntas y retos y pulsa «Empezar».
3. Cada jugador entra desde el móvil con el código, elige equipo (el primero es capitán) y el capitán responde y usa comodines. Nada desplegado.

- Reglas y fases: [`docs/REGLAS-DE-JUEGO.md`](docs/REGLAS-DE-JUEGO.md)
- Arquitectura: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md)
- Decisiones: [`docs/DECISIONES.md`](docs/DECISIONES.md)
- Pendiente: [`docs/PENDIENTE.md`](docs/PENDIENTE.md)

Parte de [`partykit-casero`](https://github.com/ElMaxter99/partykit-casero) (workspace privado). Juego original; no usa formatos ni marcas de programas de TV.
