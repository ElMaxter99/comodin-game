'use client';
import { useEffect, useState } from 'react';

/** Escenario de TV 1280×720 que se escala para llenar la pantalla (16:9, con barras si hace falta). */
export function Stage({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const f = () => setScale(Math.min(window.innerWidth / 1280, window.innerHeight / 720));
    f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f);
  }, []);
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#12061f', display: 'grid', placeItems: 'center' }}>
      <div style={{ width: 1280 * scale, height: 720 * scale }}>
        <div className="tvstage felt" style={{ transform: `scale(${scale})` }}>{children}</div>
      </div>
    </div>
  );
}
