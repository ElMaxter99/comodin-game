// Modo de desarrollo: PGlite (Postgres WASM) con el mismo SQL `cg_*` que irá a Supabase.
// El adaptador de Supabase (rpc con service_role) está pendiente: ver docs/PENDIENTE.md.
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const g = globalThis as unknown as { __cgDb?: Promise<PGlite> };

async function open(): Promise<PGlite> {
  if (process.env.VERCEL) throw new Error('El modo de desarrollo (PGlite) no funciona en Vercel.');
  const db = new PGlite(process.env.DEMO_DATA_DIR || undefined);
  const dir = join(process.cwd(), 'supabase', 'migrations');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql') && !x.includes('_security')).sort()) {
    await db.exec(readFileSync(join(dir, f), 'utf8'));
  }
  return db;
}

export function getDb() { return (g.__cgDb ??= open()); }

export async function rpc<T = any>(fn: string, p: Record<string, unknown>): Promise<T> {
  if (!/^cg_[a-z_]+$/.test(fn)) throw new Error('función no permitida');
  const db = await getDb();
  const r = await db.query<{ r: T }>(`select ${fn}($1::jsonb) as r`, [JSON.stringify(p)]);
  return r.rows[0].r;
}
