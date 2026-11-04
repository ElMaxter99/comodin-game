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

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await H({ type: 'start' }); await H({ type: 'open' });
await shot(tv, '07-tv-reparto');                       // reparto de la ronda (4 s)
await wait(4500);                                       // …y empiezan las cartas
await shot(tv, '08-tv-pregunta'); await shot(p1, '09-movil-pregunta');
await p1.click('text=Tachar dos'); await shot(p1, '10-movil-comodin');
await p1.click('text=Usar comodín'); await p1.waitForTimeout(1500);
await p1.locator('button.pcard', { hasText: 'España' }).click();
await shot(p1, '11-movil-confirmar');
await p1.click('text=Confirmar');
await P2({ type: 'answer', choice: 0 });               // todos han respondido: se cierra y empieza el suspense (3 s)
await p1.waitForTimeout(800);
await shot(tv, '12-tv-suspenso');
await wait(2600);                                       // revelación
await shot(tv, '13-tv-revelacion'); await shot(p1, '14-movil-acierto');
await host.reload(); await shot(host, '16-panel-ronda');
await wait(5000);                                       // tras unos segundos, el marcador
await shot(tv, '15-tv-marcador');

await H({ type: 'open' }); await wait(500); await H({ type: 'close' });
await H({ type: 'open' }); await wait(5500);
await shot(tv, '17-tv-reto'); await host.reload(); await shot(host, '18-panel-reto');
await H({ type: 'validate', success: true });
await H({ type: 'finish' });
await shot(tv, '19-tv-podio'); await shot(p1, '20-movil-final');

// ---- Tema Navidad y reglas extra (apuesta, mano segura, puntos crecientes)
await host.goto('/');
await host.getByRole('radio', { name: /Navidad/ }).click();
for (const n of [/Puntos crecientes/, /Mano segura/, /Apuesta/]) await host.getByRole('checkbox', { name: n }).click();
await shot(host, '21-inicio-navidad');
const { room_code: c2 } = await post('/api/games', { name: 'Nochebuena en casa', theme: 'navidad', growing_step: 100, safe_every: 2, bets_enabled: true });
const H2 = (d) => post(`/api/games/${c2}/host`, d);
await H2({ type: 'team', name: 'Los Renos', color: '#c62832' });
await H2({ type: 'team', name: 'Los Elfos', color: '#2f8f4e' });
for (const [t, o] of [['¿Cuántos renos tiran del trineo, sin contar a Rodolfo?', ['Cuatro', 'Ocho', 'Nueve', 'Doce']], ['¿De qué color es el gorro de Papá Noel?', ['Rojo', 'Azul', 'Verde', 'Negro']]]) {
  await H2({ type: 'question', text: t, options: o, correct: t.includes('renos') ? 1 : 0, points: 100 });
}
const tv2 = await (await browser.newContext({ viewport: TV, deviceScaleFactor: 2, baseURL: B })).newPage();
const pn = await (await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, baseURL: B })).newPage();
await tv2.goto(`/game/${c2}/screen`);
await pn.goto(`/game/${c2}/play`); await pn.fill('input', 'Ana'); await pn.click('text=Entrar'); await pn.click('text=Los Renos');
const jn = await (await fetch(`${B}/api/games/${c2}/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Luis' }) })).json();
const st2 = await (await fetch(`${B}/api/games/${c2}/state`)).json();
const PN2 = (d) => fetch(`${B}/api/games/${c2}/play`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-player-token': jn.token }, body: JSON.stringify(d) });
await PN2({ type: 'team', team_id: st2.teams.find((t) => t.name === 'Los Elfos').id });
await H2({ type: 'start' }); await H2({ type: 'open' }); await wait(4600);
await shot(tv2, '22-tv-navidad-pregunta');
await pn.locator('button.pcard', { hasText: 'Ocho' }).click();
await pn.getByRole('button', { name: '♥ Apostar la carta' }).click(); await shot(pn, '23-movil-apuesta');
await pn.getByRole('button', { name: 'Apostar', exact: true }).click(); await pn.waitForTimeout(1200);
await pn.click('text=Confirmar'); await PN2({ type: 'answer', choice: 0 });
await wait(3600); await shot(tv2, '24-tv-navidad-revelacion');
await wait(5000);
await H2({ type: 'open' }); await wait(4600);
await pn.locator('button.pcard', { hasText: 'Rojo' }).click(); await pn.click('text=Confirmar'); await PN2({ type: 'answer', choice: 1 });
await wait(9500); await shot(tv2, '25-tv-navidad-marcador');
await browser.close(); stop();
