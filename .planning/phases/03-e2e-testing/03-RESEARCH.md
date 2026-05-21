# Phase 3: E2E Testing — Research

**Researched:** 2026-05-21
**Domain:** Playwright E2E, Supabase staging, cross-tenant security testing, CI orchestration
**Confidence:** HIGH (codebase fully read, deferred plan read, existing test patterns verified)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| E2E-01 | Order P0 flow: клиент выбирает позиции → оформляет заказ → заказ появляется в панели заведения | Частично покрыт `order-flow.spec.ts` (до `/order/[id]`). Недостаёт части «заказ виден в admin-панели». Нужно расширить тест или написать `order-in-admin.spec.ts`. |
| E2E-02 | Auth flow: регистрация нового тенанта, вход существующего пользователя, инвайт-ссылка сотрудника | Вход покрыт `admin-login.spec.ts`. Регистрация нового тенанта — landing form (порт 4713) + invite email + set-password. Инвайт сотрудника — through `team` feature API → `set-password` page. Оба отсутствуют. |
| E2E-03 | Cross-tenant isolation: tenant-A сессия не видит данные tenant-B через любой API-эндпоинт | Отсутствует. Реализуется как API-тест через Playwright `request` (не UI). Storefront tenantDb прокси + RLS — механизм защиты. |
| E2E-04 | Onboarding владельца: регистрация → создание заведения → настройка меню → публикация витрины | Отсутствует. Полная автоматизация возможна только если seed создаёт fresh-tenant без онбординг-state (все шаги непройдены). Landing форму в CI обходим через seed + прямой login. |
| SEC-04 | Staging environment: отдельный Supabase Cloud проект, изолированный от production | Готовая спека в `SEC-04-staging-supabase-e2e-PLAN.md` (был план 01-04). Содержит 5 задач включая blocking human action. |
</phase_requirements>

---

## Summary

Phase 3 строится поверх мощной существующей E2E-инфраструктуры. В репозитории уже есть Playwright 1.60, работающий набор из 8 спеков, `global-setup.mjs` с docker-ветвью, CI-воркфлоу `e2e-smoke.yml` и `e2e-nightly.yml`, фикстурная система с `phones marker` и `tg_session` cookies.

**Ключевой факт:** фаза делится на два независимых трека. Трек A (SEC-04) — инфраструктурный: создать staging Supabase Cloud проект, добавить push миграций в `migrate.yml`, написать `e2e-staging.sql` и переписать `global-setup.mjs` под dual-path. Это блокирующий prerequisites — без него E2E в CI завязан на локальный docker. Трек B (E2E-01—04) — содержательный: написать новые спеки и добавить в них недостающие ассерты. Трек A должен стартовать первым, но Трек B можно начать параллельно и запускать локально.

**Главные находки по гэпам текущего покрытия:** `order-flow.spec.ts` не проверяет admin-панель (только `/order/[id]` на витрине). Инвайт-флоу для сотрудника нигде не тестируется. Cross-tenant тест отсутствует полностью — он реализуется как API-тест без UI. Onboarding-wizard не имеет `data-testid` ни на одном компоненте — перед написанием E2E-04 нужно их добавить.

