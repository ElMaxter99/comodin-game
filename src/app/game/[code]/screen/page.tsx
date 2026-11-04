'use client';
import { use, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { send, useGame, useServerNow, type Round, type State } from '@/lib/live';
import { Stage } from '@/components/Stage';
import { enableSound, sfx, soundEnabled } from '@/lib/audio';

const SUIT = ['♥', '♠', '♦', '♣'];
const REVEAL_SHOW_MS = 6000;   // cuánto se ve la revelación antes de pasar al marcador

export default function Screen({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { state: s, error, refresh } = useGame(code, 'public');
  const now = useServerNow(s);
  const [qr, setQr] = useState('');
  const [snd, setSnd] = useState(false);
  useEffect(() => { QRCode.toDataURL(`${location.origin}/game/${code}/play`, { margin: 1, width: 240 }).then(setQr); }, [code]);
  const r = s?.round;

  // Cierre por tiempo y paso a «revelada» sin esperar al siguiente sondeo.
  useEffect(() => {
    if (!s || !r) return;
    if (r.phase === 'open' && r.closes_at) {
      const ms = new Date(r.closes_at).getTime() + (s.skew ?? 0) - Date.now() + 50;
      const t = setTimeout(() => send(`/api/games/${code}/host`, { type: 'time' }).then(refresh).catch(() => {}), Math.max(ms, 0));
      return () => clearTimeout(t);
    }
    if (r.phase === 'suspense' && r.reveal_at) {
      const ms = new Date(r.reveal_at).getTime() + (s.skew ?? 0) - Date.now() + 80;
      const t = setTimeout(refresh, Math.max(ms, 0));
      return () => clearTimeout(t);
    }
  }, [r?.id, r?.phase, r?.closes_at, r?.reveal_at, s?.skew, code, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sonido por cambios de fase.
  const last = useRef<string>('');
  useEffect(() => {
    if (!s) return;
    const key = `${s.game.status}|${r?.id}|${r?.phase}`;
    if (key === last.current) return;
    const prev = last.current; last.current = key;
    if (!prev) return;
    if (s.game.status === 'finished') sfx.fanfare();
    else if (r?.phase === 'open') sfx.deal();
    else if (r?.phase === 'suspense') sfx.pulse();
    else if (r?.phase === 'revealed') { const win = r.results?.some((x) => x.points > 0); (win || r.kind === 'challenge' ? sfx.right : sfx.wrong)(); }
  }, [s, r]);
  const lastTick = useRef(-1);
  const left = r?.phase === 'open' && r.closes_at ? Math.max(0, Math.ceil((new Date(r.closes_at).getTime() + (s?.skew ?? 0) - now) / 1000)) : null;
  useEffect(() => { if (left !== null && left <= 5 && left > 0 && left !== lastTick.current) { lastTick.current = left; sfx.tick(); } }, [left]);

  const toggleSound = () => { enableSound(!soundEnabled()); setSnd(soundEnabled()); if (soundEnabled()) sfx.bell(); };
  if (error) return <Stage><p style={{ padding: 40, fontSize: 32 }}>{error}</p></Stage>;
  if (!s) return <Stage><p style={{ padding: 40, fontSize: 32 }}>Cargando…</p></Stage>;

  const team = (id: string | null) => s.teams.find((t) => t.id === id);
  return (
    <Stage>
      <button onClick={toggleSound} aria-label="Activar o silenciar el sonido" style={{ position: 'absolute', top: 6, right: 8, zIndex: 5, background: 'none', border: 0, color: '#fff', opacity: snd ? 0.9 : 0.5, fontSize: 22, cursor: 'pointer' }}>{snd ? '🔊' : '🔇'}</button>
      {s.game.status === 'lobby' && <Lobby s={s} code={code} qr={qr} />}
      {s.game.status === 'active' && !r && <Center text="Preparados…" />}
      {s.game.status === 'active' && r && <RoundView s={s} r={r} now={now} left={left} team={team} />}
      {s.game.status === 'finished' && <Podium s={s} />}
    </Stage>
  );
}

function Center({ text }: { text: string }) {
  return <div className="center" style={{ paddingTop: 280 }}><p className="glow" style={{ font: '900 64px var(--font-display)' }}>{text}</p></div>;
}

function Lobby({ s, code, qr }: { s: State; code: string; qr: string }) {
  return (<>
    <div className="center" style={{ paddingTop: 50 }}>
      <p style={{ fontSize: 26, color: 'var(--ink-dim)' }}>Entra desde el móvil con el código</p>
      <p className="big glow">{code}</p>
      <p style={{ font: '800 30px var(--font-display)' }}>{s.game.name}</p>
    </div>
    <div style={{ display: 'flex', gap: 26, justifyContent: 'center', marginTop: 40, alignItems: 'center' }}>
      {s.teams.map((t, i) => (
        <div key={t.id} className="card" style={{ height: 150, width: 240, flexDirection: 'column', borderBottom: `14px solid ${t.color}`, transform: `rotate(${[-2, 1, -1, 2][i % 4]}deg)` }}>
          <div>{t.name}</div><small style={{ position: 'static', marginTop: 8 }}>{t.members} {t.members === 1 ? 'jugador' : 'jugadores'}</small>
        </div>))}
      {qr && <img src={qr} alt="QR para unirse" width={170} height={170} style={{ borderRadius: 14, background: '#fff', padding: 8 }} />}
    </div>
    <div className="host-line"><span className="tag">Presentador</span>Cuando estén todos, el presentador pulsa «Empezar»</div>
  </>);
}

function Pips({ left, total }: { left: number | null; total: number }) {
  const n = 10, on = left === null ? 0 : Math.ceil((Math.min(left, total) / total) * n);
  return (<div style={{ display: 'flex', alignItems: 'center' }}>
    <div className={`pips ${left !== null && left <= 5 ? 'hot' : ''}`}>{Array.from({ length: n }, (_, i) => <i key={i} className={i >= on ? 'off' : ''} />)}</div>
    <span className="secs">{left ?? ''}</span></div>);
}

function RoundView({ s, r, now, left, team }: { s: State; r: Round; now: number; left: number | null; team: (id: string | null) => State['teams'][number] | undefined }) {
  const introMs = new Date(r.intro_until).getTime() + (s.skew ?? 0) - now;
  const total = s.answer_seconds ?? 20;
  // Marcador entre rondas, pasado un rato desde la revelación.
  const revealAt = r.reveal_at ? new Date(r.reveal_at).getTime() + (s.skew ?? 0) : null;
  if (r.phase === 'revealed' && revealAt && now - revealAt > REVEAL_SHOW_MS) return <Scoreboard s={s} />;
  const hud = (<div className="hud"><span className="tag">{r.kind === 'question' ? 'Ronda' : 'Reto'} {r.seq} de {s.items_total}</span>
    {r.kind === 'question' ? <Pips left={r.phase === 'open' && introMs <= 0 ? left : r.phase === 'open' ? total : 0} total={total} /> : <span />}
    <span className="tag pts">{r.points} pts</span></div>);
  if (r.phase === 'open' && introMs > 0) {
    return (<><div className="center" style={{ paddingTop: 150 }}>
      <div className="card flip" style={{ display: 'inline-flex', width: 420, height: 300, flexDirection: 'column', transform: 'rotate(-3deg)' }}>
        <div className="idx" style={{ ['--s' as string]: 'var(--joker)' }}>★</div>
        <small style={{ position: 'static', fontSize: 22 }}>{r.kind === 'question' ? 'Ronda' : 'Reto'} {r.seq} de {s.items_total}</small>
        <div style={{ font: '900 110px var(--font-display)', color: 'var(--joker)' }}>{r.points}</div>
        <small style={{ position: 'static', fontSize: 22 }}>puntos en juego</small></div></div></>);
  }
  const since = r.phase === 'open' ? -introMs : 99999;
  const dim = r.phase === 'suspense';
  const who = (i: number) => r.results?.filter((x) => x.choice === i).map((x) => team(x.team_id)?.name).join(' · ');
  return (<>
    {hud}
    <div className="qcard" style={r.kind === 'challenge' ? { fontSize: 44 } : undefined}>{r.text}</div>
    {r.kind === 'question' && r.options && (
      <div className="cards" style={r.options.length === 2 ? { gridTemplateColumns: 'repeat(2, 1fr)', margin: '34px 200px 0' } : undefined}>
        {r.options.map((o, i) => {
          const l = 'abcd'[i];
          const shown = r.phase !== 'open' || since >= i * 400;
          const cls = r.phase === 'revealed' ? (r.correct === i ? 'correct' : (r.results?.some((x) => x.choice === i) ? 'wrong' : 'out')) : (shown ? (dim ? 'dim' : '') : 'back');
          const w = r.phase === 'revealed' ? who(i) : '';
          return (<div key={i} className={`card ${l} ${cls} ${r.phase === 'open' && shown && since < i * 400 + 600 ? 'flip' : ''}`}>
            <div className="idx">{'ABCD'[i]}<s>{SUIT[i]}</s></div>{o}{w ? <small>{w}</small> : null}<div className="idx br">{'ABCD'[i]}<s>{SUIT[i]}</s></div></div>);
        })}
      </div>)}
    {r.kind === 'challenge' && (<div className="center" style={{ marginTop: 40 }}>
      <span className="tag" style={{ fontSize: 26, padding: '12px 28px' }}>Le toca a: {team(r.team_id)?.name}</span>
      {r.phase === 'revealed' && <p className="glow" style={{ font: '900 44px var(--font-display)', marginTop: 24 }}>{(r.results?.[0]?.points ?? 0) > 0 ? `¡Conseguido! +${r.points}` : 'Esta vez no'}</p>}</div>)}
    {r.kind === 'question' && <div className="hands">{s.teams.map((t) => (
      <div key={t.id} className={`hand ${r.answered_teams.includes(t.id) ? 'done' : ''}`} style={{ ['--c' as string]: t.color }}>
        <span>{t.name}{r.phase === 'open' && !r.answered_teams.includes(t.id) ? ' …' : ''}</span><span>{t.score}</span></div>))}</div>}
    <div className="host-line"><span className="tag">Presentador</span>
      {r.phase === 'open' && r.kind === 'question' && `${r.answered} de ${r.active_teams} equipos han confirmado`}
      {r.phase === 'open' && r.kind === 'challenge' && 'El presentador decide si lo han conseguido'}
      {r.phase === 'suspense' && (r.hold ? 'Esperando al presentador…' : 'Luces bajas… ¿cuál será?')}
      {r.phase === 'revealed' && 'La carta correcta se ha dado la vuelta'}</div>
  </>);
}

function Scoreboard({ s }: { s: State }) {
  return (<>
    <div className="center" style={{ paddingTop: 36 }}><p className="glow" style={{ font: '900 46px var(--font-display)' }}>Marcador</p></div>
    <div style={{ display: 'flex', gap: 26, justifyContent: 'center', marginTop: 50 }}>
      {s.teams.slice(0, 4).map((t, i) => (
        <div key={t.id} className="card flip" style={{ height: 320, width: 270, flexDirection: 'column', borderBottom: `16px solid ${t.color}`, transform: `translateY(${[-10, 20, 30, 40][i]}px) rotate(${[0, -2, 2, -1][i]}deg)` }}>
          <div className="idx" style={{ ['--s' as string]: t.color }}>{i + 1}º</div>
          <div style={{ font: '800 30px var(--font-display)' }}>{t.name}</div>
          <div style={{ font: '900 64px var(--font-display)', color: 'var(--joker)' }}>{t.score}</div></div>))}
    </div>
    <div className="host-line"><span className="tag">Presentador</span>Entre rondas · «Lanzar siguiente»</div>
  </>);
}

function Podium({ s }: { s: State }) {
  const order = [s.teams[1], s.teams[0], s.teams[2]].filter(Boolean);
  const heights: Record<number, number> = { 0: 380, 1: 280, 2: 220 };
  return (<>
    <div className="center" style={{ paddingTop: 30 }}><p className="glow" style={{ font: '900 54px var(--font-display)' }}>¡Gran final!</p></div>
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 26, marginTop: 30 }}>
      {order.map((t) => { const pos = s.teams.indexOf(t); return (
        <div key={t.id} className="card flip" style={{ width: 250, height: heights[pos] ?? 200, flexDirection: 'column', borderBottom: `16px solid ${t.color}` }}>
          <div className="idx" style={{ ['--s' as string]: t.color }}>{pos + 1}º</div>
          <div style={{ font: '800 28px var(--font-display)' }}>{t.name}</div>
          <div style={{ font: '900 52px var(--font-display)', color: 'var(--joker)' }}>{t.score}</div></div>); })}
    </div>
    {s.teams.length > 3 && <p className="center" style={{ marginTop: 24, fontSize: 22, color: 'var(--ink-dim)' }}>{s.teams.slice(3).map((t, i) => `${i + 4}º ${t.name} (${t.score})`).join(' · ')}</p>}
  </>);
}
