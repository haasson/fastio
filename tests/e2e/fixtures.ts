import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// E2E фикстуры — статичные константы для тестов. Файл .fixtures.json пишется
// globalSetup (scripts/e2e/setup.mjs); поля совпадают с тем что в БД.
// Используем process.cwd() вместо import.meta.url — Playwright собирает spec'и
// в CJS-bundle и `import.meta` бьётся об "exports is not defined". CWD у
// playwright = корень repo (где лежит playwright.config.ts).
type Fixtures = {
  phoneMarker: string
  telegramId: string
  sessionTokenRetail: string
  sessionTokenServices: string
  retailTenantSlug: string
  servicesTenantSlug: string
  adminEmail: string
  adminPassword: string
}

const fixturesPath = resolve(process.cwd(), 'tests/e2e/.fixtures.json')

let raw: string
try {
  raw = readFileSync(fixturesPath, 'utf-8')
} catch (err) {
  if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
    throw new Error(
      `E2E fixtures missing: ${fixturesPath}\n`
      + `Run \`pnpm test:e2e:setup\` first (или \`pnpm test:e2e\` — globalSetup поднимет фикстуры).`,
    )
  }
  throw err
}

export const fixtures: Fixtures = JSON.parse(raw)

// Helper для тестов которым нужен залогиненный customer.
// Возвращает cookie-объект для Playwright context.addCookies / contextOptions.
//
// ⚠️ Сейчас только Chromium project в playwright.config.ts — Chromium прощает
// domain без leading dot для localhost. Если когда-нибудь добавят Firefox/Safari
// projects — `domain: '.<slug>.localhost'` или omit domain (с `url:` параметром
// addCookies) портативнее.
export function tgSessionCookie(vertical: 'retail' | 'services') {
  const token = vertical === 'retail' ? fixtures.sessionTokenRetail : fixtures.sessionTokenServices
  const slug = vertical === 'retail' ? fixtures.retailTenantSlug : fixtures.servicesTenantSlug

  return {
    name: 'tg_session',
    value: token,
    domain: `${slug}.localhost`,
    path: '/',
    httpOnly: true,
    secure: false,
    sameSite: 'Lax' as const,
  }
}
