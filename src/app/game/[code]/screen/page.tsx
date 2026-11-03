'use client';
import { use, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { send, useCountdown, useGame } from '@/lib/live';

export default function Screen({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { state: s, error } = useGame(code, 'public');
  const [qr, setQr] = useState('');
  useEffect(() => { QRCode.toDataURL(`${location.origin}/game/${code}/play`, { margin: 1, width: 280 }).then(setQr); }, [code]);
  const r = s?.round;
  const left = useCountdown(r?.status === 'open' ? r.closes_at : null, s?.server_time);
  useEffect(() => { if (left === 0 && r?.status === 'open') send(`/api/games/${code}/host`, { type: 'time' }).catch(() => {}); }, [left, r?.status, code]);
  if (error) return <p className="p-8 text-2xl">{error}</p>;
  if (!s) return <p className="p-8 text-2xl">Cargando…</p>;
  const team = (id: string | null) => s.teams.find((t) => t.id === id);
  const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-600', 'bg-amber-500'];
  return (
    <main className="min-h-screen p-8 space-y-6">
      {s.game.status === 'lobby' && (
        <div className="grid grid-cols-2 gap-8 items-center">
          <div><p className="text-xl">Entra desde el móvil con el código</p>
            <p className="text-8xl font-black tracking-widest">{code}</p>
            <ul className="mt-6 text-2xl space-y-1">{s.teams.map((t) => <li key={t.id} style={{ color: t.color }}>● {t.name} · {t.members} jugadores</li>)}</ul></div>
          {qr && <img src={qr} alt="QR para unirse" className="justify-self-center rounded-2xl bg-white p-3" width={280} height={280} />}
        </div>)}
      {s.game.status === 'active' && !r && <p className="text-4xl">Preparados…</p>}
      {r && s.game.status === 'active' && (
        <section className="space-y-6">
          <div className="flex justify-between text-2xl"><span>{r.kind === 'question' ? 'Pregunta' : 'Reto'} {r.seq} · {r.points} pts</span>
            {r.status === 'open' && left !== null && <span className="text-5xl font-black">{left}</span>}
            {r.status === 'open' && r.kind === 'question' && <span>{r.answered}/{r.active_teams} han respondido</span>}</div>
          <h1 className="text-5xl font-black">{r.text}</h1>
          {r.kind === 'challenge' && <p className="text-3xl">Lo hace: <b style={{ color: team(r.team_id)?.color }}>{team(r.team_id)?.name}</b></p>}
          {r.options && <div className="grid grid-cols-2 gap-4">{r.options.map((o, i) => (
            <div key={i} className={`rounded-2xl p-6 text-3xl font-bold ${colors[i]} ${r.status === 'revealed' && r.correct !== i ? 'opacity-30' : ''}`}>
              {'ABCD'[i]} · {o}{r.status === 'revealed' && r.correct === i ? ' ✓' : ''}
              {r.status === 'revealed' && <div className="text-lg font-normal">{r.results?.filter((x) => x.choice === i).map((x) => team(x.team_id)?.name).join(', ')}</div>}
            </div>))}</div>}
        </section>)}
      {(s.game.status === 'finished' || (r?.status === 'revealed') || s.game.status === 'lobby') && s.teams.length > 0 && s.game.status !== 'lobby' && (
        <section className="card"><h2 className="text-3xl font-black mb-3">{s.game.status === 'finished' ? '🏆 Podio' : 'Marcador'}</h2>
          <ol className="text-3xl space-y-1">{s.teams.map((t, i) => <li key={t.id} style={{ color: t.color }}>{i + 1}. {t.name} — {t.score}</li>)}</ol></section>)}
    </main>
  );
}
