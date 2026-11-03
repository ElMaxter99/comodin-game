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
    <main className="mx-auto max-w-md p-4 space-y-6">
      <h1 className="text-4xl font-black">🃏 Comodín Game</h1>
      <p>Preguntas y retos por equipos: la tele muestra el juego y los móviles son los mandos.</p>
      <section className="card space-y-3">
        <h2 className="font-bold">Soy el presentador</h2>
        <input className="w-full" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre de la partida" />
        <button className="btn w-full" onClick={create}>Crear partida</button>
      </section>
      <section className="card space-y-3">
        <h2 className="font-bold">Quiero jugar</h2>
        <input className="w-full uppercase" placeholder="Código" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label="Código de sala" />
        <button className="btn w-full" disabled={code.length < 4} onClick={() => (location.href = `/game/${code}/play`)}>Entrar</button>
      </section>
      {err && <p role="alert" className="text-red-300">{err}</p>}
      <p className="text-sm opacity-70">Modo de desarrollo: datos solo en memoria, sin IA.</p>
    </main>
  );
}
