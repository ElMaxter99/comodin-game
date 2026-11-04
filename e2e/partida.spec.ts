import { test, expect, type Page, type Browser } from '@playwright/test';

const PHONE = { width: 390, height: 780 };

async function jugador(browser: Browser, code: string, nombre: string, equipo: string) {
  const ctx = await browser.newContext({ viewport: PHONE });
  const page = await ctx.newPage();
  await page.goto(`/game/${code}/play`);
  await page.fill('input', nombre);
  await page.click('text=Entrar');
  await page.click(`button:has-text("${equipo}")`);
  await expect(page.getByText('capitán')).toBeVisible();
  return page;
}
const elegir = async (p: Page, opcion: string) => { await p.locator('button.pcard', { hasText: opcion }).click(); };

test('partida completa: tema Navidad, puntos crecientes, mano segura y apuesta', async ({ browser }) => {
  // --- Presentador crea la partida con tema y reglas extra desde la pantalla de inicio
  const hostCtx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  const host = await hostCtx.newPage();
  await host.goto('/');
  await host.getByRole('radio', { name: /Navidad/ }).click();
  await expect(host.locator('html')).toHaveAttribute('data-theme', 'navidad');
  await host.getByRole('checkbox', { name: /Puntos crecientes/ }).click();
  await host.getByRole('checkbox', { name: /Mano segura/ }).click();
  await host.getByRole('checkbox', { name: /Apuesta/ }).click();
  await host.getByLabel('Nombre de la partida').fill('Nochebuena e2e');
  await host.getByRole('button', { name: 'Crear partida' }).click();
  await host.waitForURL(/\/game\/[A-Z0-9]+\/host/);
  const code = host.url().match(/game\/([A-Z0-9]+)\/host/)![1];
  await expect(host.locator('html')).toHaveAttribute('data-theme', 'navidad');

  // --- Contenido y equipos (por la propia interfaz del panel)
  for (const n of ['Los Renos', 'Los Elfos']) { await host.getByPlaceholder('Nombre del equipo').fill(n); await host.getByRole('button', { name: 'Añadir', exact: true }).click(); await expect(host.getByText(n).first()).toBeVisible(); }
  const pregunta = async (texto: string, ops: string[], correcta: number) => {
    await host.getByPlaceholder('Enunciado').fill(texto);
    for (let i = 0; i < 4; i++) await host.getByPlaceholder(`Opción ${'ABCD'[i]}`).fill(ops[i]);
    await host.getByLabel(`Correcta ${'ABCD'[correcta]}`).check();
    await host.getByRole('button', { name: 'Añadir pregunta' }).click();
    await expect(host.getByText(texto)).toBeVisible();
  };
  await pregunta('¿Cuántos renos tiran del trineo, sin Rodolfo?', ['Cuatro', 'Ocho', 'Nueve', 'Doce'], 1);
  await pregunta('¿De qué color es el gorro de Papá Noel?', ['Rojo', 'Azul', 'Verde', 'Negro'], 0);

  // --- TV y jugadores
  const tvCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const tv = await tvCtx.newPage();
  await tv.goto(`/game/${code}/screen`);
  await expect(tv.locator('html')).toHaveAttribute('data-theme', 'navidad');
  const p1 = await jugador(browser, code, 'Ana', 'Los Renos');
  const p2 = await jugador(browser, code, 'Luis', 'Los Elfos');
  await expect(tv.getByText('Los Renos').first()).toBeVisible();

  await host.getByRole('button', { name: 'Empezar partida' }).click();
  await expect(host.getByText(/Lanzar siguiente/)).toBeVisible();
  await expect(host.getByText(/La próxima vale 100 pts/)).toBeVisible();

  // --- Ronda 1: Los Renos apuestan y aciertan (100 × 2); Los Elfos fallan
  await host.getByRole('button', { name: /Lanzar siguiente/ }).click();
  await expect(tv.getByText('puntos en juego')).toBeVisible();          // reparto
  await expect(tv.locator('.qcard')).toContainText('renos');              // carta de pregunta tras el reparto
  await elegir(p1, 'Ocho');
  await p1.getByRole('button', { name: '♥ Apostar la carta' }).click();
  await expect(p1.getByText('Si acertáis, ganáis')).toContainText('200');
  await p1.getByRole('button', { name: 'Apostar', exact: true }).click();
  await expect(p1.getByRole('button', { name: '♥ Carta apostada' })).toBeVisible();
  await p1.getByRole('button', { name: /Confirmar B/ }).click();
  await elegir(p2, 'Cuatro');
  await p2.getByRole('button', { name: /Confirmar A/ }).click();
  // suspense: la TV no dice cuál es la correcta
  await expect(tv.getByText('Luces bajas')).toBeVisible();
  await expect(tv.locator('.card.correct')).toHaveCount(0);
  await expect(tv.locator('.card.correct')).toHaveCount(1, { timeout: 15_000 });   // revelación
  await expect(p1.getByText('¡Correcto!')).toBeVisible();
  await expect(p1.getByText('+200')).toBeVisible();
  await expect(p2.getByText('Esta vez no')).toBeVisible();
  await expect(tv.locator('.hand', { hasText: 'Los Renos' })).toContainText('♥');   // la apuesta se ve al revelar

  // --- Ronda 2: puntos crecientes (200); Los Renos no pueden volver a apostar
  await expect(host.getByText(/La próxima vale 200 pts/)).toBeVisible();
  await host.getByRole('button', { name: /Lanzar siguiente/ }).click();
  await expect(tv.getByText('200', { exact: true }).first()).toBeVisible();
  await expect(tv.locator('.qcard')).toContainText('gorro');
  await expect(p1.getByRole('button', { name: '♥ Apuesta ya usada' })).toBeDisabled();
  await elegir(p1, 'Rojo'); await p1.getByRole('button', { name: /Confirmar A/ }).click();
  await elegir(p2, 'Rojo'); await p2.getByRole('button', { name: /Confirmar A/ }).click();
  await expect(tv.locator('.card.correct')).toHaveCount(1, { timeout: 15_000 });

  // --- Marcador con mano segura y podio
  await expect(tv.getByText('Marcador')).toBeVisible({ timeout: 15_000 });
  await expect(tv.getByText(/segura/).first()).toBeVisible();
  await host.getByRole('button', { name: 'Terminar y ver podio' }).click();
  await expect(tv.getByText('¡Gran final!')).toBeVisible();
  await expect(p1.getByText('¡Gran final!')).toBeVisible();
  const ranking = await tv.locator('.card').allInnerTexts();
  expect(ranking.join(' ')).toMatch(/Los Renos\s+400/);   // 200 (apuesta ganada) + 200 (ronda 2, puntos crecientes)
  expect(ranking.join(' ')).toMatch(/Los Elfos\s+200/);
});

test('la partida base no muestra tema ni reglas extra', async ({ browser }) => {
  const ctx = await browser.newContext();
  const host = await ctx.newPage();
  await host.goto('/');
  await expect(host.locator('html')).not.toHaveAttribute('data-theme', /.+/);
  await host.getByRole('button', { name: 'Crear partida' }).click();
  await host.waitForURL(/\/game\/[A-Z0-9]+\/host/);
  await expect(host.locator('html')).not.toHaveAttribute('data-theme', /.+/);
  await expect(host.getByText('Equipos (0)')).toBeVisible();
});

test('el modo de desarrollo no exige entrar y el acceso por correo no está disponible', async ({ page }) => {
  const me = await (await page.request.get('/api/auth/me')).json();
  expect(me).toEqual({ mode: 'dev', host: true });
  const r = await page.request.post('/api/auth/login', { data: { email: 'a@b.es' }, headers: { origin: 'http://localhost:3113' } });
  expect(r.status()).toBe(409);
});
