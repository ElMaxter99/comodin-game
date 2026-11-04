import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createServer, type Server, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';

// Servidor falso con la forma de PostgREST, Auth y Realtime de Supabase: comprueba lo que enviamos y cómo tratamos las respuestas.
// NO prueba contra Supabase real (ver docs/PENDIENTE.md).
type Req = { method: string; url: string; headers: IncomingMessage['headers']; body: any };
let srv: Server, calls: Req[] = [], respond: (r: Req) => [number, any];

beforeAll(async () => {
  srv = createServer((req, res) => {
    let raw = ''; req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const r: Req = { method: req.method!, url: req.url!, headers: req.headers, body: raw ? JSON.parse(raw) : undefined };
      calls.push(r);
      const [st, body] = respond(r);
      res.writeHead(st, { 'content-type': 'application/json' }); res.end(JSON.stringify(body));
    });
  });
  await new Promise<void>((ok) => srv.listen(0, ok));
  process.env.SUPABASE_URL = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-secret';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-public';
});
afterAll(() => { srv.close(); delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; });
beforeEach(() => { calls = []; respond = () => [200, {}]; vi.resetModules(); });

describe('adaptador de Supabase', () => {
  it('llama a la función cg_* con {p} y la clave de servicio, y avisa por Broadcast tras un cambio', async () => {
    respond = (r) => (r.url.includes('/rpc/') ? [200, { ok: true }] : [200, {}]);
    const { rpc } = await import('../src/lib/server/db');
    expect(await rpc('cg_open_round', { room_code: 'abcd', host_id: 'h' })).toEqual({ ok: true });
    const call = calls.find((c) => c.url === '/rest/v1/rpc/cg_open_round')!;
    expect(call.body).toEqual({ p: { room_code: 'abcd', host_id: 'h' } });
    expect(call.headers.apikey).toBe('service-secret');
    await vi.waitFor(() => expect(calls.some((c) => c.url === '/realtime/v1/api/broadcast')).toBe(true));
    const b = calls.find((c) => c.url === '/realtime/v1/api/broadcast')!;
    expect(b.body.messages[0]).toMatchObject({ topic: 'game:ABCD', event: 'tick', private: false });
    expect(JSON.stringify(b.body)).not.toMatch(/correct|token/);
  });

  it('las lecturas no emiten Broadcast', async () => {
    const { rpc } = await import('../src/lib/server/db');
    await rpc('cg_get_state', { room_code: 'ABCD', view: 'public' });
    await new Promise((r) => setTimeout(r, 50));
    expect(calls.map((c) => c.url)).toEqual(['/rest/v1/rpc/cg_get_state']);
  });

  it('propaga los errores de las reglas (ERR:codigo) y rechaza funciones que no son cg_*', async () => {
    respond = () => [400, { code: 'P0001', message: 'ERR:round_closed' }];
    const { rpc } = await import('../src/lib/server/db');
    await expect(rpc('cg_answer', { room_code: 'ABCD' })).rejects.toThrow('ERR:round_closed');
    await expect(rpc('drop_table', {})).rejects.toThrow('no permitida');
  });

  it('verifica el token del presentador con Supabase Auth y lo cachea', async () => {
    respond = (r) => (r.url === '/auth/v1/user' ? (r.headers.authorization === 'Bearer buen-token' ? [200, { id: 'user-1' }] : [401, {}]) : [200, {}]);
    const { userFromToken } = await import('../src/lib/server/supabase');
    expect(await userFromToken('buen-token')).toBe('user-1');
    expect(await userFromToken('buen-token')).toBe('user-1');
    expect(await userFromToken('malo')).toBeNull();
    expect(calls.filter((c) => c.url === '/auth/v1/user')).toHaveLength(2);   // la segunda del buen token sale de la caché
    expect(calls[0].headers.apikey).toBe('anon-public');                        // Auth usa la clave pública, no la de servicio
  });

  it('envía el enlace mágico con la URL de vuelta y renueva sesiones', async () => {
    respond = (r) => (r.url.startsWith('/auth/v1/token') ? [200, { access_token: 'nuevo', refresh_token: 'r2', expires_in: 3600, user: { id: 'user-1' } }] : [200, {}]);
    const { sendMagicLink, refreshSession } = await import('../src/lib/server/supabase');
    await sendMagicLink('a@b.es', 'https://x.app/auth/callback');
    expect(calls[0].url).toBe('/auth/v1/otp?redirect_to=https%3A%2F%2Fx.app%2Fauth%2Fcallback');
    expect(calls[0].body).toEqual({ email: 'a@b.es', create_user: true });
    expect(await refreshSession('r1')).toMatchObject({ access_token: 'nuevo', id: 'user-1' });
  });
});
