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
  // Cleanup + upsert test-customer + tg_session перед всеми тестами.
  globalSetup: './tests/e2e/global-setup.mjs',
  fullyParallel: false, // shared DB-state — без параллельности тесты конфликтуют
  // retries=1 (не 2): второй ретрай редко спасает от настоящей флаки и сожрёт
  // ~2 минуты при workers=1. timeout=60s — тестам с сетью+SSR этого стоит.
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
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

  // CI: build + preview (продакшн-сборка делается отдельным шагом workflow ДО запуска,
  // preview стартует за секунды и детерминированно). turbo `dev` под webServer в CI не
  // взлетал (persistent-task + cold-start → таймаут). Локально — обычный `pnpm dev:*`
  // с reuseExistingServer. PORT прокидывается в preview (nitro слушает его).
  webServer: [
    {
      command: process.env.CI
        ? 'pnpm --filter storefront exec nuxt preview'
        : 'pnpm dev:storefront',
      // TRUST_PROXY+TRUSTED_IP_HEADER: включаем чтение x-real-ip из proxy-заголовка,
      // чтобы каждый заказ-сабмитящий спек (test.use extraHTTPHeaders) получал свой
      // rate-limit-бакет. Без этого 1-worker + один socket-IP = заказы в demo копятся
      // в окне orders:tenant-ip 5/60s → 6-й (promo-flow) ловит 429. env мёржится с
      // process.env (preview берёт supabase-ключи из окружения).
      env: process.env.CI
        ? { PORT: String(STOREFRONT_PORT), TRUST_PROXY: '1', TRUSTED_IP_HEADER: 'x-real-ip' }
        : undefined,
      // Health-check ИМЕННО на subdomain-хосте — прогревает tenant middleware
      // на тот хост, через который ходят тесты. /api/tenant?slug=… отвечает
      // 200 на любом хосте и не гарантирует что host-based resolver готов.
      url: `http://demo.localhost:${STOREFRONT_PORT}/api/tenant`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: process.env.CI ? 'pipe' : 'ignore',
      stderr: 'pipe',
    },
    {
      command: process.env.CI
        ? 'pnpm --filter admin exec nuxt preview'
        : 'pnpm dev:admin',
      env: process.env.CI ? { PORT: String(ADMIN_PORT) } : undefined,
      // /login — admin страница в SPA-режиме (через routeRules /**: ssr:false),
      // отдаёт shell с 200. /favicon.ico тоже подходит, но /login ближе к
      // реальному use case.
      url: `http://localhost:${ADMIN_PORT}/login`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: process.env.CI ? 'pipe' : 'ignore',
      stderr: 'pipe',
    },
  ],
})
