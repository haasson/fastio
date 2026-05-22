import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

// globalSetup для Playwright: ветвится по наличию SUPABASE_STAGING_URL.
//
// Если SUPABASE_STAGING_URL задан — setupStaging():
//   - truncate E2E tenant data через service-role HTTP API (без docker)
//   - re-apply supabase/seed/e2e-staging.sql через psql
//
// Иначе — setupLocal():
//   - verbatim оригинальная реализация через scripts/e2e/setup.mjs (docker путь)
//
// ВАЖНО: автоматический fallback из staging в local при частично выставленном env
// ЗАПРЕЩЁН — единственный источник истины это наличие SUPABASE_STAGING_URL.
// Ref: Anti-pattern в .planning/phases/03-e2e-testing/03-RESEARCH.md
export default async function globalSetup() {
  if (process.env.SUPABASE_STAGING_URL) {
    await setupStaging()
  } else {
    await setupLocal()
  }
}

// setupLocal: оригинальная реализация verbatim — не менять поведение.
// Playwright HTML-report не записывает inherit-вывод globalSetup, поэтому
// захватываем stdout/stderr явно и печатаем сами перед выбрасыванием ошибки.
async function setupLocal() {
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

// setupStaging: staging-путь через Supabase service-role HTTP API + psql seed.
// Требует SUPABASE_STAGING_URL и SUPABASE_STAGING_SERVICE_ROLE_KEY.
// Выполняет: DELETE (FK-leaf-first) → psql -f e2e-staging.sql.
async function setupStaging() {
  // Проверяем наличие обоих обязательных env vars до любых действий.
  if (!process.env.SUPABASE_STAGING_URL) {
    throw new Error('[staging-setup] Missing env var: SUPABASE_STAGING_URL')
  }
  if (!process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY) {
    throw new Error('[staging-setup] Missing env var: SUPABASE_STAGING_SERVICE_ROLE_KEY')
  }
  if (!process.env.SUPABASE_STAGING_DB_URL) {
    throw new Error('[staging-setup] Missing env var: SUPABASE_STAGING_DB_URL')
  }

  const sb = createClient(
    process.env.SUPABASE_STAGING_URL,
    process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY,
  )

  const STAGING_TENANT_ID = 'e2e00000-0000-0000-0000-000000000002'

  // FK-leaf-first порядок — Pitfall 4 в RESEARCH.md.
  // DELETE вместо TRUNCATE CASCADE, потому что service-role HTTP API не поддерживает CASCADE.
  const TABLES_IN_ORDER = [
    'order_events', 'order_items', 'order_notes',
    'orders',
    'appointment_events', 'appointment_groups', 'appointments',
    'customer_sessions',
    'customers', 'branches',
    'tenant_members', 'tenant_roles', 'tenant_invitations',
    'tenants',
  ]

  for (const table of TABLES_IN_ORDER) {
    const field = table === 'tenants' ? 'id' : 'tenant_id'
    const { error } = await sb.from(table).delete().eq(field, STAGING_TENANT_ID)
    if (error) throw new Error(`[staging-setup] DELETE ${table} failed: ${error.message}`)
  }

  // Re-apply seed через psql с ON_ERROR_STOP=1.
  const here = dirname(fileURLToPath(import.meta.url))
  const seedPath = resolve(here, '..', '..', 'supabase', 'seed', 'e2e-staging.sql')

  const result = spawnSync(
    'psql',
    [process.env.SUPABASE_STAGING_DB_URL, '-v', 'ON_ERROR_STOP=1', '-f', seedPath],
    { encoding: 'utf-8' },
  )

  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)

  if (result.status !== 0) {
    throw new Error(
      `[staging-setup] seed apply failed (exit ${result.status}):\n${result.stderr || '(no output)'}`,
    )
  }

  console.log('[e2e] staging seed re-applied for tenant', STAGING_TENANT_ID)
}
