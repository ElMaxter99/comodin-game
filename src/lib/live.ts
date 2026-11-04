'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeGame } from './realtime';

export type Team = { id: string; name: string; color: string; score: number; members: number; safe?: number };
export type Round = {
  id: string; seq: number; status: 'open' | 'revealed'; kind: 'question' | 'challenge'; text: string;
  options: string[] | null; points: number; team_id: string | null; closes_at: string | null;
  answered: number; active_teams: number; correct?: number;
  phase: 'open' | 'suspense' | 'revealed'; intro_until: string; reveal_at: string | null; closed_at: string | null; hold: boolean; answered_teams: string[];
  results?: { team_id: string; choice: number | null; passed: boolean; points: number }[];
  bets?: { team_id: string; delta: number }[];
  my_answer?: { choice: number | null; passed: boolean } | null; hidden?: number[];
};
export type State = {
  version: number; server_time: string; theme?: string; growing_step?: number; safe_every?: number; bets_enabled?: boolean;
  bet?: { enabled: boolean; available: boolean; placed_now: boolean }; skew?: number; dramatic_pause?: boolean; intro_seconds?: number; answer_seconds?: number;
  game: { room_code: string; name: string; status: 'lobby' | 'active' | 'paused' | 'finished' };
  players: { id: string; name: string; color: string }[];
  teams: Team[]; items_total: number; rounds_played: number; round?: Round;
  me?: { player_id: string | null; team_id: string | null; captain: boolean };
  jokers?: Record<string, boolean>;
  items?: { id: string; kind: string; text: string; options: string[] | null; correct: number | null; points: number }[];
};

/** Aplica el tema de la partida (`<html data-theme>`); los temas viven en globals.css. */
export function useTheme(theme?: string) {
  useEffect(() => {
    const el = document.documentElement;
    if (theme && theme !== 'base') el.dataset.theme = theme; else delete el.dataset.theme;
    return () => { delete el.dataset.theme; };
  }, [theme]);
}

export function useGame(code: string, view: 'public' | 'host' | 'player', token?: string | null) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const refresh = useCallback(async () => {
    const r = await fetch(`/api/games/${code}/state?view=${view}`, { headers: token ? { 'x-player-token': token } : {}, cache: 'no-store' });
    const j = await r.json();
    if (!r.ok) setError(j.error); else { setError(null); setState({ ...j, skew: Date.now() - new Date(j.server_time).getTime() }); }
  }, [code, view, token]);
  // Realtime avisa de cada cambio; el sondeo queda de respaldo (1 s sin Realtime, 5 s con él).
  const [live, setLive] = useState(false);
  useEffect(() => subscribeGame(code, refresh, setLive), [code, refresh]);
  useEffect(() => {
    refresh();
    timer.current = setInterval(refresh, live ? 5000 : 1000);
    return () => clearInterval(timer.current);
  }, [refresh, live]);
  return { state, error, refresh };
}

export async function send(path: string, body: unknown, token?: string | null) {
  const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { 'x-player-token': token } : {}) }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? 'Error');
  return j;
}

export function useCountdown(closesAt: string | null | undefined, serverTime: string | undefined) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!closesAt || !serverTime) { setLeft(null); return; }
    const skew = Date.now() - new Date(serverTime).getTime();
    const tick = () => setLeft(Math.max(0, Math.ceil((new Date(closesAt).getTime() + skew - Date.now()) / 1000)));
    tick(); const i = setInterval(tick, 250); return () => clearInterval(i);
  }, [closesAt, serverTime]);
  return left;
}

/** Hora del servidor (ms), corregida por el desfase medido al recibir la instantánea; se actualiza cada `ms`. */
export function useServerNow(s: State | null, ms = 200) {
  const [, force] = useState(0);
  useEffect(() => { const i = setInterval(() => force((n) => n + 1), ms); return () => clearInterval(i); }, [ms]);
  return Date.now() - (s?.skew ?? 0);
}
