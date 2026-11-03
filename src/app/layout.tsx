import './globals.css';
import type { Metadata, Viewport } from 'next';
export const metadata: Metadata = { title: 'Comodín Game', description: 'Preguntas y retos por equipos, en la tele y con los móviles.' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="es"><body className="min-h-screen">{children}</body></html>);
}
