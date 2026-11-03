# Comodín Game · flujos completos

Complementa a [`DESIGN.md`](DESIGN.md). Cada flujo indica qué ve cada rol y qué función SQL decide.

## 1. Partida de principio a fin
```mermaid
flowchart TD
    A[Presentador crea partida] --> B[Añade equipos, preguntas y retos]
    B --> C[TV: sala con código y QR]
    C --> D[Jugadores entran con el móvil y eligen equipo\nel primero de cada equipo es capitán]
    D --> E{¿≥1 equipo y ≥1 ítem?}
    E -- no --> B
    E -- sí --> F[Presentador: Empezar]
    F --> G[Ronda]
    G --> H{¿Quedan ítems\ny quiere seguir?}
    H -- sí --> G
    H -- no --> I[Terminar: podio]
```

## 2. Una ronda de pregunta (secuencia)
```mermaid
sequenceDiagram
    participant H as Presentador
    participant S as SQL cg_*
    participant T as TV
    participant M as Móvil capitán
    H->>S: cg_open_round
    S-->>T: ronda abierta (sin correcta)
    T->>T: presentación → pregunta → 4 respuestas
    S-->>M: pulsadores activos
    M->>M: elegir B
    M->>S: cg_answer (tras Confirmar, idempotente)
    S-->>T: «2 de 3 confirmados» (sin decir qué)
    alt todos confirmaron
        S->>S: cg_close_round_core(all)
    else tiempo agotado
        T->>S: cg_close_round(by: time)
    else presentador
        H->>S: cg_close_round(host)
    end
    S-->>T: ronda revelada (correcta + resultados)
    T->>T: suspense 3 s (o hasta «Revelar») → revelación
    S-->>M: ¡Correcto! +N / Esta vez no
```

## 3. Comodines
```mermaid
flowchart TD
    A[Capitán toca un comodín] --> B[Hoja de confirmación]
    B -- Cancelar --> Z[Vuelve a la pregunta]
    B -- Usar --> C{¿Ya usado\no ya hay uno esta ronda?}
    C -- sí --> E[Error: comodín usado]
    C -- no --> D{Tipo}
    D -- Tachar dos --> F[SQL oculta 2 incorrectas\nsolo para ese equipo]
    D -- Doble --> G[SQL marca ×2 si acierta]
    D -- Pasar --> H[Cuenta como respondida\nsin puntos]
```

## 4. Reto
```mermaid
flowchart TD
    A[Presentador lanza reto] --> B[SQL asigna al equipo con menos puntos]
    B --> C[TV: texto del reto y equipo; móvil avisa]
    C --> D{Presentador decide}
    D -- Lo han conseguido --> E[+puntos al equipo]
    D -- No --> F[Sin puntos]
    E --> G[Ronda revelada]
    F --> G
```

## 5. Estados de la partida y de la ronda
```mermaid
stateDiagram-v2
    [*] --> lobby
    lobby --> active: cg_start_game
    state active {
        [*] --> sin_ronda
        sin_ronda --> abierta: cg_open_round
        abierta --> revelada: cierre único cg_close_round_core
        revelada --> abierta: cg_open_round
    }
    active --> finished: cg_finish_game
    finished --> [*]
```

## 6. Casos límite
| Caso | Qué pasa |
|---|---|
| Un jugador no capitán intenta responder | Error «Responde el capitán» (si el capitán está conectado) |
| El capitán se desconecta | Cualquier miembro puede responder; la primera respuesta gana (única por equipo) |
| Respuesta doble / reintento de red | Única por equipo y ronda; la clave de idempotencia devuelve lo mismo |
| Responde tras agotarse el tiempo | Rechazado por el servidor (`round_closed`); el reloj del móvil no cuenta |
| TV cerrada a mitad | Al reabrirla recupera el estado con la instantánea; el temporizador se recalcula con `server_time` |
| Se pierde la conexión del móvil | Reintento con la misma clave; la UI muestra «Reconectando…» |
| Empate en el podio | Comparten puesto |
