'use client';
import { use, useEffect, useState } from 'react';
import { send, useCountdown, useGame } from '@/lib/live';

export default function Play({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const key = `cg_token_${code}`;
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => { try { setToken(localStorage.getItem(key)); } catch {} setReady(true); }, [key]);
  const { state: s, error, refresh } = useGame(code, 'player', token);
  const left = useCountdown(s?.round?.status === 'open' ? s.round.closes_at : null, s?.server_time);
  const act = async (b: object) => { try { setMsg(''); await send(`/api/games/${code}/play`, b, token); await refresh(); } catch (e) { setMsg((e as Error).message); } };
  if (!ready) return null;
  if (error) return <p className="p-6">{error}</p>;
  if (!token || (s && !s.me?.player_id)) return (
    <main className="mx-auto max-w-sm p-4 space-y-3"><h1 className="text-2xl font-black">Unirse a {code}</h1>
      <input className="w-full" placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn w-full" onClick={async () => { try { const r = await send(`/api/games/${code}/join`, { name }); localStorage.setItem(key, r.token); setToken(r.token); } catch (e) { setMsg((e as Error).message); } }}>Entrar</button>
      {msg && <p role="alert" className="text-red-300">{msg}</p>}</main>);
  if (!s) return <p className="p-6">Cargando…</p>;
  const r = s.round; const myTeam = s.teams.find((t) => t.id === s.me?.team_id);
  const colors = ['#ef4444', '#3b82f6', '#16a34a', '#f59e0b'];
  const J: Record<string, string> = { fifty: '50 %', double: 'x2', pass: 'Pasar' };
  return (
    <main className="mx-auto max-w-sm p-4 space-y-4">
      {msg && <p role="alert" className="text-red-300">{msg}</p>}
      {s.game.status === 'lobby' && (!myTeam ? (<section className="space-y-2"><h1 className="text-xl font-bold">Elige tu equipo</h1>
        {s.teams.length === 0 && <p>Esperando a que el presentador cree equipos…</p>}
        {s.teams.map((t) => <button key={t.id} className="btn w-full" style={{ background: t.color }} onClick={() => act({ type: 'team', team_id: t.id })}>{t.name}</button>)}</section>)
        : <p className="text-xl">Estás en <b style={{ color: myTeam.color }}>{myTeam.name}</b>{s.me?.captain ? ' (capitán)' : ''}. Esperando a que empiece…</p>)}
      {s.game.status === 'active' && myTeam && (<>
        <p className="opacity-80">{myTeam.name} · {myTeam.score} pts{s.me?.captain ? ' · capitán' : ''}</p>
        {!r && <p className="text-xl">Atentos…</p>}
        {r?.kind === 'question' && r.options && (<section className="space-y-2">
          <h1 className="text-xl font-bold">{r.text}</h1>
          {r.status === 'open' && left !== null && <p className="text-3xl font-black">{left}</p>}
          {r.options.map((o, i) => (<button key={i} className="btn w-full text-left text-white" style={{ background: colors[i], color: '#fff' }}
            disabled={r.status !== 'open' || !!r.my_answer || r.hidden?.includes(i) || !s.me?.captain}
            onClick={() => act({ type: 'answer', choice: i, key: crypto.randomUUID() })}>{'ABCD'[i]} · {r.hidden?.includes(i) ? '—' : o}{r.my_answer?.choice === i ? ' ✓ enviada' : ''}</button>))}
          {r.my_answer?.passed && <p>Habéis pasado.</p>}
          {!s.me?.captain && <p className="text-sm opacity-70">Responde tu capitán.</p>}
          {r.status === 'open' && !r.my_answer && s.me?.captain && <div className="flex gap-2">{Object.entries(J).map(([k, l]) => (
            <button key={k} className="btn flex-1" disabled={!s.jokers?.[k] || (k === 'fifty' && r.options!.length < 4)} onClick={() => act({ type: 'joker', kind: k })}>🃏 {l}</button>))}</div>}
          {r.status === 'revealed' && (() => { const m = r.results?.find((x) => x.team_id === myTeam.id); return <p className="text-2xl font-black">{m && m.points > 0 ? `¡Correcto! +${m.points}` : 'Esta vez no.'}</p>; })()}
        </section>)}
        {r?.kind === 'challenge' && <p className="text-xl">Reto: {r.text}<br />{r.team_id === myTeam.id ? '¡Os toca a vosotros!' : 'Mirad cómo lo hacen.'}</p>}
      </>)}
      {s.game.status === 'finished' && <section><h1 className="text-2xl font-black">🏆 Fin</h1><ol>{s.teams.map((t, i) => <li key={t.id}>{i + 1}. {t.name} — {t.score}</li>)}</ol></section>}
    </main>
  );
}
