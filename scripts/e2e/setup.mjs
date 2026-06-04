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
import { writeFileSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PHONE_MARKER = '+79990001234'
const TELEGRAM_ID = '999000001'
const SESSION_TOKEN_RETAIL = 'tgs_e2etest0000000000000000000000'
const SESSION_TOKEN_SERVICES = `${SESSION_TOKEN_RETAIL}:services`
const TOKEN_HASH_RETAIL = createHash('sha256').update(SESSION_TOKEN_RETAIL).digest('hex')
const TOKEN_HASH_SERVICES = createHash('sha256').update(SESSION_TOKEN_SERVICES).digest('hex')

const RETAIL_TENANT_SLUG = 'demo'
const SERVICES_TENANT_SLUG = 'services-start'

// Тестовый промокод для checkout-флоу (retail demo): 10% без min_order и без дат →
// валиден для любой непустой корзины. Идемпотентный DELETE+INSERT (UNIQUE по
// tenant_id+code), чтобы повторные прогоны не падали.
const PROMO_CODE = 'E2E10'
const PROMO_DISCOUNT_PERCENT = 10

// Admin login для E2E. Переиспользуем существующего owner-юзера demo-тенанта
// (demo@fastio.app) — пересоздавать в auth.users + auth.identities дорого,
// проще зарезетить пароль на известное значение. Локально безопасно: prod
// этого юзера не имеет.
const ADMIN_EMAIL = 'demo@fastio.app'
const ADMIN_PASSWORD = 'e2e-admin-pass-12345'

// Guard: setup мутирует auth.users (resets admin password). Бежит ТОЛЬКО против
// локально опубликованного Postgres на 54322 (дефолт supabase CLI). Production
// никогда не светит этот порт наружу — если контейнер форварднут с другого порта
// (ssh tunnel на prod), guard сработает и попросит явный override.
const ALLOWED_DB_PORT = '54322'

// project_id из supabase/config.toml. Имя контейнера supabase CLI:
// `supabase_db_<project_id>`. Сверяемся явно — защищает от случая «на машине
// два supabase-стека, оба форвардят :54322» (порт-guard не разрулил бы).
function loadProjectId() {
  const here = dirname(fileURLToPath(import.meta.url))
  const cfgPath = resolve(here, '..', '..', 'supabase', 'config.toml')
  const cfg = readFileSync(cfgPath, 'utf-8')
  const match = cfg.match(/^\s*project_id\s*=\s*"([^"]+)"/m)
  if (!match) throw new Error(`E2E setup: project_id not found in ${cfgPath}`)
  return match[1]
}
const PROJECT_ID = loadProjectId()
const EXPECTED_CONTAINER = `supabase_db_${PROJECT_ID}`

function findContainer() {
  const out = execSync('docker ps --filter "name=supabase" --format "{{.Names}}\\t{{.Ports}}"', { encoding: 'utf-8' })
  // Точный match по имени супабейз-контейнера ИМЕННО этого проекта (см.
  // EXPECTED_CONTAINER). Сабстринг `db` слишком широкий — может зацепить
  // соседний стек.
  const candidates = out.split('\n').filter((line) => line.startsWith(`${EXPECTED_CONTAINER}\t`))

  if (candidates.length === 0) {
    throw new Error(
      `E2E setup: container "${EXPECTED_CONTAINER}" not running. Run \`pnpm supabase:start\`.`,
    )
  }
  if (candidates.length > 1) {
    throw new Error(
      `E2E setup: multiple containers match "${EXPECTED_CONTAINER}" — ambiguous, refusing to mutate.`,
    )
  }

  const dbLine = candidates[0]

  // Защита: проверяем что контейнер публикует Postgres на :54322 (дефолт
  // локального supabase). Если кто-то форварднул prod через ssh tunnel или
  // изменил порт — бросаем. Override через E2E_ALLOW_DB_MUTATION=1.
  if (!process.env.E2E_ALLOW_DB_MUTATION && !dbLine.includes(`:${ALLOWED_DB_PORT}->5432`)) {
    throw new Error(
      `E2E setup: refused to run against container "${EXPECTED_CONTAINER}". `
      + `Expected Postgres published on :${ALLOWED_DB_PORT}, got "${dbLine.split('\t')[1]?.trim()}". `
      + `Override with E2E_ALLOW_DB_MUTATION=1 if you really mean it.`,
    )
  }

  return dbLine.split('\t')[0].trim()
}

