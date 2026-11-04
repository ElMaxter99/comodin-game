'use client';
// Cliente mínimo de Supabase Realtime (Broadcast) por WebSocket (protocolo Phoenix), sin SDK.
// El servidor avisa con «tick» tras cada cambio; aquí solo se vuelve a pedir la instantánea. Si no hay Realtime, queda el sondeo.
export const realtimeAvailable = () => !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function subscribeGame(code: string, onTick: () => void, onStatus: (connected: boolean) => void): () => void {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key || typeof WebSocket === 'undefined') return () => {};
  const topic = `realtime:game:${code.toUpperCase()}`;
  let ws: WebSocket | undefined, hb: ReturnType<typeof setInterval> | undefined, retry: ReturnType<typeof setTimeout> | undefined, ref = 0, closed = false;
  const open = () => {
    ws = new WebSocket(`${base.replace(/^http/, 'ws').replace(/\/+$/, '')}/realtime/v1/websocket?apikey=${key}&vsn=1.0.0`);
    ws.onopen = () => {
      ws!.send(JSON.stringify({ topic, event: 'phx_join', payload: { config: { broadcast: { self: false }, presence: { key: '' }, private: false } }, ref: String(++ref) }));
      hb = setInterval(() => ws?.readyState === 1 && ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) })), 25_000);
    };
    ws.onmessage = (m) => {
      try {
        const d = JSON.parse(String(m.data));
        if (d.event === 'phx_reply' && d.topic === topic) onStatus(d.payload?.status === 'ok');
        else if (d.event === 'broadcast') onTick();
      } catch { /* mensaje no válido: se ignora */ }
    };
    ws.onclose = () => { clearInterval(hb); onStatus(false); if (!closed) retry = setTimeout(open, 2000); };
    ws.onerror = () => ws?.close();
  };
  open();
  return () => { closed = true; clearTimeout(retry); clearInterval(hb); ws?.close(); };
}
