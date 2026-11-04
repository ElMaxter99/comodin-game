// Adaptador de Supabase (solo servidor): llama a las funciones `cg_*` por la API REST de Postgres (PostgREST) con la clave
// `service_role`, que NUNCA sale del servidor. No usa SDK: son peticiones HTTP sencillas (sin dependencias nuevas).
// Realtime: tras cada cambio avisa por Broadcast («tick» sin datos: los clientes vuelven a pedir la instantánea).
const URL_ = () => (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE = () => process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const ANON = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/** Hay credenciales de servidor: se usa Supabase en lugar de PGlite. */
export const supabaseConfigured = () => !!(URL_() && SERVICE());

const READS = new Set(['cg_get_state']);

export async function supabaseRpc<T = unknown>(fn: string, p: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${URL_()}/rest/v1/rpc/${fn}`, {
    method: 'POST', cache: 'no-store',
    headers: { apikey: SERVICE(), Authorization: `Bearer ${SERVICE()}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p }),
  });
  const j = await r.json().catch(() => null);
  // Los errores de las reglas llegan como `ERR:codigo` en `message` (RAISE en plpgsql).
  if (!r.ok) throw new Error(typeof j?.message === 'string' ? j.message : `supabase ${r.status}`);
  if (!READS.has(fn)) void broadcast(String(p.room_code ?? ''));
  return j as T;
}

/** Avisa a TV, panel y móviles de que hay cambios (no bloquea ni rompe la acción si falla: queda el sondeo). */
export async function broadcast(roomCode: string) {
  if (!roomCode) return;
  try {
    await fetch(`${URL_()}/realtime/v1/api/broadcast`, {
      method: 'POST', headers: { apikey: SERVICE(), Authorization: `Bearer ${SERVICE()}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic: `game:${roomCode.toUpperCase()}`, event: 'tick', payload: {}, private: false }] }),
    });
  } catch { /* el sondeo lo recupera */ }
}

// ---- Auth del presentador (Supabase Auth, enlace mágico por correo) -------------------------------------------------
const authHeaders = (bearer?: string) => ({ apikey: ANON(), 'content-type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) });

export async function sendMagicLink(email: string, redirectTo: string) {
  const r = await fetch(`${URL_()}/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ email, create_user: true }) });
  if (!r.ok) throw new Error('ERR:login_failed');
}

const cache = new Map<string, { id: string; until: number }>();
/** Usuario dueño de un token de acceso (se verifica con Supabase; caché de 30 s). */
export async function userFromToken(token: string): Promise<string | null> {
  const hit = cache.get(token);
  if (hit && hit.until > Date.now()) return hit.id;
  const r = await fetch(`${URL_()}/auth/v1/user`, { headers: authHeaders(token), cache: 'no-store' });
  if (!r.ok) return null;
  const j = await r.json();
  if (typeof j?.id !== 'string') return null;
  if (cache.size > 500) cache.clear();
  cache.set(token, { id: j.id, until: Date.now() + 30_000 });
  return j.id;
}

export async function refreshSession(refresh_token: string): Promise<{ access_token: string; refresh_token: string; expires_in: number; id: string } | null> {
  const r = await fetch(`${URL_()}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ refresh_token }) });
  if (!r.ok) return null;
  const j = await r.json();
  return j?.access_token && j?.user?.id ? { access_token: j.access_token, refresh_token: j.refresh_token, expires_in: j.expires_in ?? 3600, id: j.user.id } : null;
}
