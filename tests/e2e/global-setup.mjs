import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// globalSetup для Playwright: запускает scripts/e2e/setup.mjs до всех тестов.
// Скрипт чистит данные с e2e marker phone и upsert'ит test-customer + tg_session.
export default async function globalSetup() {
  const here = dirname(fileURLToPath(import.meta.url))
  const setupScript = resolve(here, '..', '..', 'scripts', 'e2e', 'setup.mjs')

  execSync(`node "${setupScript}"`, { stdio: 'inherit' })
}
