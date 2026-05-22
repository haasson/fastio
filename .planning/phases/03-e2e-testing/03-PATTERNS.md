# Phase 3: E2E Testing — Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 9
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `tests/e2e/global-setup.mjs` | utility (setup) | request-response | `tests/e2e/global-setup.mjs` + `scripts/e2e/setup.mjs` | exact (self-modification) |
| `supabase/seed/e2e-staging.sql` | config (seed) | batch | `scripts/e2e/setup.mjs` (inline SQL block) | role-match |
| `.github/workflows/migrate.yml` | config (CI) | batch | `.github/workflows/migrate.yml` (self-modification) | exact (self-modification) |
| `.github/workflows/e2e-smoke.yml` | config (CI) | batch | `.github/workflows/e2e-smoke.yml` (self-modification) | exact (self-modification) |
| `.github/workflows/e2e-nightly.yml` | config (CI) | batch | `.github/workflows/e2e-nightly.yml` (self-modification) | exact (self-modification) |
| `tests/e2e/order-flow.spec.ts` | test | request-response | `tests/e2e/order-flow.spec.ts` + `admin-login.spec.ts` | exact (self-modification + auth pattern from analog) |
| `tests/e2e/auth-invite-staff.spec.ts` | test | request-response | `tests/e2e/admin-login.spec.ts` | role-match |
| `tests/e2e/cross-tenant.spec.ts` | test | request-response | `tests/e2e/account-auth.spec.ts` (API request ctx) | partial-match |
| `tests/e2e/onboarding-flow.spec.ts` | test | request-response | `tests/e2e/admin-login.spec.ts` + `appointment-flow.spec.ts` | role-match |
| `apps/admin/features/onboarding/components/*.vue` | component | — | existing onboarding components (self-modification) | exact (self-modification) |

---

## Pattern Assignments

### `tests/e2e/global-setup.mjs` (utility, dual-path refactor)

**Analog:** `tests/e2e/global-setup.mjs` (current 25-line implementation) + `scripts/e2e/setup.mjs`

**Current imports pattern** (`tests/e2e/global-setup.mjs`, lines 1–3):
```javascript
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
```

**New imports — add `createClient`** (extend existing imports):
```javascript
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
```

**Current setupLocal pattern** (`tests/e2e/global-setup.mjs`, lines 11–25) — extract verbatim into `setupLocal()`:
```javascript
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
```

**spawnSync error pattern** — reuse identical pattern for psql in staging path (`scripts/e2e/setup.mjs`, lines 98–106):
```javascript
const result = spawnSync('docker', ['exec', container, 'psql', ...], { encoding: 'utf-8' })
if (result.status !== 0) {
  console.error('E2E setup SQL failed:\n' + result.stderr)
  throw new Error(`psql exited with code ${result.status}`)
}
```

**Staging truncate table order** (FK-leaf-first, from SEC-04-staging-supabase-e2e-PLAN.md):
```javascript
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
// For 'tenants': filter by 'id'; for all others: filter by 'tenant_id'
for (const table of TABLES_IN_ORDER) {
  const field = table === 'tenants' ? 'id' : 'tenant_id'
  const { error } = await sb.from(table).delete().eq(field, STAGING_TENANT_ID)
  if (error) throw new Error(`[staging-setup] DELETE ${table} failed: ${error.message}`)
}
```

**Guard pattern — no automatic fallback** (`scripts/e2e/setup.mjs`, lines 79–86):
```javascript
// Exact dispatch: no fallback from staging to local when env partially set
export default async function globalSetup() {
  if (process.env.SUPABASE_STAGING_URL) {
    await setupStaging()
  } else {
    await setupLocal()
  }
}
```

**Fixtures write pattern** (`scripts/e2e/setup.mjs`, lines 197–209):
```javascript
const fixturesPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'tests', 'e2e', '.fixtures.json')
mkdirSync(dirname(fixturesPath), { recursive: true })
writeFileSync(fixturesPath, JSON.stringify({ ... }, null, 2), 'utf-8')
console.log(`[e2e-setup] ✓ fixtures written to ${fixturesPath}`)
```

