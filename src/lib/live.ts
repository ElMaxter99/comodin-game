'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export type Team = { id: string; name: string; color: string; score: number; members: number };
export type Round = {
  id: string; seq: number; status: 'open' | 'revealed'; kind: 'question' | 'challenge'; text: string;
  options: string[] | null; points: number; team_id: string | null; closes_at: string | null;
  answered: number; active_teams: number; correct?: number;
  results?: { team_id: string; choice: number | null; passed: boolean; points: number }[];
  my_answer?: { choice: number | null; passed: boolean } | null; hidden?: number[];
};
export type State = {
  version: number; server_time: string;
  game: { room_code: string; name: string; status: 'lobby' | 'active' | 'paused' | 'finished' };
  players: { id: string; name: string; color: string }[];
  teams: Team[]; items_total: number; rounds_played: number; round?: Round;
  me?: { player_id: string | null; team_id: string | null; captain: boolean };
  jokers?: Record<string, boolean>;
  items?: { id: string; kind: string; text: string; options: string[] | null; correct: number | null; points: number }[];
};

export function useGame(code: string, view: 'public' | 'host' | 'player', token?: string | null) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const refresh = useCallback(async () => {
    const r = await fetch(`/api/games/${code}/state?view=${view}`, { headers: token ? { 'x-player-token': token } : {}, cache: 'no-store' });
    const j = await r.json();
    if (!r.ok) setError(j.error); else { setError(null); setState((s) => (s && s.version === j.version && s.server_time === j.server_time ? s : j)); }
  }, [code, view, token]);
  useEffect(() => {
    refresh();
    timer.current = setInterval(refresh, 1500);
    return () => clearInterval(timer.current);
  }, [refresh]);
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
