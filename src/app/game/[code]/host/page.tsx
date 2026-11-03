'use client';
import { use, useState } from 'react';
import { send, useGame } from '@/lib/live';

const COLORS = ['#e63946', '#1b9e77', '#6c63ff', '#f08a24', '#ff4fd8', '#3d3a8f'];

export default function Host({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { state: s, error, refresh } = useGame(code, 'host');
  const [msg, setMsg] = useState('');
  const [team, setTeam] = useState('');
  const [text, setText] = useState('');
  const [opts, setOpts] = useState(['', '', '', '']);
  const [correct, setCorrect] = useState(0);
  const act = async (b: object) => { try { setMsg(''); await send(`/api/games/${code}/host`, b); await refresh(); } catch (e) { setMsg((e as Error).message); } };
  const wrap = (c: React.ReactNode) => <div className="felt" style={{ minHeight: '100dvh' }}><main style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>{c}</main></div>;
  if (error) return wrap(<p>{error} <a href="/" style={{ textDecoration: 'underline' }}>Volver</a></p>);
  if (!s) return wrap(<p>Cargando…</p>);
  const r = s.round;
  const nextItem = s.items?.[s.rounds_played + (r && r.phase === 'open' ? 1 : 0)];
  const guion = !r ? '«Bienvenidos… ¡que empiece el juego!»'
    : r.phase === 'open' ? (r.kind === 'question' ? '«Atentos… tenéis la mano. ¡Pensad bien!»' : '«Un reto… ¿serán capaces?»')
    : r.phase === 'suspense' ? '«Todos han jugado carta… ¿será esta?» (pausa)'
    : '«¡Y la respuesta correcta era…!»';
  return wrap(<>
    <h1 style={{ font: '900 26px var(--font-display)' }}>Panel · {s.game.name} · <span className="glow" style={{ letterSpacing: '.15em' }}>{code}</span></h1>
    <p style={{ margin: '8px 0 16px' }}><a href={`/game/${code}/screen`} target="_blank" style={{ textDecoration: 'underline' }}>Abrir pantalla de la TV</a> · estado: {s.game.status}</p>
    {msg && <p role="alert" style={{ color: 'var(--coral)', marginBottom: 12 }}>{msg}</p>}
    {s.game.status === 'lobby' && (<div style={{ display: 'grid', gap: 14 }}>
      <section className="panel" style={{ display: 'grid', gap: 10 }}><h2 style={{ fontWeight: 800 }}>Equipos ({s.teams.length})</h2>
        <ul>{s.teams.map((t) => <li key={t.id} style={{ color: t.color, fontWeight: 700 }}>● {t.name} ({t.members})</li>)}</ul>
        <div style={{ display: 'flex', gap: 8 }}><input className="field" placeholder="Nombre del equipo" value={team} onChange={(e) => setTeam(e.target.value)} />
          <button className="btn" style={{ width: 'auto', padding: '0 22px' }} onClick={async () => { await act({ type: 'team', name: team, color: COLORS[s.teams.length % COLORS.length] }); setTeam(''); }}>Añadir</button></div></section>
      <section className="panel" style={{ display: 'grid', gap: 10 }}><h2 style={{ fontWeight: 800 }}>Preguntas y retos ({s.items?.length ?? 0})</h2>
        <ol style={{ paddingLeft: 20 }}>{s.items?.map((i) => <li key={i.id}>{i.kind === 'challenge' ? '🎭 ' : ''}{i.text}</li>)}</ol>
        <input className="field" placeholder="Enunciado" value={text} onChange={(e) => setText(e.target.value)} />
        {opts.map((o, i) => (<div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="radio" name="c" checked={correct === i} onChange={() => setCorrect(i)} aria-label={`Correcta ${'ABCD'[i]}`} />
          <input className="field" placeholder={`Opción ${'ABCD'[i]}`} value={o} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))} /></div>))}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={async () => { await act({ type: 'question', text, options: opts, correct }); setText(''); setOpts(['', '', '', '']); }}>Añadir pregunta</button>
          <button className="btn ghost" onClick={async () => { await act({ type: 'challenge', text }); setText(''); }}>Añadir reto</button></div></section>
      <button className="btn" onClick={() => act({ type: 'start' })}>Empezar partida</button>
      <p style={{ fontSize: 14, color: 'var(--ink-dim)' }}>Los jugadores entran con el código {code} y eligen equipo; el primero de cada equipo es el capitán.</p>
    </div>)}
    {s.game.status === 'active' && (<section className="panel" style={{ display: 'grid', gap: 12 }}>
      {r && <><span className="tag" style={{ justifySelf: 'start' }}>Ronda {r.seq} · {r.kind === 'question' ? 'Pregunta' : 'Reto'}</span>
        <p style={{ font: '800 24px var(--font-display)' }}>{r.text}</p>
        {r.kind === 'question' && r.options && s.items && <p style={{ color: 'var(--lime)' }}>Correcta: {'ABCD'[s.items.find((i) => i.text === r.text)?.correct ?? 0]} · {r.options[s.items.find((i) => i.text === r.text)?.correct ?? 0]}</p>}
        {r.phase === 'open' && r.kind === 'question' && <p style={{ color: 'var(--ink-dim)' }}>{r.answered} de {r.active_teams} equipos han confirmado</p>}
        {r.phase === 'suspense' && <p style={{ color: 'var(--amber)' }}>{r.hold ? 'En pausa dramática: la TV espera a que pulses «Revelar».' : 'Suspense en la TV…'}</p>}</>}
      <p style={{ color: 'var(--ink-dim)', fontSize: 15 }}>Guion: {guion}</p>
      {r?.phase === 'open' && r.kind === 'question' && <button className="btn" onClick={() => act({ type: 'close' })}>Cerrar ya</button>}
      {r?.phase === 'open' && r.kind === 'challenge' && <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn" onClick={() => act({ type: 'validate', success: true })}>✔ Lo han conseguido</button>
        <button className="btn ghost" onClick={() => act({ type: 'validate', success: false })}>✘ No</button></div>}
      {r?.phase === 'suspense' && r.hold && <button className="btn" onClick={() => act({ type: 'reveal' })}>Revelar</button>}
      {(!r || r.phase !== 'open') && <button className="btn" disabled={s.rounds_played >= s.items_total} onClick={() => act({ type: 'open' })}>Lanzar siguiente ({s.rounds_played}/{s.items_total}){nextItem ? ` · ${nextItem.kind === 'challenge' ? 'reto' : 'pregunta'}` : ''}</button>}
      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={!!s.dramatic_pause} onChange={(e) => act({ type: 'pause', on: e.target.checked })} /> Pausa dramática (yo decido cuándo revelar)</label>
      <button style={{ textDecoration: 'underline', justifySelf: 'start' }} onClick={() => act({ type: 'finish' })}>Terminar y ver podio</button>
    </section>)}
    <section className="panel" style={{ marginTop: 14 }}><h2 style={{ fontWeight: 800 }}>Marcador</h2><ol>{s.teams.map((t) => <li key={t.id} style={{ color: t.color, fontWeight: 700 }}>{t.name}: {t.score}</li>)}</ol></section>
  </>);
}
