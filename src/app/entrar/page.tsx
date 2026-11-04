'use client';
import { useState } from 'react';
import { send } from '@/lib/live';

// Diseño: partykit-casero/juegos/comodin-game/design/mockups/panel-0-acceso.html (§15).
export default function Entrar() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const go = async () => { try { setErr(''); await send('/api/auth/login', { email }); setSent(true); } catch (e) { setErr((e as Error).message); } };
  return (
    <div className="felt phone"><main style={{ paddingTop: 60 }}>
      <div className="center"><p className="glow" style={{ font: '900 36px var(--font-display)' }}>🃏 Comodín</p><p style={{ marginTop: 6, color: 'var(--ink-dim)' }}>Entrada del presentador</p></div>
      <section className="panel" style={{ marginTop: 36 }}>
        {sent ? <p style={{ font: '800 18px var(--font-display)' }}>Revisa tu correo: te hemos enviado el enlace. Ábrelo en este mismo navegador.</p> : (<>
          <p style={{ font: '800 18px var(--font-display)', marginBottom: 12 }}>Te enviamos un enlace al correo</p>
          <input className="field" type="email" autoComplete="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Correo" />
          <button className="btn" style={{ marginTop: 14 }} disabled={!email.includes('@')} onClick={go}>Enviar enlace</button>
          <p style={{ marginTop: 14, fontSize: 14, color: 'var(--ink-dim)' }}>Sin contraseña. Los jugadores no necesitan cuenta: solo entran con el código.</p></>)}
        {err && <p role="alert" style={{ color: 'var(--coral)', marginTop: 12 }}>{err}</p>}
      </section></main></div>
  );
}