---

### `supabase/seed/e2e-staging.sql` (config/seed, batch)

**Analog:** `scripts/e2e/setup.mjs` inline SQL block (lines 115–188) — structure to copy, not content

**DO block wrapper pattern** (`scripts/e2e/setup.mjs`, lines 119–132):
```sql
DO $$
DECLARE
  v_retail_id uuid;
BEGIN
  SELECT id INTO v_retail_id FROM tenants WHERE slug = 'demo';
  IF v_retail_id IS NULL THEN
    RAISE EXCEPTION 'E2E setup: tenant "demo" not found.';
  END IF;
END $$;
```

**Staging DO block with fixed UUIDs** (from SEC-04-staging-supabase-e2e-PLAN.md):
```sql
DO $$ DECLARE
  _owner_id  uuid := 'e2e00000-0000-0000-0000-000000000001';
  _tenant_id uuid := 'e2e00000-0000-0000-0000-000000000002';
  _branch_id uuid := 'e2e00000-0000-0000-0000-000000000003';
  _cat_id    uuid := 'e2e00000-0000-0000-0000-000000000004';
  _dish_id   uuid := 'e2e00000-0000-0000-0000-000000000005';
BEGIN
  -- auth.users with known password (idempotent: UPDATE on conflict)
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, ...)
  VALUES (_owner_id, 'e2e@fastio.app', crypt('e2e-pass-12345', gen_salt('bf')), now(), ...)
  ON CONFLICT (id) DO UPDATE SET encrypted_password = crypt('e2e-pass-12345', gen_salt('bf'));
  -- tenants, tenant_members, branches, categories, dishes
  -- ... ON CONFLICT (id) DO NOTHING
  RAISE NOTICE 'E2E staging seed applied: tenant=%, owner=%', _tenant_id, _owner_id;
END $$;
```

**Admin password reset pattern** (`scripts/e2e/setup.mjs`, lines 183–188) — copy for auth.users in seed:
```sql
UPDATE auth.users
SET encrypted_password = crypt('${ADMIN_PASSWORD}', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email = '${ADMIN_EMAIL}';
```

**Key constraints:** slug must be `e2e` (not `demo`); no customers/orders in seed (created/torn down by tests); file ≤ 150 lines.

---

### `.github/workflows/migrate.yml` (config/CI, batch)

**Analog:** `.github/workflows/migrate.yml` (self-modification) — add step after existing `Apply pending migrations`

**Existing step structure to follow** (`migrate.yml`, lines 39–42):
```yaml
      - name: Apply pending migrations
        env:
          VPS_HOST: ${{ secrets.VPS_HOST }}
        run: |
          set -euo pipefail
```

**New step pattern to add** (after the existing Apply pending migrations step):
```yaml
      - name: Push migrations to staging
        # D-10: staging Supabase Cloud project isolated from prod.
        # No-op when SUPABASE_STAGING_DB_URL secret is absent — workflow never
        # fails for prod-only runs. If --db-url is not valid in CLI 2.75.0,
        # run `supabase db push --help` and adapt.
        if: ${{ secrets.SUPABASE_STAGING_DB_URL != '' }}
        env:
          STAGING_DB_URL: ${{ secrets.SUPABASE_STAGING_DB_URL }}
        uses: supabase/setup-cli@v1
        with:
          version: 2.75.0
      - run: |
          set -euo pipefail
          supabase db push --db-url "$STAGING_DB_URL"
```

**supabase/setup-cli@v1 is already used** in `e2e-smoke.yml` (lines 34–37):
```yaml
      - name: setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest
```

---

### `.github/workflows/e2e-smoke.yml` and `e2e-nightly.yml` (config/CI, batch)

**Analog:** both files (self-modification) — add staging env vars + `postgresql-client` install step

