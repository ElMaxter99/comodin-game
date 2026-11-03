'use client';
import { use, useState } from 'react';
import { send, useGame } from '@/lib/live';

export default function Host({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { state: s, error, refresh } = useGame(code, 'host');
  const [msg, setMsg] = useState('');
  const [team, setTeam] = useState('');
  const [text, setText] = useState('');
  const [opts, setOpts] = useState(['', '', '', '']);
  const [correct, setCorrect] = useState(0);
  const act = async (b: object) => { try { setMsg(''); await send(`/api/games/${code}/host`, b); await refresh(); } catch (e) { setMsg((e as Error).message); } };
  if (error) return <p className="p-6">{error} <a className="underline" href="/">Volver</a></p>;
  if (!s) return <p className="p-6">Cargando…</p>;
  const r = s.round;
  return (
    <main className="mx-auto max-w-2xl p-4 space-y-4">
      <h1 className="text-2xl font-black">Panel · {s.game.name} · <span className="tracking-widest">{code}</span></h1>
      <p><a className="underline" href={`/game/${code}/screen`} target="_blank">Abrir pantalla de la TV</a> · estado: {s.game.status}</p>
      {msg && <p role="alert" className="text-red-300">{msg}</p>}
      {s.game.status === 'lobby' && (<>
        <section className="card space-y-2"><h2 className="font-bold">Equipos ({s.teams.length})</h2>
          <ul>{s.teams.map((t) => <li key={t.id} style={{ color: t.color }}>● {t.name} ({t.members})</li>)}</ul>
          <div className="flex gap-2"><input className="flex-1" placeholder="Nombre del equipo" value={team} onChange={(e) => setTeam(e.target.value)} />
            <button className="btn" onClick={async () => { await act({ type: 'team', name: team, color: ['#f87171', '#60a5fa', '#34d399', '#fbbf24'][s.teams.length % 4] }); setTeam(''); }}>Añadir</button></div></section>
        <section className="card space-y-2"><h2 className="font-bold">Preguntas y retos ({s.items?.length ?? 0})</h2>
          <ol className="list-decimal pl-5">{s.items?.map((i) => <li key={i.id}>{i.kind === 'challenge' ? '🎭 ' : ''}{i.text}</li>)}</ol>
          <input className="w-full" placeholder="Enunciado" value={text} onChange={(e) => setText(e.target.value)} />
          {opts.map((o, i) => (<div key={i} className="flex items-center gap-2"><input type="radio" name="c" checked={correct === i} onChange={() => setCorrect(i)} aria-label={`Correcta ${'ABCD'[i]}`} />
            <input className="flex-1" placeholder={`Opción ${'ABCD'[i]}`} value={o} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))} /></div>))}
          <div className="flex gap-2">
            <button className="btn" onClick={async () => { await act({ type: 'question', text, options: opts, correct }); setText(''); setOpts(['', '', '', '']); }}>Añadir pregunta</button>
            <button className="btn" onClick={async () => { await act({ type: 'challenge', text }); setText(''); }}>Añadir reto</button></div></section>
        <button className="btn w-full" onClick={() => act({ type: 'start' })}>Empezar partida</button>
        <p className="text-sm opacity-70">Los jugadores entran con el código {code} y eligen equipo; el primero de cada equipo es el capitán.</p>
      </>)}
      {s.game.status === 'active' && (
        <section className="card space-y-3">
          {r && <><p className="font-bold">{r.kind === 'question' ? 'Pregunta' : 'Reto'} {r.seq}: {r.text}</p>
            {r.status === 'open' && r.kind === 'question' && <p>{r.answered}/{r.active_teams} equipos han respondido</p>}</>}
          {r?.status === 'open' && r.kind === 'question' && <button className="btn w-full" onClick={() => act({ type: 'close' })}>Cerrar ya</button>}
          {r?.status === 'open' && r.kind === 'challenge' && <div className="flex gap-2">
            <button className="btn flex-1" onClick={() => act({ type: 'validate', success: true })}>✔ Lo han conseguido</button>
            <button className="btn flex-1" onClick={() => act({ type: 'validate', success: false })}>✘ No</button></div>}
          {(!r || r.status === 'revealed') && <button className="btn w-full" disabled={s.rounds_played >= s.items_total} onClick={() => act({ type: 'open' })}>Lanzar siguiente ({s.rounds_played}/{s.items_total})</button>}
          <button className="underline" onClick={() => act({ type: 'finish' })}>Terminar y ver podio</button>
        </section>)}
      <section className="card"><h2 className="font-bold">Marcador</h2><ol>{s.teams.map((t) => <li key={t.id} style={{ color: t.color }}>{t.name}: {t.score}</li>)}</ol></section>
    </main>
  );
}
