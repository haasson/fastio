import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// globalSetup для Playwright: запускает scripts/e2e/setup.mjs до всех тестов.
// Скрипт чистит данные с e2e marker phone и upsert'ит test-customer + tg_session.
//
// Используем spawnSync с явным захватом stdout/stderr (не inherit) — Playwright
// HTML-report не записывает inherit-вывод globalSetup, и при failure в CI было
// бы непонятно что упало. Печатаем сами и бросаем с payload.
export default async function globalSetup() {
  const here = dirname(fileURLToPath(import.meta.url))
  const setupScript = resolve(here, '..', '..', 'scripts', 'e2e', 'setup.mjs')

  const result = spawnSync('node', [setupScript], { encoding: 'utf-8' })

  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)

  if (result.status !== 0) {
    throw new Error(
      `E2E globalSetup failed (exit ${result.status}):\n${result.stderr || result.stdout || '(no output)'}`,
    )
  }
}
