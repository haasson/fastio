import { defineConfig, devices } from '@playwright/test'

// PREPROD-024: Playwright E2E happy-path тесты для критичных флоу.
//
// Tenant routing в dev: middleware `apps/storefront/server/middleware/tenant.ts`
// резолвит тенанта по `<slug>.<host>`. RFC 6761 гарантирует резолв `*.localhost`
// → 127.0.0.1 на всех платформах, поэтому baseURL вида `e2e-retail.localhost:4711`
// работает без правки /etc/hosts. Каждый тестовый файл переопределяет baseURL
// под нужного тенанта (см. test.use в тестах).
//
// Локально dev-серверы переиспользуются (reuseExistingServer), в CI поднимаются
// заново через build+preview (быстрее cold start чем dev).

const STOREFRONT_PORT = 4711
const ADMIN_PORT = 4710

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // shared DB-state — без параллельности тесты конфликтуют
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 30_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',

  use: {
    // Дефолтный baseURL — storefront на e2e-retail тенанте.
    // Конкретные тесты переопределяют через test.use({ baseURL: ... }).
    baseURL: `http://e2e-retail.localhost:${STOREFRONT_PORT}`,
    trace: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Admin dev сервер в Playwright НЕ запускаем — известная Nuxt dev регрессия
  // «Vite Node IPC socket path not configured» крашит /login на 500 даже при
  // ssr:false (см. TECHDEBT). Storefront-only пока admin не пофикшен; для
  // admin тестов в будущем — `pnpm build && pnpm preview` или dev-фикс.
  webServer: [
    {
      command: 'pnpm dev:storefront',
      // /api/tenant с явным slug=demo — стабильный 200 health-check. Корень `/`
      // на storefront требует валидный tenant в host/query, иначе 404 (правильно).
      url: `http://localhost:${STOREFRONT_PORT}/api/tenant?slug=demo`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
})
