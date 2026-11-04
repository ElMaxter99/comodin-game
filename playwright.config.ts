import { defineConfig } from '@playwright/test';

// e2e: construye la app y la arranca en modo de desarrollo (PGlite en memoria). Uso: npm run e2e
// En el contenedor: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e
const PORT = 3113;
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH || undefined } },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`, timeout: 300_000, reuseExistingServer: !process.env.CI,
    env: { SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_ANON_KEY: '' },
  },
});
