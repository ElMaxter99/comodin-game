// Renderiza design/mockups/*.html a design/img/*.png (el «figma» de Comodín).
import { chromium } from 'playwright';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
for (const f of readdirSync('design/mockups').filter((x) => x.endsWith('.html'))) {
  const phone = f.startsWith('movil');
  const p = await b.newPage({ viewport: phone ? { width: 390, height: 780 } : { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
  await p.goto('file://' + resolve('design/mockups', f));
  await p.screenshot({ path: `design/img/${f.replace('.html', '.png')}` });
  console.log(f);
}
await b.close();