**Existing structure** (`e2e-smoke.yml`, lines 55–58):
```yaml
      - name: run smoke tests
        env:
          CI: 'true'
        run: pnpm exec playwright test smoke-storefront.spec.ts smoke-admin.spec.ts
```

**Staging env vars to add to `run E2E` step:**
```yaml
        env:
          CI: 'true'
          SUPABASE_STAGING_URL: ${{ secrets.SUPABASE_STAGING_URL }}
          SUPABASE_STAGING_ANON_KEY: ${{ secrets.SUPABASE_STAGING_ANON_KEY }}
          SUPABASE_STAGING_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_STAGING_SERVICE_ROLE_KEY }}
          SUPABASE_STAGING_DB_URL: ${{ secrets.SUPABASE_STAGING_DB_URL }}
          NUXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_STAGING_URL }}
          NUXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_STAGING_ANON_KEY }}
```

**psql install step — add before `install Playwright browsers`:**
```yaml
      - name: install postgresql-client
        run: sudo apt-get install -y postgresql-client
```

**Telegram failure notification pattern** (`e2e-nightly.yml`, lines 68–82) — do NOT copy to e2e-smoke; this pattern is nightly-only.

---

### `tests/e2e/order-flow.spec.ts` (test, request-response — extend)

**Analog:** `tests/e2e/order-flow.spec.ts` (self-modification) + `tests/e2e/admin-login.spec.ts` (admin auth pattern)

**Current test ends at** (`order-flow.spec.ts`, lines 51–54):
```typescript
  await page.waitForURL(/\/order\//, { timeout: 15_000 })
  await expect(page.getByTestId('order-page')).toBeVisible()
  await expect(page.getByTestId('order-number')).toContainText(/Заказ #/)
```

**Admin auth pattern to copy** (`admin-login.spec.ts`, lines 14–20):
```typescript
  const form = page.getByTestId('admin-login-form')
  await form.waitFor({ state: 'visible', timeout: 15_000 })
  await page.getByTestId('admin-login-email').locator('input').fill(fixtures.adminEmail)
  await page.getByTestId('admin-login-password').locator('input').fill(fixtures.adminPassword)
  await page.getByTestId('admin-login-submit').click()
  await expect(page.getByTestId('admin-nav')).toBeVisible({ timeout: 20_000 })
```

**context.newPage() pattern** — use `context.newPage()` not a new browser (per RESEARCH.md "Don't Hand-Roll" table):
```typescript
  // After order-page assertion — add admin-side verification:
  const orderUrl = page.url()
  // orderId not needed if searching by phoneMarker in the orders list

  const adminPage = await context.newPage()
  await adminPage.goto('http://localhost:4710/login')
  // ... copy admin-login.spec.ts auth pattern ...
  await adminPage.goto('http://localhost:4710/orders')
  await expect(adminPage.locator(`text=${fixtures.phoneMarker}`)).toBeVisible({ timeout: 30_000 })
```

**Timeout note:** use `{ timeout: 30_000 }` for the order visibility assertion — Supabase Realtime + Pinia store are async (see RESEARCH.md Pitfall 3).

---

### `tests/e2e/auth-invite-staff.spec.ts` (test, request-response — new)

**Analog:** `tests/e2e/admin-login.spec.ts` (admin auth flow) + `tests/e2e/account-auth.spec.ts` (cookie-based auth)

**Imports pattern** (copy from `admin-login.spec.ts`, lines 1–2):
```typescript
import { test, expect } from '@playwright/test'
import { fixtures } from './fixtures'
```

**baseURL pattern** (`admin-login.spec.ts`, line 7):
```typescript
test.use({ baseURL: 'http://localhost:4710' })
```

