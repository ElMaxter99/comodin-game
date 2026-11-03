// Genera las capturas de docs/img/ con una partida de ejemplo (modo de desarrollo).
// Uso: npm run build && npm run docs:screenshots   (arranca su propio servidor en el puerto 3112)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = 3112, B = `http://localhost:${PORT}`, OUT = 'docs/img';
const server = spawn('npx', ['next', 'start', '-p', String(PORT)], { stdio: 'ignore' });
const stop = () => server.kill();
process.on('exit', stop);
for (let i = 0; i < 60; i++) { try { if ((await fetch(B)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const TV = { width: 1280, height: 720 }, PHONE = { width: 390, height: 780 };
const hostCtx = await browser.newContext({ viewport: TV, deviceScaleFactor: 2, baseURL: B });
const tvCtx = await browser.newContext({ viewport: TV, deviceScaleFactor: 2, baseURL: B });
const p1Ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, baseURL: B });
const host = await hostCtx.newPage(), tv = await tvCtx.newPage(), p1 = await p1Ctx.newPage();
const shot = async (page, name) => { await page.waitForTimeout(1800); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log(name); };
const post = async (path, data, headers = {}) => { const r = await hostCtx.request.post(path, { data, headers }); if (!r.ok()) throw new Error(path + ' ' + await r.text()); return r.json(); };

await host.goto('/'); await shot(host, '01-inicio');
const { room_code: code } = await post('/api/games', { name: 'Nochebuena en casa' });
const H = (d) => post(`/api/games/${code}/host`, d);
await H({ type: 'team', name: 'Los Renos', color: '#f87171' });
await H({ type: 'team', name: 'Los Elfos', color: '#34d399' });
await H({ type: 'question', text: '¿En qué país se celebra la Tomatina?', options: ['Italia', 'España', 'México', 'Portugal'], correct: 1, points: 100 });
await H({ type: 'question', text: 'Los renos de Papá Noel vuelan.', options: ['Verdadero', 'Falso'], correct: 0, points: 100 });
await H({ type: 'challenge', text: 'Imita un villancico sin usar palabras', points: 150 });
await host.goto(`/game/${code}/host`); await shot(host, '02-panel-sala');
await tv.goto(`/game/${code}/screen`); await shot(tv, '03-tv-sala');

// Jugador 1 (capitán de Los Renos) por la interfaz; jugador 2 (Los Elfos) por API.
await p1.goto(`/game/${code}/play`);
await p1.fill('input', 'Ana'); await shot(p1, '04-movil-unirse');
await p1.click('text=Entrar'); await p1.waitForSelector('text=Elige tu equipo');
await shot(p1, '05-movil-equipo');
await p1.click('text=Los Renos'); await p1.waitForSelector('text=capitán');
const j2 = await (await fetch(`${B}/api/games/${code}/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Luis' }) })).json();
const st = await (await fetch(`${B}/api/games/${code}/state`)).json();
const elfos = st.teams.find((t) => t.name === 'Los Elfos').id;
const P2 = (d) => fetch(`${B}/api/games/${code}/play`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-player-token': j2.token }, body: JSON.stringify(d) });
await P2({ type: 'team', team_id: elfos });
await shot(p1, '06-movil-espera');

await H({ type: 'start' }); await H({ type: 'open' });
await shot(tv, '07-tv-pregunta'); await shot(p1, '08-movil-pregunta');
await p1.click('text=50 %'); await shot(p1, '09-movil-comodin');
await p1.locator('button:not([disabled])', { hasText: 'España' }).click();
await P2({ type: 'answer', choice: 0 });
await shot(tv, '10-tv-resultado'); await shot(p1, '11-movil-acierto');
await host.reload(); await shot(host, '12-panel-ronda');

await H({ type: 'open' }); await H({ type: 'close' });
await H({ type: 'open' });
await shot(tv, '13-tv-reto'); await host.reload(); await shot(host, '14-panel-reto');
await H({ type: 'validate', success: true });
await H({ type: 'finish' });
await shot(tv, '15-tv-podio'); await shot(p1, '16-movil-final');
await browser.close(); stop();
