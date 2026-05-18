#!/usr/bin/env node
/**
 * E2E setup: cleanup тестовых данных + upsert test-customer + tg_session.
 *
 * Стратегия: НЕ создаём отдельных e2e-тенантов (overhead + дубль с demo).
 * Используем существующие локальные тенанты (`demo` retail, `services-start`
 * services). Все мутирующие тесты создают записи с marker phone
 * `+79990001234` — cleanup перед прогоном чистит только их. Manual testing
 * с этим phone не пересекается (юзер использует свой реальный).
 *
 * Запускается через playwright globalSetup перед всеми тестами.
 */
import { execSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PHONE_MARKER = '+79990001234'
const TELEGRAM_ID = '999000001'
const SESSION_TOKEN = 'tgs_e2etest0000000000000000000000'
const TOKEN_HASH = createHash('sha256').update(SESSION_TOKEN).digest('hex')

const RETAIL_TENANT_SLUG = 'demo'
const SERVICES_TENANT_SLUG = 'services-start'

function findContainer() {
  const out = execSync('docker ps --filter "name=supabase" --format "{{.Names}}"', { encoding: 'utf-8' })
  const dbContainer = out.split('\n').find((line) => /db/i.test(line))

  if (!dbContainer) {
    throw new Error('E2E setup: no Supabase DB container running (try `pnpm supabase:start`)')
  }

  return dbContainer.trim()
}

function runSqlInContainer(container, sql) {
  const tmpFile = resolve('/tmp', `e2e-setup-${Date.now()}.sql`)

  writeFileSync(tmpFile, sql, 'utf-8')

  execSync(`docker cp ${tmpFile} ${container}:/tmp/e2e-setup.sql`, { stdio: 'pipe' })
  const result = spawnSync('docker', ['exec', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/e2e-setup.sql'], {
    encoding: 'utf-8',
  })

  if (result.status !== 0) {
    console.error('E2E setup SQL failed:\n' + result.stderr)
    throw new Error(`psql exited with code ${result.status}`)
  }
}

const sql = `
\\set ON_ERROR_STOP on

-- Pre-flight: тенанты должны существовать локально (созданы вручную / seed.sql).
DO $$
DECLARE
  v_retail_id uuid;
  v_services_id uuid;
BEGIN
  SELECT id INTO v_retail_id FROM tenants WHERE slug = '${RETAIL_TENANT_SLUG}';
  IF v_retail_id IS NULL THEN
    RAISE EXCEPTION 'E2E setup: tenant "${RETAIL_TENANT_SLUG}" not found. Use existing local tenant or change RETAIL_TENANT_SLUG.';
  END IF;
  SELECT id INTO v_services_id FROM tenants WHERE slug = '${SERVICES_TENANT_SLUG}';
  IF v_services_id IS NULL THEN
    RAISE EXCEPTION 'E2E setup: tenant "${SERVICES_TENANT_SLUG}" not found.';
  END IF;
END $$;

-- Cleanup: удаляем данные с marker phone из прошлых прогонов.
DELETE FROM orders WHERE customer_phone = '${PHONE_MARKER}';
DELETE FROM reservations WHERE guest_phone = '${PHONE_MARKER}';
DELETE FROM appointments WHERE customer_id IN (
  SELECT id FROM customers WHERE phone = '${PHONE_MARKER}'
);
DELETE FROM appointment_groups WHERE customer_id IN (
  SELECT id FROM customers WHERE phone = '${PHONE_MARKER}'
);

-- Customer recreate: partial UNIQUE index (tenant_id, telegram_id) WHERE telegram_id IS NOT NULL
-- не поддерживает ON CONFLICT target → проще DELETE+INSERT. Cascade удалит sessions.
DELETE FROM customers WHERE telegram_id = '${TELEGRAM_ID}';

INSERT INTO customers (tenant_id, telegram_id, name, phone)
SELECT id, '${TELEGRAM_ID}', 'E2E Test Customer', '${PHONE_MARKER}'
FROM tenants WHERE slug IN ('${RETAIL_TENANT_SLUG}', '${SERVICES_TENANT_SLUG}');

-- Sessions: один token_hash на тенанта (token_hash UNIQUE → пересоздаём).
DELETE FROM customer_sessions WHERE token_hash IN (
  '${TOKEN_HASH}',
  '${createHash('sha256').update(SESSION_TOKEN + ':services').digest('hex')}'
);

INSERT INTO customer_sessions (token_hash, customer_id, tenant_id, telegram_id, expires_at)
SELECT '${TOKEN_HASH}', c.id, c.tenant_id, c.telegram_id, now() + interval '7 days'
FROM customers c
JOIN tenants t ON t.id = c.tenant_id
WHERE c.telegram_id = '${TELEGRAM_ID}' AND t.slug = '${RETAIL_TENANT_SLUG}';

INSERT INTO customer_sessions (token_hash, customer_id, tenant_id, telegram_id, expires_at)
SELECT '${createHash('sha256').update(SESSION_TOKEN + ':services').digest('hex')}',
       c.id, c.tenant_id, c.telegram_id, now() + interval '7 days'
FROM customers c
JOIN tenants t ON t.id = c.tenant_id
WHERE c.telegram_id = '${TELEGRAM_ID}' AND t.slug = '${SERVICES_TENANT_SLUG}';
`

function main() {
  const container = findContainer()

  console.log(`[e2e-setup] container: ${container}`)
  runSqlInContainer(container, sql)

  // Записываем фикстуры в tests/e2e/.fixtures.json для импорта из тестов.
  const fixturesPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'tests', 'e2e', '.fixtures.json')

  mkdirSync(dirname(fixturesPath), { recursive: true })
  writeFileSync(fixturesPath, JSON.stringify({
    phoneMarker: PHONE_MARKER,
    telegramId: TELEGRAM_ID,
    sessionTokenRetail: SESSION_TOKEN,
    sessionTokenServices: SESSION_TOKEN + ':services',
    retailTenantSlug: RETAIL_TENANT_SLUG,
    servicesTenantSlug: SERVICES_TENANT_SLUG,
  }, null, 2), 'utf-8')

  console.log(`[e2e-setup] ✓ fixtures written to ${fixturesPath}`)
}

main()