**Admin login reuse pattern** (`admin-login.spec.ts`, lines 9–23):
```typescript
test('auth: staff invite flow — admin sends invite, new member sets password', async ({ page, context }) => {
  // Step 1: admin logs in (copy pattern from admin-login.spec.ts)
  await page.goto('/login')
  const form = page.getByTestId('admin-login-form')
  await form.waitFor({ state: 'visible', timeout: 15_000 })
  await page.getByTestId('admin-login-email').locator('input').fill(fixtures.adminEmail)
  await page.getByTestId('admin-login-password').locator('input').fill(fixtures.adminPassword)
  await page.getByTestId('admin-login-submit').click()
  await expect(page.getByTestId('admin-nav')).toBeVisible({ timeout: 20_000 })
  // Step 2: navigate to team, invite, get token from DB
  // Step 3: new page → /invite?token=... → /set-password
})
```

**Service-role DB query for invite token** (from RESEARCH.md Pattern 4):
```typescript
import { createClient } from '@supabase/supabase-js'
// In beforeAll or inside test:
const sb = createClient(process.env.SUPABASE_STAGING_URL!, process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY!)
const { data } = await sb.from('tenant_invitations')
  .select('token')
  .eq('email', INVITE_EMAIL)
  .order('created_at', { ascending: false })
  .limit(1)
  .single()
const inviteToken = data.token
```

---

### `tests/e2e/cross-tenant.spec.ts` (test, API request — new)

**Analog:** `tests/e2e/account-auth.spec.ts` (cookie-based session pattern) — but this is a pure API test using `request` fixture, no UI

**Imports pattern** (copy from `account-auth.spec.ts`, lines 1–2):
```typescript
import { test, expect } from '@playwright/test'
import { fixtures } from './fixtures'
```

**Cookie-from-fixtures pattern** (`account-auth.spec.ts`, lines 9–11):
```typescript
// account-auth.spec.ts uses context.addCookies([tgSessionCookie('retail')])
// cross-tenant.spec.ts uses request fixture with manual Cookie header instead:
```

**API request with custom Host header pattern** (Playwright `request` fixture, from RESEARCH.md Pattern 2):
```typescript
test('cross-tenant isolation: session for tenant-A returns 401/404 for tenant-B API', async ({ request }) => {
  // tenant-A — own session, expect 200 or 401 (customer may not exist in staging)
  const resA = await request.get('http://localhost:4711/api/customer/orders', {
    headers: {
      'Host': `${fixtures.retailTenantSlug}.localhost:4711`,
      'Cookie': `tg_session=${fixtures.sessionTokenRetail}`,
    },
  })
  expect(resA.status()).not.toBe(403)

  // tenant-B — same token, different Host header → RLS + tenantDb proxy must reject
  const resB = await request.get('http://localhost:4711/api/customer/orders', {
    headers: {
      'Host': `${fixtures.servicesTenantSlug}.localhost:4711`,
      'Cookie': `tg_session=${fixtures.sessionTokenRetail}`,
    },
  })
  expect([401, 403, 404]).toContain(resB.status())
})
```

**Note:** No `test.use({ baseURL })` needed — absolute URLs are used throughout.

---

### `tests/e2e/onboarding-flow.spec.ts` (test, request-response — new)

**Analog:** `tests/e2e/appointment-flow.spec.ts` (multi-step sequential UI flow) + `tests/e2e/admin-login.spec.ts` (admin login prerequisite)

**Imports pattern** (`appointment-flow.spec.ts`, line 1–2):
```typescript
import { test, expect } from '@playwright/test'
import { fixtures } from './fixtures'
```

**baseURL for admin** (`admin-login.spec.ts`, line 7):
```typescript
test.use({ baseURL: 'http://localhost:4710' })
```

**Sequential step pattern with waitFor** (`appointment-flow.spec.ts`, lines 16–46):
```typescript
// Ждём первого доступного элемента, затем кликаем:
const firstDate = page.getByTestId('appointment-dates').locator('button:not([disabled])').first()
await firstDate.waitFor({ state: 'visible', timeout: 15_000 })
await firstDate.click()
```

