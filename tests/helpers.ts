import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(__dirname, '..', 'supabase', 'migrations');

export async function makeDb() {
  const db = new PGlite();
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql') && !x.includes('_security')).sort()) {
    await db.exec(readFileSync(join(dir, f), 'utf8'));
  }
  const rpc = async (fn: string, p: Record<string, unknown>) => {
    const r = await db.query<{ r: any }>(`select ${fn}($1::jsonb) as r`, [JSON.stringify(p)]);
    return r.rows[0].r;
  };
  const err = async (fn: string, p: Record<string, unknown>) => {
    try { await rpc(fn, p); } catch (e: any) { return String(e.message); }
    return null;
  };
  return { db, rpc, err };
}

export const HOST = '11111111-1111-1111-1111-111111111111';
