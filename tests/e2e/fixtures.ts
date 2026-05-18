import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// E2E фикстуры — статичные константы для тестов. Файл .fixtures.json пишется
// globalSetup (scripts/e2e/setup.mjs); поля совпадают с тем что в БД.
type Fixtures = {
  phoneMarker: string
  telegramId: string
  sessionTokenRetail: string
  sessionTokenServices: string
  retailTenantSlug: string
  servicesTenantSlug: string
}

const here = dirname(fileURLToPath(import.meta.url))
const raw = readFileSync(resolve(here, '.fixtures.json'), 'utf-8')

export const fixtures: Fixtures = JSON.parse(raw)

// Helper для тестов которым нужен залогиненный customer.
// Возвращает cookie-объект для Playwright context.addCookies / contextOptions.
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