**data-testid targeting pattern** (`appointment-flow.spec.ts`, lines 17–18):
```typescript
const branchItem = page.getByTestId('branch-picker-item').first()
await branchItem.waitFor({ state: 'visible', timeout: 10_000 })
await branchItem.click()
```

**Onboarding test skeleton** (based on testids to be added — see next section):
```typescript
test('onboarding flow: login → wizard → complete', async ({ page }) => {
  // Step 1: login as pre-seeded e2e owner
  await page.goto('/login')
  await page.getByTestId('admin-login-form').waitFor({ state: 'visible', timeout: 15_000 })
  await page.getByTestId('admin-login-email').locator('input').fill(fixtures.adminEmail)
  await page.getByTestId('admin-login-password').locator('input').fill(fixtures.adminPassword)
  await page.getByTestId('admin-login-submit').click()

  // Step 2: wizard should appear for fresh tenant (onboarding_state = NULL)
  await expect(page.getByTestId('onboarding-wizard')).toBeVisible({ timeout: 20_000 })

  // Step 3: select business type (retail)
  await page.getByTestId('onboarding-type-retail').click()
  await page.getByTestId('onboarding-next').click()

  // ... remaining steps ...

  // Final step: wizard completion
  await expect(page.getByTestId('onboarding-wizard')).toBeHidden({ timeout: 20_000 })
})
```

---

### `apps/admin/features/onboarding/components/*.vue` (components — add data-testid)

**Analog:** existing onboarding components (self-modification); testid pattern from existing E2E specs

**testid pattern from working E2E specs** (`order-flow.spec.ts`, lines 22–24):
```typescript
const pizzaCard = page.locator('[data-testid="product-card-dish"]:visible', { hasText: 'Маргарита' }).first()
await pizzaCard.locator('[data-testid="product-add"]:visible').first().click()
```

**What to add, file by file:**

`OnboardingWizard.vue` — add to root div (line 2):
```html
<div class="wizard-root" data-testid="onboarding-wizard">
```

`OnboardingWizard.vue` — add to "Далее" button (line 68):
```html
<UiButton
  v-if="currentStep !== 'complete'"
  type="primary"
  :loading="saving"
  :disabled="!canAdvance"
  data-testid="onboarding-next"
  @click="next"
>
```

`OnboardingWizard.vue` — add to "Перейти в админку" finish button (line 75):
```html
<UiButton
  v-else
  type="primary"
  :loading="saving"
  data-testid="onboarding-finish"
  @click="finish"
>
```

`OnboardingStepType.vue` — add data-testid to each `OnboardingOption` (line 12–19). Options are rendered from the `options` array — the component's `@select` emits business type. Pattern: add `data-testid` to `OnboardingOption` button element, derive value from `option.type`:
```html
<!-- In OnboardingOption.vue, add data-testid prop and bind it: -->
<button
  type="button"
  class="option"
  :class="{ selected }"
  :data-testid="testid"
  @click="$emit('select')"
>
```
And in `OnboardingStepType.vue` template:
```html
<OnboardingOption
  v-for="option in options"
  :key="option.type"
  :icon="option.icon"
  :title="option.title"
  :desc="option.desc"
  :testid="`onboarding-type-${option.type}`"
  :selected="modelValue === option.type"
  @select="$emit('update:modelValue', option.type)"
/>
```

`OnboardingSidebarEntry.vue` — add to the root button (line 2):
```html
<button
  type="button"
  class="sidebar-entry"
  :class="{ active, done }"
  data-testid="admin-nav-onboarding"
  @click="emit('click')"
>
```

`OnboardingStepActions.vue` — add to "Дальше" button (line 10):
```html
<UiButton
  type="default"
  size="small"
  data-testid="onboarding-checklist-next"
  @click="emit('next', step)"
>
```

**Critical constraint:** `UiButton` wraps Naive UI — `data-testid` must be on `UiButton` as prop if the component passes it through, OR on the wrapper `<div>`. Read `packages/ui/src/components/UiButton.vue` before adding to confirm `data-testid` is passed to the native `<button>` via `v-bind="$attrs"`. If not, wrap in a `<div data-testid="...">` instead.