**Primary recommendation:** реализовать SEC-04 первой задачей (blocking human action), затем параллельно: расширить `order-flow.spec.ts` (admin verification) и писать новые спеки. E2E-04 требует добавления `data-testid` в onboarding-компоненты как Wave 0 задачу.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Staging DB setup | CI / GitHub Actions | Supabase Cloud | migrate.yml пушит миграции; seed применяется через psql в global-setup |
| Storefront E2E tests | Browser / Playwright | Storefront SSR | Тесты ходят через HTTP как браузер, Nitro обрабатывает tenant routing |
| Admin E2E tests | Browser / Playwright | Admin SPA (CSR) | Admin — чистая SPA без SSR, все данные через Supabase anon+RLS |
| Cross-tenant isolation test | API / Playwright request | Storefront Server | Прямые HTTP-запросы с манипуляцией Host-хедером, без UI |
| E2E seed / fixture reset | Global Setup (Node.js) | Supabase Service Role | `global-setup.mjs` делает DELETE+INSERT через service-role HTTP API |
| E2E workflows в CI | GitHub Actions | — | `e2e-smoke.yml` (per PR), `e2e-nightly.yml` (cron) |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@playwright/test` | 1.60.0 [VERIFIED: node_modules] | E2E browser automation | Уже установлен, конфиг готов |
| `@supabase/supabase-js` | 2.98.0 [VERIFIED: package.json] | Service-role DB operations в global-setup | Уже в deps, используется в setup |
| `supabase` CLI | 2.75.0 [VERIFIED: local] | `supabase db push --db-url` для staging migrations | Уже установлен, в `setup-cli@v1` в CI |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `supabase/setup-cli@v1` GitHub Action | latest pinned at v1 [ASSUMED] | Install supabase CLI в CI runner | В migrate.yml для staging push step |
| `psql` | system [VERIFIED: docker inside container] | Apply e2e-staging.sql в global-setup.mjs | Через psql connection string к Supabase Cloud |

**Замечание:** psql не установлен на devmachine разработчика (`psql not found` — verified), но установлен внутри docker контейнера supabase. Для staging-пути в `global-setup.mjs` psql вызывается через `SUPABASE_STAGING_DB_URL` — на Ubuntu CI-runner psql доступен как пакет `postgresql-client` или через `apt-get`.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| psql для seed apply в staging | Supabase JS client `.rpc()` с SECURITY DEFINER функцией | Требует дополнительной миграции; psql проще и уже в SEC-04 спеке |
| `supabase db push --db-url` | `supabase link + db push` | `--db-url` — прямее, не требует auth session; в SEC-04 спеке выбран именно этот путь |

---

## Package Legitimacy Audit

Фаза не устанавливает новых npm пакетов. Все зависимости уже в `pnpm-lock.yaml`.

| Package | Registry | Status | Disposition |
|---------|----------|--------|-------------|
| `@playwright/test` | npm | Уже установлен v1.60.0 | Approved |
| `@supabase/supabase-js` | npm | Уже установлен v2.98.0 | Approved |

**Packages removed due to slopcheck:** none — новые пакеты не устанавливаются.

---

## Architecture Patterns

### System Architecture Diagram

```
Playwright test runner (CI / localhost)
         │
         ├─── Browser context (chromium) ──────────────► Storefront (4711, SSR, Nitro)
         │                                                    │ tenant.ts middleware (Host header)
         │                                                    ├─► /api/menu.get.ts  ─► Supabase (staging/local)
         │                                                    ├─► /api/orders.post.ts ─► Supabase
         │                                                    └─► /api/customer/* (tg_session cookie)
         │
         ├─── Browser context (chromium) ──────────────► Admin SPA (4710, CSR)
         │                                                    └─► Supabase anon key + RLS
         │
         ├─── API request context ─────────────────────► Storefront API (Host: tenant-A.localhost)
         │    (cross-tenant E2E-03)                          └─► verify 404/403/empty for tenant-B data
         │
         └─── global-setup.mjs (Node.js)
                  │
                  ├── SUPABASE_STAGING_URL present? ──► setupStaging()
                  │       ├── DELETE leaf-first (service-role HTTP)
                  │       └── psql -f e2e-staging.sql
                  │
                  └── absent ──────────────────────────► setupLocal()
                                  └── docker exec psql
```

### Recommended Project Structure
```
tests/e2e/
├── global-setup.mjs          # dual-path: local (docker) / staging (HTTP API)
├── fixtures.ts               # статические константы из .fixtures.json
├── .fixtures.json            # генерируется global-setup (gitignored)
├── smoke-storefront.spec.ts  # существует
├── smoke-admin.spec.ts       # существует
├── order-flow.spec.ts        # существует — НУЖНО РАСШИРИТЬ (admin-side check)
├── admin-login.spec.ts       # существует
├── account-auth.spec.ts      # существует
├── admin-create-dish.spec.ts # существует
├── appointment-flow.spec.ts  # существует
├── reservation-flow.spec.ts  # существует
├── auth-invite-staff.spec.ts # НОВЫЙ — E2E-02 (инвайт сотрудника)
├── auth-new-tenant.spec.ts   # НОВЫЙ — E2E-02 + E2E-04 (регистрация через seed)
├── cross-tenant.spec.ts      # НОВЫЙ — E2E-03 (API-тест без UI)
└── onboarding-flow.spec.ts   # НОВЫЙ — E2E-04 (wizard от логина до витрины)

supabase/seed/
└── e2e-staging.sql           # НОВЫЙ — минимальный seed для staging
```

### Pattern 1: Existing order flow — нужно добавить admin-side verification

**Что:** `order-flow.spec.ts` доходит до `/order/[id]` на витрине и останавливается. E2E-01 требует, чтобы заказ появился в admin-панели.

**Подход:** После `waitForURL(/\/order\//)` извлечь order UUID из URL, затем в НОВОМ `test.step` открыть admin-панель, залогиниться (или переиспользовать auth state), перейти в `/orders`, найти строку с `fixtures.phoneMarker`.

**Важный нюанс:** Admin работает на `localhost:4710`, а storefront на `e2e-retail.localhost:4711`. Playwright поддерживает `page.goto()` на другой базовый URL в рамках одного теста — достаточно передать абсолютный URL.

```typescript
// Source: tests/e2e/order-flow.spec.ts (текущий паттерн + расширение)
// После submit order:
const orderUrl = page.url()
const orderId = orderUrl.split('/order/')[1]

// Open admin in the same context (or new page)
const adminPage = await context.newPage()
await adminPage.goto(`http://localhost:4710/login`)
await adminPage.getByTestId('admin-login-email').locator('input').fill(fixtures.adminEmail)
await adminPage.getByTestId('admin-login-password').locator('input').fill(fixtures.adminPassword)
await adminPage.getByTestId('admin-login-submit').click()
await expect(adminPage.getByTestId('admin-nav')).toBeVisible({ timeout: 20_000 })
await adminPage.goto(`http://localhost:4710/orders`)
// найти заказ по номеру телефона маркера
await expect(adminPage.locator(`text=${fixtures.phoneMarker}`)).toBeVisible({ timeout: 15_000 })
```

### Pattern 2: Cross-tenant isolation test (E2E-03) — API-тест

**Что:** Не UI-тест, а HTTP-запрос с кукой от tenant-A к API-эндпоинту tenant-B через манипуляцию Host-хедером.

**Механизм:** Storefront Nitro tenant middleware резолвит tenant из `Host` хедера. `tenantDb` Proxy инжектит `.eq('tenant_id', db.tenantId)` на все запросы. RLS дополнительно защищает на уровне Supabase.

**Как тестировать:** В `fixtures.ts` уже есть `sessionTokenRetail` (cookie `tg_session` для `demo`). Сделать HTTP GET к `/api/customer/orders` с `Host: e2e-retail.localhost:4711` (tenant A) с токеном — ожидать 200. Затем тот же запрос с `Host: services-start.localhost:4711` (tenant B) — ожидать 404 (customer не существует в этом tenant) или пустой массив.

```typescript
// Source: Playwright docs — page.request / apiRequestContext
// В cross-tenant.spec.ts:
test('customer session for tenant-A returns empty/404 when requesting tenant-B API', async ({ request }) => {
  // tenant-A запрос — ожидаем 200 (customer существует в demo)
  const responseA = await request.get('http://localhost:4711/api/customer/orders', {
    headers: {
      'Host': 'demo.localhost:4711',
      'Cookie': `tg_session=${fixtures.sessionTokenRetail}`,
    },
  })
  expect(responseA.status()).toBe(200)

  // tenant-B запрос — тот же токен, другой Host → другой tenantId → customer не найден
  const responseB = await request.get('http://localhost:4711/api/customer/orders', {
    headers: {
      'Host': 'services-start.localhost:4711',
      'Cookie': `tg_session=${fixtures.sessionTokenRetail}`,
    },
  })
  // 401 (session не привязана к этому tenant) или 404 (customer не найден)
  expect([401, 403, 404]).toContain(responseB.status())
})
```

**Важно:** Для staging эти спеки нужно адаптировать: там один `e2e` тенант, второй тенант нужно либо добавить в seed, либо использовать другой slug.

### Pattern 3: Onboarding flow (E2E-04) — предусловия

**Проблема:** Onboarding components (`OnboardingWizard.vue`, `OnboardingStepType.vue` и т.д.) **не имеют ни одного `data-testid`** — verified по grep. Написать устойчивый тест без них невозможно.

**Решение (Wave 0):** Добавить `data-testid` в ключевые компоненты:
- `OnboardingWizard.vue` → `data-testid="onboarding-wizard"`
- кнопка «Далее»/«Продолжить» в каждом шаге → `data-testid="onboarding-next"`
- выбор бизнес-типа → `data-testid="onboarding-type-retail"` / `onboarding-type-services`
- кнопка «Открыть витрину» на финальном шаге → `data-testid="onboarding-open-storefront"`
- сайдбар-ссылка на онбординг → `data-testid="admin-nav-onboarding"`

**Что означает «publish storefront»:** Нет отдельной кнопки «опубликовать». В онбординге последний шаг — `testOrderStep` / `testBookingStep` с `externalTarget: 'storefront'`. «Достигнуть опубликованного storefront» = кликнуть эту кнопку в онбординге и убедиться, что открывается витрина (страница с `<body>` без 404).

**E2E-04 seed requirement:** Для staging нужен tenant без `onboarding_state` (все шаги непройдены). Текущий `e2e-staging.sql` (из SEC-04 спеки) создаёт tenant — нужно убедиться, что `onboarding_state` не заполнен (NULL по умолчанию) и что tenant имеет хотя бы одну category и один dish в seed (они нужны для шага «настройка меню»).

**Ограничение «регистрации» в E2E-04:** Полный флоу «landing форма → invite email → set-password» нельзя автоматизировать в CI без email-интерцепции. Локально Inbucket (порт 54324) доступен, но его API нестандартен и добавляет хрупкость. **Рекомендация:** E2E-04 начинается с логина уже существующего владельца (из seed) в admin-панель — это «регистрация в смысле первого входа». Если требуется тест самого registration form — выделить в отдельный `auth-new-tenant.spec.ts` и пометить `@local-only` (только локально через Inbucket).

### Pattern 4: staff invite link (E2E-02)

Флоу: admin-панель → `/team` → «Пригласить» → API вызывает `invite-member` edge function → возвращает invite token → тест получает токен через API напрямую (не через email) → переходит на `/invite?token=...` → `/set-password` → регистрирует сотрудника.

**Как получить токен без email:** Тест логинится как admin, через `page.evaluate` или через Playwright `request` вызывает Supabase функцию `invite-member` напрямую (с anon key + Supabase auth header), получает созданный токен из ответа. Альтернатива: использовать service-role для прямого SELECT из `tenant_invitations` после создания.

```typescript
// После нажатия "Пригласить" в UI admin — получить токен через DB (staging path):
const { data } = await supabaseServiceRole.from('tenant_invitations')
  .select('token')
  .eq('email', INVITE_EMAIL)
  .order('created_at', { ascending: false })
  .limit(1)
  .single()
const inviteToken = data.token
```

### Anti-Patterns to Avoid
- **Параллельные workers при shared DB:** `fullyParallel: false, workers: 1` уже выставлены в `playwright.config.ts`. Не менять — при shared DB state тесты конфликтуют.
- **Hardcode demo slug в staging спеках:** Staging seed использует slug `e2e`, а не `demo`. Тесты должны читать slug из env или fixtures.
- **Запускать E2E против production:** `global-setup.mjs` содержит guard проверяющий порт `54322`. Для staging — аналогичный guard через `process.env.SUPABASE_STAGING_URL`.
- **email-зависимый тест без Inbucket:** Тест, который ждёт email без перехвата, будет вечно висеть. Для E2E в CI — всегда получать invite token из DB напрямую.
- **Тест E2E-04 без data-testid в onboarding:** Без testid тест будет хрупким и зависит от текста кнопок, который может измениться при локализации.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Waiting for async state in UI | `page.waitForTimeout(ms)` | `waitFor({ state: 'visible' })`, `expect().toBeVisible()` | timeout-based waits — источник флаки; auto-retry Playwright делает за нас |
| Custom test isolation | Ручной DELETE в каждом тесте | `global-setup.mjs` cleanup + seed + `afterAll` для специфичных данных | Централизованный cleanup надёжнее |
| Email link retrieval | Парсинг email через IMAP | `supabaseServiceRole.from('tenant_invitations').select('token')` | Токен уже в БД; email — ненужный посредник для автотестов |
| Cross-tenant validation | Проверять бизнес-логику в тесте | RLS проверяет сам Supabase; тест только утверждает HTTP-статус | Тест не должен дублировать логику, только верифицировать поведение |
| Multiple browser instances | Открывать новый браузер для admin в том же тесте | `context.newPage()` в том же browser context | Переиспользование context быстрее и память экономит |

---

## Common Pitfalls

### Pitfall 1: Staging seed не содержит нужных онбординг-данных
**What goes wrong:** E2E-04 тест падает при попытке «настроить меню» — нет категории или блюда в seed.
**Why it happens:** SEC-04 спека пишет seed с «at least one category and one dish» — но если в реализации их забудут добавить.
**How to avoid:** Явно проверить в seed: `SELECT count(*) FROM dishes WHERE tenant_id = 'e2e-tenant-uuid'` ≥ 1.
**Warning signs:** Тест падает на шаге категории/блюда с ошибкой «нет элементов».

### Pitfall 2: demo slug захардкожен в тестах, упадёт на staging
**What goes wrong:** `smoke-storefront.spec.ts` использует `http://demo.localhost:4711` — на staging tenant slug `e2e`.
**Why it happens:** Существующие тесты написаны для локального demo seed.
**How to avoid:** Параметризовать baseURL через env var или fixtures; добавить `E2E_TENANT_SLUG=demo` (local) / `E2E_TENANT_SLUG=e2e` (staging).
**Warning signs:** Staging E2E видит 503 (tenant not found) на demo.localhost.

### Pitfall 3: Admin panel order verification — ненадёжный poller
**What goes wrong:** Заказ создаётся на витрине, но admin panel ещё не получил Realtime-апдейт — тест падает.
**Why it happens:** Supabase Realtime + Pinia store обновляются асинхронно; `toBeVisible` не знает о задержке.
**How to avoid:** Использовать `expect(locator).toBeVisible({ timeout: 15_000 })` — Playwright retry-safe. Если 15s не хватает, увеличить до 30s для этого конкретного assertion.
**Warning signs:** Тест нестабильно проходит, 50/50 при повторных запусках.

### Pitfall 4: FK-leaf-first порядок при truncate в global-setup staging
**What goes wrong:** `global-setup.mjs` пытается DELETE FROM `tenants` пока существуют дочерние записи → FK violation → setup падает.
**Why it happens:** Staging truncate через HTTP API (не TRUNCATE CASCADE) требует ручной FK-leaf-first сортировки.
**How to avoid:** Порядок из SEC-04 спеки (verified): `order_events → orders → appointments → customer_sessions → customers → branches → tenant_members → tenants`.
**Warning signs:** `global-setup.mjs` бросает ошибку с упоминанием foreign key constraint.

### Pitfall 5: `psql` отсутствует на ubuntu-latest runner
**What goes wrong:** Staging global-setup пытается вызвать `psql` для apply e2e-staging.sql — command not found.
**Why it happens:** Ubuntu runner не включает postgresql-client по умолчанию.
**How to avoid:** Добавить шаг в CI workflow перед e2e: `sudo apt-get install -y postgresql-client`. Или использовать supabase JS client с direct SQL через `rpc` (требует SECURITY DEFINER функции).
**Warning signs:** `spawnSync psql` в global-setup возвращает status=127.

### Pitfall 6: Onboarding wizard без data-testid — хрупкий тест
**What goes wrong:** E2E-04 использует `page.getByText('Далее')` вместо `getByTestId('onboarding-next')` → падает при любом изменении текста кнопки.
**Why it happens:** Ни один компонент onboarding wizard не имеет `data-testid` (grep подтвердил).
**How to avoid:** Добавить testid в Wave 0 плана — до написания spec файла.
**Warning signs:** Тест ищет элементы по тексту на кириллице.

### Pitfall 7: E2E-02 «регистрация нового тенанта» требует email
**What goes wrong:** Тест регистрирует через landing form → ждёт invite email → зависает навсегда.
**Why it happens:** Real email delivery невозможна в CI без mock-сервера.
**How to avoid:** Два варианта: (a) использовать Inbucket API `GET http://localhost:54324/api/v1/mailbox/<email>` для перехвата письма локально; (b) для staging — создавать tenant через service-role API напрямую, минуя форму регистрации. E2E-02 «new tenant registration» в CI = логин freshly-created owner из seed, не прохождение landing form.
**Warning signs:** globalSetup или тест делает network request к внешнему SMTP.

---

## Runtime State Inventory

> Фаза добавляет новые файлы и не переименовывает существующие. Раздел применим частично — для нового staging-контекста.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Supabase staging DB — пустая при создании | Apply `supabase db push --db-url` + run `e2e-staging.sql` seed (Task 1+3 в SEC-04) |
| Live service config | GitHub Secrets: 4 новых (`SUPABASE_STAGING_URL`, `SUPABASE_STAGING_ANON_KEY`, `SUPABASE_STAGING_SERVICE_ROLE_KEY`, `SUPABASE_STAGING_DB_URL`) | Human action — создать Supabase Cloud проект + добавить secrets |
| OS-registered state | None — нет новых systemd/cron регистраций | None |
| Secrets/env vars | `.env.local` на машине разработчика для локального теста staging-path | Добавить `SUPABASE_STAGING_*` переменные локально для проверки |
| Build artifacts | `tests/e2e/.fixtures.json` — перегенерируется при каждом запуске setup | None — gitignored |

---

## Code Examples

### global-setup.mjs staging path (из SEC-04 спеки)
```javascript
// Source: .planning/deferred/SEC-04-staging-supabase-e2e-PLAN.md — Task 4
import { createClient } from '@supabase/supabase-js'
const STAGING_TENANT_ID = 'e2e00000-0000-0000-0000-000000000002'
const TABLES_IN_ORDER = [
  'order_events', 'order_items', 'order_notes',
  'orders',
  'appointment_events', 'appointment_groups', 'appointments',
  'customer_sessions',
  'customers', 'branches',
  'tenant_members', 'tenant_roles', 'tenant_invitations',
  'tenants',
]
async function setupStaging() {
  const sb = createClient(process.env.SUPABASE_STAGING_URL, process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY)
  for (const table of TABLES_IN_ORDER) {
    const field = table === 'tenants' ? 'id' : 'tenant_id'
    const { error } = await sb.from(table).delete().eq(field, STAGING_TENANT_ID)
    if (error) throw new Error(`[staging-setup] DELETE ${table} failed: ${error.message}`)
  }
  // psql seed apply
  const { status, stderr } = spawnSync('psql', [process.env.SUPABASE_STAGING_DB_URL, '-v', 'ON_ERROR_STOP=1', '-f', seedPath], { encoding: 'utf-8' })
  if (status !== 0) throw new Error(`[staging-setup] seed apply failed:\n${stderr}`)
  console.log('[e2e] staging seed re-applied for tenant', STAGING_TENANT_ID)
}
```

### cross-tenant API test pattern (E2E-03)
```typescript
// Source: Playwright 1.60 APIRequestContext docs [ASSUMED]
// tests/e2e/cross-tenant.spec.ts
import { test, expect } from '@playwright/test'
import { fixtures } from './fixtures'

test('cross-tenant isolation: session for tenant-A returns 401/404 when requesting tenant-B', async ({ request }) => {
  // Запрос к tenant-A — ожидаем 200 или 401 (customer может не существовать в staging e2e tenant)
  const resA = await request.get('http://localhost:4711/api/customer/orders', {
    headers: {
      'Host': `${fixtures.retailTenantSlug}.localhost:4711`,
      'Cookie': `tg_session=${fixtures.sessionTokenRetail}`,
    },
  })
  // tenant-A должен либо вернуть данные либо 401 (если customer не существует в этом env)
  expect(resA.status()).not.toBe(403)

  // Тот же токен, но чужой tenant через Host header
  const resB = await request.get('http://localhost:4711/api/customer/orders', {
    headers: {
      'Host': `${fixtures.servicesTenantSlug}.localhost:4711`,
      'Cookie': `tg_session=${fixtures.sessionTokenRetail}`,
    },
  })
  // tg_session привязана к tenant_id tenant-A — для tenant-B 401 или 404
  expect([401, 403, 404]).toContain(resB.status())
})
```

### e2e-staging.sql структура (из SEC-04 спеки)
```sql
-- Source: .planning/deferred/SEC-04-staging-supabase-e2e-PLAN.md — Task 3
DO $$ DECLARE
  _owner_id uuid := 'e2e00000-0000-0000-0000-000000000001';
  _tenant_id uuid := 'e2e00000-0000-0000-0000-000000000002';
  _branch_id uuid := 'e2e00000-0000-0000-0000-000000000003';
  _cat_id uuid := 'e2e00000-0000-0000-0000-000000000004';
  _dish_id uuid := 'e2e00000-0000-0000-0000-000000000005';
BEGIN
  -- auth.users with known password
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, ...)
  VALUES (_owner_id, 'e2e@fastio.app', crypt('e2e-pass-12345', gen_salt('bf')), now(), ...)
  ON CONFLICT (id) DO UPDATE SET encrypted_password = crypt('e2e-pass-12345', gen_salt('bf'));
  -- tenants, tenant_members, branches, categories, dishes
  -- ... ON CONFLICT (id) DO NOTHING
END $$;
RAISE NOTICE 'E2E staging seed applied';
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| E2E только локально через docker | Dual-path: local (docker) + staging (HTTP API) | Phase 3 | CI E2E не зависит от docker |
| Demo tenant с демо-данными | E2E tenant с фиксированными UUID | Phase 3 | Предсказуемые fixture values |
| globalSetup только через docker exec | globalSetup через Supabase JS client (service-role) для staging | Phase 3 | Нет dependency на docker в CI staging path |

**Устаревшее:**
- Использование `demo@fastio.app` и демо-пароля для staging тестов: на staging owner — `e2e@fastio.app` / `e2e-pass-12345`.

---

## Open Questions

1. **psql на ubuntu-latest CI runner**
   - Что знаем: ubuntu-latest не включает `postgresql-client` по умолчанию
   - Что неясно: есть ли `postgresql-client` в pre-installed packages GitHub runners
   - Recommendation: добавить шаг `sudo apt-get install -y postgresql-client` в e2e-smoke.yml и e2e-nightly.yml staging path; либо переключиться на Supabase JS RPC для seed apply

2. **Как staging URL прокидывается в Playwright webServer**
   - Что знаем: текущий `playwright.config.ts` запускает `pnpm dev:storefront` и `pnpm dev:admin` — это локальные команды
   - Что неясно: как в staging CI запустить storefront и admin против staging Supabase URL (нужны env vars `NUXT_PUBLIC_SUPABASE_URL`, `NUXT_PUBLIC_SUPABASE_ANON_KEY` в CI)
   - Recommendation: в e2e-smoke.yml добавить `env:` секцию с `NUXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_STAGING_URL }}` и `NUXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_STAGING_ANON_KEY }}`

3. **Два тенанта в staging для E2E-03**
   - Что знаем: текущая SEC-04 спека создаёт 1 тенант (`e2e`)
   - Что неясно: нужен ли второй тенант (`e2e-b`) для cross-tenant теста на staging
   - Recommendation: добавить второй tenant в `e2e-staging.sql` с UUID `e2e00000-0000-0000-0000-000000000010` и slug `e2e-b`; либо использовать `e2e` slug как tenant-A и несуществующий slug для демонстрации 503 (tenant not found)

4. **E2E-04 без полного registration flow**
   - Что знаем: E2E-04 success criteria говорит «register → create venue → configure menu → publish»
   - Что неясно: принимается ли как «register» логин pre-seeded owner, или нужен именно landing form
   - Recommendation: [ASSUMED] CI-вариант = pre-seeded owner + admin login. Если нужен full registration, добавить отдельный `@local-only` тест с Inbucket

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js ≥ 20 | global-setup.mjs | ✓ | v20.20.0 | — |
| pnpm 9.15.0 | pnpm install | ✓ | 9.15.0 | — |
| supabase CLI 2.75.0 | `supabase db push` | ✓ | 2.75.0 | — |
| docker | setupLocal() path | ✓ | 29.2.1 | staging path не требует docker |
| psql client | staging global-setup (seed apply) | ✗ | — | `sudo apt-get install postgresql-client` в CI; или RPC fallback |
| Supabase Cloud project | staging path | ✗ | — | Blocking human action (Task 1 SEC-04) |
| GitHub Secrets (4 vars) | CI staging E2E | ✗ | — | Blocking human action (Task 1 SEC-04) |

**Missing dependencies with no fallback:**
- Supabase Cloud staging project + GitHub Secrets — блокирующий human action, без него staging CI E2E невозможен

**Missing dependencies with fallback:**
- psql на CI runner — установить через apt-get в workflow step

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.60.0 |
| Config file | `playwright.config.ts` |
| Quick run command | `pnpm exec playwright test smoke-storefront.spec.ts smoke-admin.spec.ts` |
| Full suite command | `pnpm test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-04 | Staging Supabase isolated from prod | Infrastructure / Human | — | ✗ Wave 0 (global-setup.mjs + e2e-staging.sql + migrate.yml) |
| E2E-01 | Order P0 flow + admin panel verification | E2E | `pnpm exec playwright test order-flow.spec.ts` | ⚠️ Частично (нужно расширить) |
| E2E-02 | Auth: existing user login | E2E | `pnpm exec playwright test admin-login.spec.ts` | ✅ |
| E2E-02 | Auth: staff invite link | E2E | `pnpm exec playwright test auth-invite-staff.spec.ts` | ✗ Wave 0 |
| E2E-02 | Auth: new tenant registration (local Inbucket) | E2E @local-only | `pnpm exec playwright test auth-new-tenant.spec.ts` | ✗ Wave 0 |
| E2E-03 | Cross-tenant isolation via API | API test | `pnpm exec playwright test cross-tenant.spec.ts` | ✗ Wave 0 |
| E2E-04 | Owner onboarding wizard | E2E | `pnpm exec playwright test onboarding-flow.spec.ts` | ✗ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm exec playwright test smoke-storefront.spec.ts smoke-admin.spec.ts`
- **Per wave merge:** `pnpm test:e2e` (полный suite)
- **Phase gate:** 5 consecutive CI runs pass before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `supabase/seed/e2e-staging.sql` — covers SEC-04 (создать из спеки SEC-04-staging-supabase-e2e-PLAN.md)
- [ ] `tests/e2e/global-setup.mjs` — рефакторинг dual-path (SEC-04 Task 4)
- [ ] `.github/workflows/migrate.yml` — добавить staging push step (SEC-04 Task 2)
- [ ] `apps/admin/features/onboarding/components/*.vue` — добавить `data-testid` в OnboardingWizard, OnboardingStepType и кнопки навигации (required before E2E-04 spec)
- [ ] `tests/e2e/auth-invite-staff.spec.ts` — E2E-02 staff invite
- [ ] `tests/e2e/cross-tenant.spec.ts` — E2E-03
- [ ] `tests/e2e/onboarding-flow.spec.ts` — E2E-04
- [ ] e2e-smoke.yml и e2e-nightly.yml — добавить staging env vars + `postgresql-client` install step

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Playwright tests login flow; Supabase Auth (email+password) |
| V3 Session Management | yes | `tg_session` cookie tested in cross-tenant spec; HttpOnly, Lax |
| V4 Access Control | yes | E2E-03 verifies RLS + tenantDb proxy isolation |
| V5 Input Validation | no | Тестируется в unit tests |
| V6 Cryptography | no | bcrypt пароли в seed — только служебные |

### Known Threat Patterns for E2E Testing Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Staging credentials попадают в бандл или логи | Information Disclosure | Secrets только в GitHub Secrets, в CI env block; GitHub автоматически маскирует в логах |
| E2E тест случайно против production | Tampering | `global-setup.mjs` guard: staging path активируется только при явном SUPABASE_STAGING_URL |
| service_role key в тест-коде | Information Disclosure | service_role используется только в global-setup (Node.js), не в browser контексте |
| Tenant-A session видит tenant-B | Information Disclosure | E2E-03 тест верифицирует это; защита — RLS + tenantDb proxy |

---

## Project Constraints (from CLAUDE.md)

- **Стек:** Nuxt 3 / Vue 3 / Supabase — менять стек не планируется
- **НИКОГДА не запускать `supabase db reset`** — дропает всю базу
- **Коммиты без явного разрешения запрещены** (из MEMORY.md)
- **Auto-imports отключены** — все импорты явные; в `.mjs` файлах тоже (Node.js ESM requires)
- **Тест-стратегия:** E2E для критических флоу достаточно для запуска; unit-тесты бизнес-логики как бонус
- **`type` вместо `interface`** для TypeScript типов
- **`console.log()` заменён на `console.warn`/`console.error`** — но в E2E setup скриптах (`setup.mjs`, `global-setup.mjs`) используется `console.log` — это допустимо в `.mjs` Node.js скриптах вне Nuxt контекста, ESLint не применяется к этим файлам
- **Стили — только в scoped styles** — не релевантно для E2E

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `supabase/setup-cli@v1` GitHub Action существует и поддерживает `version: 2.75.0` | Standard Stack | Staging push в migrate.yml не сработает; alternative: curl install |
| A2 | Playwright 1.60 `request` fixture поддерживает кастомные `Host` headers | Code Examples (E2E-03) | Cross-tenant тест нужно переписать через curl/fetch |
| A3 | E2E-04 «регистрация» принимается как логин pre-seeded owner, а не full landing form | Open Questions #4 | Нужно добавить Inbucket-based тест и расширить scope |
| A4 | `ubuntu-latest` CI runner НЕ имеет `postgresql-client` pre-installed | Environment Availability | apt-get install не нужен, всё уже есть |
| A5 | OnboardingWizard показывается при первом логине нового tenant (onboarding_state = NULL) | Architecture Patterns | E2E-04 тест не увидит wizard; нужно разобраться с trigger-условием |

---

## Sources

### Primary (HIGH confidence)
- `.planning/deferred/SEC-04-staging-supabase-e2e-PLAN.md` — полная спека staging setup (Tasks 1-5), read in full
- `tests/e2e/*.spec.ts` — существующие спеки, read in full
- `tests/e2e/global-setup.mjs` и `scripts/e2e/setup.mjs` — текущий setup, read in full
- `playwright.config.ts` — конфиг, read in full
- `.github/workflows/e2e-smoke.yml`, `e2e-nightly.yml`, `migrate.yml` — CI воркфлоу, read in full
- `apps/admin/features/onboarding/` — AGENTS.md, config/onboarding.ts, компоненты
- `apps/admin/features/auth/AGENTS.md`, `pages/set-password.vue`, `pages/invite.vue`
- `apps/admin/features/team/AGENTS.md`
- `apps/storefront/server/api/customer/orders.get.ts`, `utils/customerAuth.ts`, `utils/tenantDb.ts`
- `apps/landing/server/api/register.post.ts` — registration flow
- `supabase/config.toml` — Inbucket port 54324

### Secondary (MEDIUM confidence)
- Playwright 1.60 APIRequestContext — поддержка кастомных headers верифицирована через changelog [ASSUMED на базе знаний]
- `supabase/setup-cli@v1` GitHub Action существует в e2e-smoke.yml и e2e-nightly.yml — уже используется в проекте

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — все пакеты уже установлены, версии подтверждены
- Architecture: HIGH — полностью прочитана кодовая база, все паттерны из реального кода
- Pitfalls: HIGH — выведены из анализа реального кода и комментариев в нём
- E2E-04 onboarding scope: MEDIUM — нет ясности по триггеру wizard (onboarding_state = NULL)

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (стабильный стек, но тесты на staging могут меняться быстрее)
