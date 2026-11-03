'use client';
import { use, useEffect, useState } from 'react';
import { send, useGame, useServerNow } from '@/lib/live';

const SUIT = ['♥', '♠', '♦', '♣'];
const JOKERS: Record<string, { label: string; text: string }> = {
  fifty: { label: 'Tachar dos', text: 'Se ocultan dos respuestas incorrectas. Un uso por partida y uno por ronda.' },
  double: { label: 'Doble', text: 'Si acertáis, los puntos de esta ronda valen el doble.' },
  pass: { label: 'Pasar', text: 'No puntuáis esta ronda, pero no os quedáis sin responder.' },
};

export default function Play({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const key = `cg_token_${code}`;
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [pick, setPick] = useState<number | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  useEffect(() => { try { setToken(localStorage.getItem(key)); } catch {} setReady(true); }, [key]);
  const { state: s, error, refresh } = useGame(code, 'player', token);
  const now = useServerNow(s);
  const r = s?.round;
  useEffect(() => { setPick(null); setSheet(null); }, [r?.id]);
  const act = async (b: object) => { try { setMsg(''); await send(`/api/games/${code}/play`, b, token); await refresh(); return true; } catch (e) { setMsg((e as Error).message); return false; } };
  if (!ready) return null;
  const wrap = (c: React.ReactNode) => <div className="felt phone">{c}</div>;
  if (error) return wrap(<p>{error}</p>);
  if (!token || (s && !s.me?.player_id)) return wrap(
    <main className="space-y-3" style={{ paddingTop: 40 }}><h1 className="glow" style={{ font: '900 30px var(--font-display)' }}>Unirse a {code}</h1>
      <input className="field" placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} aria-label="Tu nombre" />
      <button className="btn" disabled={!name.trim()} onClick={async () => { try { const j = await send(`/api/games/${code}/join`, { name }); localStorage.setItem(key, j.token); setToken(j.token); } catch (e) { setMsg((e as Error).message); } }}>Entrar</button>
      {msg && <p role="alert" style={{ color: 'var(--coral)' }}>{msg}</p>}</main>);
  if (!s) return wrap(<p>Cargando…</p>);
  const myTeam = s.teams.find((t) => t.id === s.me?.team_id);
  const cap = !!s.me?.captain;
  const introLeft = r && r.phase === 'open' ? Math.ceil((new Date(r.intro_until).getTime() + (s.skew ?? 0) - now) / 1000) : 0;
  const left = r?.phase === 'open' && r.closes_at ? Math.max(0, Math.ceil((new Date(r.closes_at).getTime() + (s.skew ?? 0) - now) / 1000)) : null;
  const total = s.answer_seconds ?? 20;
  const pips = left === null ? 0 : Math.ceil((Math.min(left, total) / total) * 10);
  const top = myTeam && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-dim)', fontSize: 14 }}><span>{myTeam.name}{cap ? ' · capitán' : ''}</span><span className="glow">{myTeam.score} pts</span></div>;

  if (s.game.status === 'lobby') return wrap(!myTeam ? (
    <section><h1 style={{ font: '800 24px var(--font-display)', margin: '20px 0 8px' }}>Elige tu equipo</h1>
      {s.teams.length === 0 && <p>Esperando a que el presentador cree equipos…</p>}
      {s.teams.map((t) => <button key={t.id} className="pcard" style={{ borderLeft: `14px solid ${t.color}` }} onClick={() => act({ type: 'team', team_id: t.id })}>{t.name}</button>)}
      {msg && <p role="alert" style={{ color: 'var(--coral)' }}>{msg}</p>}</section>
  ) : <div className="center" style={{ paddingTop: 180 }}><p className="glow" style={{ font: '900 30px var(--font-display)' }}>{myTeam.name}</p><p style={{ marginTop: 12 }}>{cap ? 'Eres el capitán: respondes por tu equipo.' : 'Respondes cuando lo decida tu capitán.'}</p><p style={{ marginTop: 24, color: 'var(--ink-dim)' }}>Mirad la tele… ya empieza</p></div>);
  if (s.game.status === 'finished') return wrap(<div className="center" style={{ paddingTop: 80 }}><h1 className="glow" style={{ font: '900 40px var(--font-display)' }}>¡Gran final!</h1>
    <ol style={{ marginTop: 24, fontSize: 22, listStyle: 'none', padding: 0 }}>{s.teams.map((t, i) => <li key={t.id} style={{ margin: '8px 0', fontWeight: t.id === myTeam?.id ? 900 : 500 }}>{i + 1}º {t.name} — {t.score}</li>)}</ol></div>);
  if (!myTeam) return wrap(<p style={{ paddingTop: 80 }}>Elige equipo antes de que empiece la partida.</p>);
  if (!r) return wrap(<>{top}<div className="center" style={{ paddingTop: 200 }}><p className="glow" style={{ font: '900 34px var(--font-display)' }}>Atentos…</p></div></>);

  const mine = r.my_answer;
  if (r.kind === 'challenge') return wrap(<>{top}<div className="center" style={{ paddingTop: 150 }}>
    <div className="qcard small" style={{ fontSize: 22 }}>{r.text}</div>
    <p className="glow" style={{ font: '900 26px var(--font-display)', marginTop: 28 }}>{r.team_id === myTeam.id ? '¡Os toca a vosotros!' : 'Mirad cómo lo hacen'}</p>
    {r.phase === 'revealed' && <p style={{ marginTop: 16, fontSize: 20 }}>{(r.results?.find((x) => x.team_id === myTeam.id)?.points ?? 0) > 0 ? `¡Conseguido! +${r.points}` : 'Esta vez no.'}</p>}</div></>);

  if (r.phase === 'open' && introLeft > 0) return wrap(<>{top}<div className="center" style={{ paddingTop: 200 }}><p className="glow" style={{ font: '900 34px var(--font-display)' }}>Atentos…</p><p style={{ marginTop: 12, color: 'var(--ink-dim)' }}>Se reparten las cartas · {r.points} pts</p></div></>);

  if (r.phase === 'revealed') {
    const m = r.results?.find((x) => x.team_id === myTeam.id);
    const ok = (m?.points ?? 0) > 0;
    return wrap(<>{top}<div className="center" style={{ paddingTop: 190 }}>
      <p style={{ font: '900 56px var(--font-display)', color: ok ? 'var(--lime)' : 'var(--coral)' }}>{ok ? '¡Correcto!' : m?.passed ? 'Pasasteis' : 'Esta vez no'}</p>
      {ok && <p className="glow" style={{ font: '900 60px var(--font-display)', marginTop: 10 }}>+{m!.points}</p>}
      <p style={{ marginTop: 30, color: 'var(--ink-dim)' }}>{myTeam.name} · {myTeam.score} pts</p></div></>);
  }

  const answered = !!mine; const locked = r.phase !== 'open';
  const options = r.options ?? [];
  return wrap(<>
    {top}
    <div style={{ margin: '12px auto', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div className={`pips ${left !== null && left <= 5 ? 'hot' : ''}`}>{Array.from({ length: 10 }, (_, i) => <i key={i} className={i >= pips ? 'off' : ''} />)}</div>
      <span className="secs" style={{ fontSize: 30 }}>{left ?? ''}</span></div>
    <div className="qcard small">{r.text}</div>
    {options.map((o, i) => {
      const hidden = r.hidden?.includes(i);
      const chosen = answered ? mine!.choice === i : pick === i;
      return (<button key={i} className={`pcard ${'abcd'[i]} ${chosen ? 'locked' : ''}`} disabled={answered || locked || hidden || !cap}
        onClick={() => setPick(i)}><b>{SUIT[i]}</b>{hidden ? '—' : o}{answered && chosen ? ' · enviada' : ''}</button>);
    })}
    {!cap && <p style={{ marginTop: 14, color: 'var(--ink-dim)', fontSize: 14 }}>Responde tu capitán.</p>}
    {cap && !answered && !locked && (<>
      <button className="btn" style={{ marginTop: 18 }} disabled={pick === null} onClick={async () => { if (pick !== null && await act({ type: 'answer', choice: pick, key: crypto.randomUUID() })) setPick(null); }}>
        {pick === null ? 'Elige una carta' : `Confirmar ${'ABCD'[pick]} · ${options[pick]}`}</button>
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>{Object.entries(JOKERS).map(([k, j]) => (
        <button key={k} className="joker" disabled={!s.jokers?.[k] || (k === 'fifty' && options.length < 4)} onClick={() => setSheet(k)}>{j.label}</button>))}</div></>)}
    {(answered || locked) && <p className="glow" style={{ font: '900 24px var(--font-display)', textAlign: 'center', marginTop: 22 }}>{answered ? 'Carta jugada' : 'Tiempo'}</p>}
    {(answered || locked) && <p style={{ textAlign: 'center', marginTop: 6, color: 'var(--ink-dim)' }}>Mirad la tele… {r.answered} de {r.active_teams} equipos listos</p>}
    {msg && <p role="alert" style={{ color: 'var(--coral)', marginTop: 12 }}>{msg}</p>}
    {sheet && (<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 12 }}>
      <div className="card" style={{ height: 'auto', width: '100%', maxWidth: 436, padding: 24, flexDirection: 'column', alignItems: 'stretch', textAlign: 'left' }}>
        <p style={{ font: '900 24px var(--font-display)', color: 'var(--joker)' }}>★ {JOKERS[sheet].label}</p>
        <p style={{ margin: '10px 0 18px', font: '500 16px sans-serif', color: '#5b4a7a' }}>{JOKERS[sheet].text}</p>
        <button className="btn" onClick={async () => { await act({ type: 'joker', kind: sheet }); setSheet(null); }}>Usar comodín</button>
        <button className="btn ghost" style={{ marginTop: 10, color: 'var(--card-ink)', background: '#eadff7' }} onClick={() => setSheet(null)}>Cancelar</button></div></div>)}
  </>);
}
