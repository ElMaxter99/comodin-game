'use client';
import { useEffect, useState } from 'react';
import { send } from '@/lib/live';

/** Supabase devuelve los tokens en el fragmento (#access_token=…) de la URL del enlace mágico. */
export default function Callback() {
  const [msg, setMsg] = useState('Entrando…');
  useEffect(() => {
    const h = new URLSearchParams(location.hash.replace(/^#/, ''));
    const access_token = h.get('access_token'), refresh_token = h.get('refresh_token');
    history.replaceState(null, '', location.pathname);
    if (!access_token || !refresh_token) { setMsg(h.get('error_description') ?? 'El enlace no es válido o ha caducado. Pide otro.'); return; }
    send('/api/auth/session', { access_token, refresh_token, expires_in: Number(h.get('expires_in') ?? 3600) })
      .then(() => { location.replace('/'); }).catch((e) => setMsg((e as Error).message));
  }, []);
  return <div className="felt phone"><main className="center" style={{ paddingTop: 200 }}><p className="glow" style={{ font: '900 26px var(--font-display)' }}>{msg}</p><p style={{ marginTop: 16 }}><a href="/entrar" style={{ textDecoration: 'underline' }}>Pedir otro enlace</a></p></main></div>;
}
