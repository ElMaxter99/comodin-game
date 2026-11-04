'use client';
import { useEffect, useState } from 'react';
import { send, useTheme } from '@/lib/live';

export default function Home() {
  const [name, setName] = useState('Noche de juegos');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [theme, setTheme] = useState<'base' | 'navidad'>('base');
  const [growing, setGrowing] = useState(false);
  const [safe, setSafe] = useState(false);
  const [bets, setBets] = useState(false);
  useTheme(theme);
  const [auth, setAuth] = useState<{ mode: string; host: boolean } | null>(null);
  useEffect(() => { fetch('/api/auth/me').then((r) => r.json()).then(setAuth).catch(() => setAuth({ mode: 'dev', host: true })); }, []);
  const create = async () => {
    try { const r = await send('/api/games', { name, theme, growing_step: growing ? 100 : 0, safe_every: safe ? 4 : 0, bets_enabled: bets }); location.href = `/game/${r.room_code}/host`; } catch (e) { setErr((e as Error).message); }
  };
  return (
    <div className="felt" style={{ minHeight: '100dvh' }}><main className="mx-auto max-w-md p-4 space-y-6" style={{ paddingTop: 48 }}>
      <h1 className="glow" style={{ font: '900 44px var(--font-display)' }}>🃏 Comodín Game</h1>
      <p>Preguntas y retos por equipos: la tele muestra el juego y los móviles son los mandos.</p>
      <section className="panel space-y-3">
        <h2 className="font-bold">Soy el presentador</h2>
        {auth && !auth.host ? (<><p>Entra con tu correo (sin contraseña) para crear y dirigir partidas.</p><a className="btn" href="/entrar">Entrar como presentador</a></>) : (<>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre de la partida" />
        <p style={{ font: '800 14px var(--font-display)', color: 'var(--ink-dim)' }}>TEMA</p>
        <div style={{ display: 'flex', gap: 10 }} role="radiogroup" aria-label="Tema">
          {([['base', 'Base', '♠'], ['navidad', 'Navidad', '✶']] as const).map(([k, l, ic]) => (
            <button key={k} role="radio" aria-checked={theme === k} className={`pcard ${k === 'base' ? 'b' : 'a'} ${theme === k ? 'locked' : ''}`} style={{ margin: 0, minHeight: 56, fontSize: 17 }} onClick={() => setTheme(k)}><b>{ic}</b>{l}</button>))}
        </div>
        <p style={{ font: '800 14px var(--font-display)', color: 'var(--ink-dim)' }}>REGLAS EXTRA (opcionales)</p>
        {([[growing, setGrowing, 'c', '↗', 'Puntos crecientes · +100 por ronda'], [safe, setSafe, 'd', '▣', 'Mano segura · cada 4 rondas'], [bets, setBets, 'a', '♥', 'Apuesta · una vez por equipo']] as const).map(([on, set, k, ic, label]) => (
          <button key={label} role="checkbox" aria-checked={on} className={`pcard ${k} ${on ? 'locked' : ''}`} style={{ margin: 0, minHeight: 56, fontSize: 16 }} onClick={() => set(!on)}><b>{ic}</b>{label}</button>))}
        <button className="btn" onClick={create}>Crear partida</button></>)}
      </section>
      <section className="panel space-y-3">
        <h2 className="font-bold">Quiero jugar</h2>
        <input className="field uppercase" placeholder="Código" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label="Código de sala" />
        <button className="btn" disabled={code.length < 4} onClick={() => (location.href = `/game/${code}/play`)}>Entrar</button>
      </section>
      {err && <p role="alert" style={{ color: 'var(--coral)' }}>{err}</p>}
      {auth?.mode !== 'supabase' && <p className="text-sm opacity-70">Modo de desarrollo: datos solo en este equipo, sin IA.</p>}
    </main></div>
  );
}