function runSqlInContainer(container, sql) {
  // SQL содержит plaintext ADMIN_PASSWORD и UPDATE для auth.users.encrypted_password.
  // На общей dev-машине / CI runner оставлять файл — плохая гигиена. unlink в finally.
  const tmpFile = resolve('/tmp', `e2e-setup-${process.pid}-${Date.now()}.sql`)

  try {
    writeFileSync(tmpFile, sql, 'utf-8')
    execSync(`docker cp ${tmpFile} ${container}:/tmp/e2e-setup.sql`, { stdio: 'pipe' })
    const result = spawnSync('docker', ['exec', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/e2e-setup.sql'], {
      encoding: 'utf-8',
    })

    if (result.status !== 0) {
      console.error('E2E setup SQL failed:\n' + result.stderr)
      throw new Error(`psql exited with code ${result.status}`)
    }
  } finally {
    try {
      unlinkSync(tmpFile)
    } catch {
      // Already gone — ok.
    }
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
-- Заказы: и гостевые (customer_phone хранится нормализованным '7…' без '+', поэтому
-- матчим оба формата), и привязанные к тестовому customer (теперь tg-заказы линкуются
-- к customer_id — FK orders_customer_id_fkey иначе блокирует DELETE customers ниже).
DELETE FROM orders
WHERE customer_phone IN ('${PHONE_MARKER}', '${PHONE_MARKER.replace(/\D/g, '')}')
   OR customer_id IN (SELECT id FROM customers WHERE telegram_id = '${TELEGRAM_ID}');
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
  '${TOKEN_HASH_RETAIL}',
  '${TOKEN_HASH_SERVICES}'
);

INSERT INTO customer_sessions (token_hash, customer_id, tenant_id, telegram_id, expires_at)
SELECT '${TOKEN_HASH_RETAIL}', c.id, c.tenant_id, c.telegram_id, now() + interval '7 days'
FROM customers c
JOIN tenants t ON t.id = c.tenant_id
WHERE c.telegram_id = '${TELEGRAM_ID}' AND t.slug = '${RETAIL_TENANT_SLUG}';

INSERT INTO customer_sessions (token_hash, customer_id, tenant_id, telegram_id, expires_at)
SELECT '${TOKEN_HASH_SERVICES}',
       c.id, c.tenant_id, c.telegram_id, now() + interval '7 days'
FROM customers c
JOIN tenants t ON t.id = c.tenant_id
WHERE c.telegram_id = '${TELEGRAM_ID}' AND t.slug = '${SERVICES_TENANT_SLUG}';

-- Тестовый промокод для checkout-флоу (retail demo). Percent-скидка без
-- min_order_amount и без active_from/active_to → check_promo_code() считает его
-- валидным для любой непустой корзины. UNIQUE(tenant_id, code) → DELETE+INSERT.
DELETE FROM promo_codes
WHERE code = '${PROMO_CODE}'
  AND tenant_id = (SELECT id FROM tenants WHERE slug = '${RETAIL_TENANT_SLUG}');

INSERT INTO promo_codes (tenant_id, code, discount_type, discount_value, active)
SELECT id, '${PROMO_CODE}', 'percent', ${PROMO_DISCOUNT_PERCENT}, true
FROM tenants WHERE slug = '${RETAIL_TENANT_SLUG}';

-- Admin password reset: тест админки логинится по email/password через Supabase Auth.
-- Юзер уже существует (см. seed.sql), просто фиксируем пароль на известное значение.
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM auth.users WHERE email = '${ADMIN_EMAIL}';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'E2E setup: admin user "${ADMIN_EMAIL}" not found in auth.users (run seed first)';
  END IF;
END $$;

UPDATE auth.users
SET encrypted_password = crypt('${ADMIN_PASSWORD}', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email = '${ADMIN_EMAIL}';
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
    sessionTokenRetail: SESSION_TOKEN_RETAIL,
    sessionTokenServices: SESSION_TOKEN_SERVICES,
    retailTenantSlug: RETAIL_TENANT_SLUG,
    servicesTenantSlug: SERVICES_TENANT_SLUG,
    adminEmail: ADMIN_EMAIL,
    adminPassword: ADMIN_PASSWORD,
  }, null, 2), 'utf-8')

  console.log(`[e2e-setup] ✓ fixtures written to ${fixturesPath}`)
}

main()
