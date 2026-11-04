'use client';
import { useState } from 'react';
import { send } from '@/lib/live';

export default function Home() {
  const [name, setName] = useState('Noche de juegos');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const create = async () => {
    try { const r = await send('/api/games', { name }); location.href = `/game/${r.room_code}/host`; } catch (e) { setErr((e as Error).message); }
  };
  return (
    <div className="felt" style={{ minHeight: '100dvh' }}><main className="mx-auto max-w-md p-4 space-y-6" style={{ paddingTop: 48 }}>
      <h1 className="glow" style={{ font: '900 44px var(--font-display)' }}>🃏 Comodín Game</h1>
      <p>Preguntas y retos por equipos: la tele muestra el juego y los móviles son los mandos.</p>
      <section className="panel space-y-3">
        <h2 className="font-bold">Soy el presentador</h2>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre de la partida" />
        <button className="btn" onClick={create}>Crear partida</button>
      </section>
      <section className="panel space-y-3">
        <h2 className="font-bold">Quiero jugar</h2>
        <input className="field uppercase" placeholder="Código" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label="Código de sala" />
        <button className="btn" disabled={code.length < 4} onClick={() => (location.href = `/game/${code}/play`)}>Entrar</button>
      </section>
      {err && <p role="alert" style={{ color: 'var(--coral)' }}>{err}</p>}
      <p className="text-sm opacity-70">Modo de desarrollo: datos solo en memoria, sin IA.</p>
    </main></div>
  );
}