---

## Shared Patterns

### Fixtures access
**Source:** `tests/e2e/fixtures.ts` (lines 1–57)
**Apply to:** All new spec files
```typescript
import { fixtures } from './fixtures'
// Access: fixtures.adminEmail, fixtures.adminPassword, fixtures.phoneMarker,
//         fixtures.retailTenantSlug, fixtures.servicesTenantSlug,
//         fixtures.sessionTokenRetail
```

### Playwright `waitFor` instead of `waitForTimeout`
**Source:** `tests/e2e/appointment-flow.spec.ts` (lines 16–19, 39–47) + `tests/e2e/order-flow.spec.ts` (line 23)
**Apply to:** All new spec files
```typescript
// Pattern: always use state-based wait, never waitForTimeout
const el = page.getByTestId('some-element')
await el.waitFor({ state: 'visible', timeout: 15_000 })
// Or with expect:
await expect(el).toBeVisible({ timeout: 15_000 })
```

### Error capture pattern
**Source:** `tests/e2e/smoke-admin.spec.ts` (lines 6–8)
**Apply to:** Optionally in any spec where JS runtime errors matter
```typescript
const pageErrors: Error[] = []
page.on('pageerror', (err) => pageErrors.push(err))
// ... test body ...
expect(pageErrors).toEqual([])
```

### spawnSync error/output capture
**Source:** `tests/e2e/global-setup.mjs` (lines 15–23) + `scripts/e2e/setup.mjs` (lines 96–112)
**Apply to:** `global-setup.mjs` staging path psql invocation
```javascript
const result = spawnSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', seedPath], { encoding: 'utf-8' })
if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)
if (result.status !== 0) {
  throw new Error(`[staging-setup] seed apply failed (exit ${result.status}):\n${result.stderr || '(no output)'}`)
}
```

### GitHub Actions secret injection
**Source:** `.github/workflows/migrate.yml` (lines 41–43) + `e2e-nightly.yml` (lines 68–73)
**Apply to:** All CI workflow files that need staging secrets
```yaml
        env:
          SECRET_VALUE: ${{ secrets.SECRET_NAME }}
```
Secrets are never echoed inline — always via `env:` block.

---

## No Analog Found

All files have close analogs in the codebase. No files are without a pattern reference.

---

## Special Notes for Planner

1. **Wave 0 dependency chain:** `OnboardingWizard.vue` data-testid additions must happen before `onboarding-flow.spec.ts` is written. Plan these as separate tasks in the same wave.

2. **`UiButton` testid passthrough:** Before adding `data-testid` to `UiButton`, read `packages/ui/src/components/UiButton.vue` to verify `$attrs` passthrough behavior. If not passed through, wrap the `<UiButton>` in a `<span>` or `<div>` with the testid.

3. **OnboardingOption testid prop:** `OnboardingOption.vue` currently has no `testid` prop (lines 20–26). Adding `data-testid` requires: (a) add optional `testid?: string` to `defineProps`, (b) bind `:data-testid="testid"` on the root `<button>`, (c) pass it from `OnboardingStepType.vue`. This is a 2-file coordinated change.

4. **Staging slug is `e2e` not `demo`:** All new spec files must read tenant slug from `fixtures` or env, never hardcode `demo`. The fixtures.json for staging will have `retailTenantSlug: 'e2e'`.

5. **`console.log` in `.mjs` setup files is allowed** (CLAUDE.md: ESLint not applied to `.mjs` Node scripts). Use `console.log('[e2e]', ...)` format per existing convention in `scripts/e2e/setup.mjs`.

---

## Metadata

**Analog search scope:** `tests/e2e/`, `scripts/e2e/`, `.github/workflows/`, `apps/admin/features/onboarding/components/`
**Files scanned:** 18
**Pattern extraction date:** 2026-05-21
