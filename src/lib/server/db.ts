// Acceso a la base de datos: Supabase si hay credenciales de servidor; si no, PGlite (Postgres WASM) en desarrollo.
// Las dos vías ejecutan el MISMO SQL `cg_*` (supabase/migrations): la lógica del juego vive en SQL, no aquí.
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { supabaseConfigured, supabaseRpc } from './supabase';

const g = globalThis as unknown as { __cgDb?: Promise<PGlite> };

async function open(): Promise<PGlite> {
  if (process.env.VERCEL) throw new Error('Falta configurar Supabase: el modo de desarrollo (PGlite) no funciona en Vercel. Mira docs/INFRA.md.');
  const db = new PGlite(process.env.DEMO_DATA_DIR || undefined);
  const dir = join(process.cwd(), 'supabase', 'migrations');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql') && !x.includes('_security')).sort()) {
    await db.exec(readFileSync(join(dir, f), 'utf8'));
  }
  return db;
}

export function getDb() { return (g.__cgDb ??= open()); }
export const backend = () => (supabaseConfigured() ? 'supabase' : 'pglite') as 'supabase' | 'pglite';

export async function rpc<T = any>(fn: string, p: Record<string, unknown>): Promise<T> {
  if (!/^cg_[a-z_]+$/.test(fn)) throw new Error('función no permitida');
  if (supabaseConfigured()) return supabaseRpc<T>(fn, p);
  const db = await getDb();
  const r = await db.query<{ r: T }>(`select ${fn}($1::jsonb) as r`, [JSON.stringify(p)]);
  return r.rows[0].r;
}
