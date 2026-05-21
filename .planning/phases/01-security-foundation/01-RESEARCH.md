# Phase 1: Security Foundation — Research

**Researched:** 2026-05-21
**Domain:** Supabase RLS, Nuxt 3 SSR security, GitHub Actions CI, tenant middleware
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### SEC-01 — RLS Audit
- **D-01:** Scope аудита — все таблицы из TENANT_TABLES (46 таблиц с tenant_id). Shared-таблицы без tenant_id (tenants, memberships, plan_features, processed_webhook_events) — отдельный проход: если rowsecurity=false, документируем как intentional (доступны только через service-role, anon key не добирается).
- **D-02:** Remediation для TENANT_TABLES: `ALTER TABLE x ENABLE ROW LEVEL SECURITY` + restrictive policy — аутентифицированные пользователи видят только строки своего тенанта через join с `tenant_members`. Service-role политики не нужны (service_role байпасит RLS).
- **D-03:** CI enforcement: audit query в migrate.yml после применения миграций — выходит с ошибкой если находит таблицы из TENANT_TABLES с rowsecurity=false. Блокирует merge.

#### SEC-02 — Service-role CI Check
- **D-04:** Отдельный `security` job в CI, запускается только на push в main (не на PR — экономим время). Делает `pnpm build --filter storefront`, затем grep по `.output/public/` на строку `service_role`. Ненулевой выход блокирует деплой.
- **D-05:** Сканируем только storefront: это SSR-приложение с service-role в Nitro server-коде. Admin — SPA с anon key, риск другой.

#### SEC-03 — Tenant Middleware Hardening
- **D-06:** Неизвестный домен (тенант не найден в БД при обоих успешных запросах) → 503, не 404. Текущее поведение: `createError({ statusCode: 404 })` меняется на 503.
- **D-07:** Полностью отсутствующий Host-заголовок (пустой domain после strip port) → 503 с message `'Missing or invalid Host header'`. Добавить явную проверку до DB lookup.
- **D-08:** `getTenantDb()` при отсутствующем tenantId меняет 400 → 500 (Internal Server Error). Мотивация: отсутствие tenant в context — это баг сервера (middleware не сработал), не ошибка клиента.

#### SEC-04 — Staging Supabase Project
- **D-09:** Новый Supabase Cloud проект (free tier) — постоянный staging, изолированный от prod. Staging credentials хранятся в GH Secrets: `SUPABASE_STAGING_URL`, `SUPABASE_STAGING_SERVICE_ROLE_KEY`, `SUPABASE_STAGING_ANON_KEY`.
- **D-10:** Миграции на staging применяются через `supabase db push --db-url $STAGING_DB_URL` в отдельном step migrate.yml.
- **D-11:** Seed-данные: `supabase/seed.sql` с фиксированными фикстурами (1 тенант, 1 owner, 1 branch, базовые позиции меню). E2E-тесты применяют seed через Playwright globalSetup.
- **D-12:** Очистка БД перед E2E-раном: Playwright globalSetup truncates tenant-data tables через service-role API (без ssh, без supabase CLI). Порядок truncate по FK-зависимостям.

### Claude's Discretion
- Точная SQL-форма RLS-политик (будет выведена из pattern в существующих миграциях RLS)
- Конкретный список таблиц для truncate в globalSetup (по результатам аудита)
- Naming staging-проекта (fastio-staging)
- Таймаут и retry-count для `supabase db push` в CI

### Deferred Ideas (OUT OF SCOPE)
- Storefront Supabase client untyped (`as unknown as SomeType` casts) — техдолг
- `processed_webhook_events` TTL — TECHDEBT, Phase 5 или отдельная задача
- TENANT_TABLES auto-generation at build time — улучшение drift-check, v2
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | Аудит RLS — все таблицы имеют политики Row Level Security, нет утечки данных между тенантами | RLS audit confirms all TENANT_TABLES have rowsecurity=true locally. Only `edge_alerts_state` (non-tenant, internal) is missing RLS — needs migration. CI audit query pattern established. |
| SEC-02 | Service-role CI проверка — post-build grep убеждается, что service-role ключ не попал в клиентский бандл | Confirmed `service_role` string absent from `.output/public/` in existing build. Grep command approach verified. GH Actions job structure researched. |
| SEC-03 | Tenant middleware hardening — `getTenantDb()` выбрасывает исключение (не silently fallback) если `event.context.tenant` не разрешился | Current code in tenant.ts throws 404 for unknown domain; devFallbackOrThrow is the function to modify. tenantDb.ts line 75 throws 400 — change to 500. |
| SEC-04 | Staging environment — отдельный Supabase-проект для E2E тестов, полностью изолированный от продакшна | Existing E2E tests run against local supabase via docker. staging requires: new Supabase Cloud project, seed.sql creation, globalSetup rewrite, migrate.yml step, GH Secrets. |
</phase_requirements>

---

## Summary

Phase 1 is a hardening phase, not a greenfield build. All four requirements touch existing code and infrastructure rather than introducing new libraries. The codebase is already well-structured for security: `getTenantDb()` has a tenant-filter Proxy, all TENANT_TABLES already have `ENABLE ROW LEVEL SECURITY` in migrations, and `runtimeConfig` correctly scopes `supabaseServiceRoleKey` as server-only.

The actual work is: (1) write one migration fixing `edge_alerts_state` RLS (the only public table without RLS), (2) add a grep job to CI that verifies the public bundle, (3) change two status codes in two files, (4) create a staging Supabase Cloud project and wire it into CI.

The most complex item is SEC-04 (staging) because it requires a human action (creating the Supabase Cloud project, setting GH Secrets) and a non-trivial `globalSetup` rewrite to truncate-via-service-role-API instead of docker exec. The RLS items are straightforward SQL migrations following established patterns.

**Primary recommendation:** Plan in four sequential waves — SEC-03 (two-line code changes, no risk), SEC-02 (CI job addition), SEC-01 (migration + CI audit step), SEC-04 (staging setup, most dependencies).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| RLS enforcement | Database (PostgreSQL) | — | RLS is enforced at DB layer; app code cannot bypass if correctly enabled |
| Tenant resolution | Frontend Server (Nitro middleware) | Database | tenant.ts runs on every server request, resolves via DB lookup |
| Service-role key isolation | Frontend Server (Nitro) | CI/Build | Key must only appear in server bundle, never public; CI verifies post-build |
| Staging isolation | CI/Build | Database | Separate Supabase project + GH Secrets ensure environment isolation |
| E2E test setup | CI/Build | Database | globalSetup connects to staging via service-role API to seed/truncate |

---

## Standard Stack

No new packages are needed for this phase. All work uses existing infrastructure.

### Existing Stack Used

| Library / Tool | Version | Purpose in This Phase |
|----------------|---------|----------------------|
| PostgreSQL RLS | 15.8 (prod), 17 (local) | Row-level security enforcement |
| `@supabase/supabase-js` | 2.98.0 | Service-role API calls in globalSetup for staging truncate |
| GitHub Actions | — | Security CI job, migrate audit step |
| Nuxt 3 `runtimeConfig` | 3.21.6 | Server-only env var scoping (supabaseServiceRoleKey) |
| `h3` `createError` | via Nuxt | Error code changes in middleware |
| `supabase db push` CLI | 2.75.0 | Staging migration deployment |

**Installation:** None required — no new packages.

---

## Package Legitimacy Audit

> No new packages are installed in this phase.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
HTTP Request (unknown Host)
        │
        ▼
  Nitro Middleware (tenant.ts)
        │
        ├─ [no Host header] ──────────────────→ 503 "Missing or invalid Host header"
        │
        ├─ [lookup supabase: no tenant found] ─→ 503 (was 404) "Tenant not found"
        │
        └─ [tenant found] ──────────────────→ context.tenantId set → handler
                                                      │
                                                      ▼
                                               getTenantDb(event)
                                                      │
                                               [no tenantId] ──→ 500 (was 400)
                                                      │
                                               [ok] → scoped DB queries
```

```
CI Push to main
       │
       ├─ check job: typecheck → lint → tests → features:validate
       │
       ├─ security job (new, needs: check):
       │    pnpm build --filter storefront
       │    grep -r "service_role" .output/public/ → exit 1 if found
       │
       └─ migrate job (on migration file changes):
            Apply pending migrations
            Audit query: SELECT relname FROM pg_class WHERE relrowsecurity=false
                         AND relname = ANY(TENANT_TABLES_ARRAY) → exit 1 if rows
            (new) Push to staging: supabase db push --db-url $STAGING_DB_URL
```

### Recommended Project Structure

No new directories. Changes are surgical:

```
apps/storefront/server/
├── middleware/tenant.ts          # SEC-03: 404→503, add host check
└── utils/tenantDb.ts             # SEC-03: 400→500

supabase/migrations/
└── 302_fix_edge_alerts_rls.sql   # SEC-01: ENABLE RLS on edge_alerts_state

.github/workflows/
├── ci.yml                        # SEC-02: add security job
└── migrate.yml                   # SEC-01: add audit query step; SEC-04: staging push

supabase/seed/
└── e2e-staging.sql               # SEC-04: new minimal seed for staging E2E

tests/e2e/
└── global-setup.mjs              # SEC-04: rewrite to use service-role API (not docker)
```

### Pattern 1: Supabase RLS — Tenant-scoped Policy

[VERIFIED: supabase/migrations/099_custom_dish_tags.sql, supabase/migrations/267_enable_rls_banners_and_counters.sql]

```sql
-- Standard pattern used across the codebase (from migrations 099, 109, 267)
ALTER TABLE edge_alerts_state ENABLE ROW LEVEL SECURITY;
-- For a non-tenant singleton table: no policies = default-deny for anon/authenticated
-- pg_cron functions run as postgres role which bypasses RLS
```

For TENANT_TABLES remediation pattern (from migration 007, 099, 109):
```sql
-- member-read, manager-write pattern (established in codebase)
CREATE POLICY "table_name: member can select"
  ON table_name FOR SELECT
  USING (is_tenant_member(tenant_id));

CREATE POLICY "table_name: manager can insert"
  ON table_name FOR INSERT
  WITH CHECK (has_tenant_role(tenant_id, 'manager'));
```
[VERIFIED: existing migrations 007_rls_membership.sql, 099_custom_dish_tags.sql]

### Pattern 2: CI Audit Query (SQL in shell)

[VERIFIED: .github/workflows/migrate.yml — established pattern for psql-in-shell]

```bash
# In migrate.yml after Apply pending migrations step
TABLES_WITHOUT_RLS=$($SSH "docker exec -i $DB_CT psql -U postgres -d postgres -tA" <<'SQL'
SELECT relname FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
AND c.relrowsecurity = false
AND relname = ANY(ARRAY[
  'addon_presets','addons','appointment_events','appointment_groups',
  'appointment_settings','appointments','audit_logs','banners',
  'billing_transactions','branches','categories','combo_tag_assignments',
  'combos','customer_sessions','customers','delivery_zones',
  'dish_tag_assignments','dish_tags','dishes','galleries','gallery_photos',
  'kitchen_queue','modifier_groups','order_events','order_items',
  'order_notes','order_number_counters','order_statuses','orders',
  'pending_telegram_auths','promo_codes','promotions','reservation_settings',
  'reservations','resource_unavailability','resources','schedule_templates',
  'services','support_tickets','table_call_types','table_calls','tables',
  'telegram_link_codes','tenant_invitations','tenant_members',
  'tenant_roles','tenants'
])
ORDER BY relname;
SQL
)
if [ -n "$TABLES_WITHOUT_RLS" ]; then
  echo "::error::RLS audit failed — TENANT_TABLES without rowsecurity: $TABLES_WITHOUT_RLS"
  exit 1
fi
echo "RLS audit: all TENANT_TABLES have RLS enabled."
```

### Pattern 3: SEC-02 Grep Check (GH Actions job)

[VERIFIED: .github/workflows/ci.yml — existing job structure]

```yaml
# In ci.yml — new job after check
security:
  runs-on: ubuntu-latest
  timeout-minutes: 15
  needs: check
  if: github.ref == 'refs/heads/main'  # only on push to main, not PR
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
      with:
        version: 9.15.0
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: pnpm
    - run: pnpm install --frozen-lockfile
    - name: build storefront
      run: pnpm build --filter storefront
    - name: check service_role not in public bundle
      run: |
        if grep -r "service_role" apps/storefront/.output/public/ 2>/dev/null; then
          echo "::error::SECURITY: service_role found in storefront public bundle"
          exit 1
        fi
        echo "Security check passed: service_role not found in public bundle"
```

### Pattern 4: SEC-03 Tenant Middleware — Two Changes

[VERIFIED: apps/storefront/server/middleware/tenant.ts — read directly]

Change 1 — add host guard before DB lookup (in the main handler, after `const domain = host.split(':')[0]`):
```typescript
// NEW: explicit guard before any DB lookup
if (!domain) {
  throw createError({ statusCode: 503, message: 'Missing or invalid Host header' })
}
```

Change 2 — in `devFallbackOrThrow()`, change the final throw:
```typescript
// WAS:
throw createError({ statusCode: 404, message: 'Tenant not found' })
// NOW:
throw createError({ statusCode: 503, message: 'Tenant not found' })
```

### Pattern 5: SEC-03 getTenantDb() — Status Code Change

[VERIFIED: apps/storefront/server/utils/tenantDb.ts line 75]

```typescript
// WAS:
if (!tenantId) throw createError({ statusCode: 400, message: 'Missing tenant context' })
// NOW:
if (!tenantId) throw createError({ statusCode: 500, message: 'Missing tenant context' })
```

### Pattern 6: SEC-04 Staging globalSetup via service-role API

[VERIFIED: tests/e2e/global-setup.mjs, tests/e2e/setup.mjs — current implementation uses docker exec]

The current `setup.mjs` uses `docker exec supabase_db_fastio psql` — this only works locally. For staging CI, we need HTTP API calls via service-role key:

```javascript
// Concept: truncate via Supabase REST API with service-role key
// Using DELETE with matching-all filter, ordered by FK dependency
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.SUPABASE_STAGING_URL,
  process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY
)

// FK-ordered truncate: child tables first, parent tables last
// order_items → orders → customers → customer_sessions → tenants (root)
await sb.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
await sb.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000')
// ... etc by FK order
```

**Alternative for truncate**: Use a Supabase Edge Function or RPC (`SECURITY DEFINER`) that runs `TRUNCATE ... CASCADE` — cleaner than row-by-row deletes, handles FK cascades correctly. [ASSUMED — need to evaluate tradeoffs vs REST API DELETE during planning]

### Anti-Patterns to Avoid

- **Hard-coding TENANT_TABLES array in both tenantDb.ts and migrate.yml**: These must stay in sync. The planner should derive the audit array from the `TENANT_TABLES` set in tenantDb.ts — either by importing it at build time or maintaining a shared constant. For now (Phase 1), maintaining both manually is acceptable if noted as TECHDEBT.
- **Using `supabase db reset` on staging**: CLAUDE.md forbids this — it drops the entire database. Use `supabase db push` only.
- **Running globalSetup against production**: The existing `setup.mjs` has a port guard (`54322` only) for local Docker. The staging globalSetup must use env var presence (`SUPABASE_STAGING_URL`) to determine which DB to target — never fallback to local when env is unset.
- **Scanning `.output/server/` for service_role**: The server bundle legitimately contains `service_role` (in `@supabase/auth-js` comments, not as actual key value). Only `.output/public/` must be scanned.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tenant-scoped DB queries | Custom filter injection in each endpoint | Existing `getTenantDb()` Proxy in tenantDb.ts | Already handles TENANT_TABLES set, insert protection, crossTenant escape hatch |
| DB truncation on staging | Custom TRUNCATE script with manual FK ordering | Supabase service-role DELETE with `.neq()` filter OR SECURITY DEFINER RPC | REST API handles auth; FK cascade on DELETE is predictable |
| Migration tracking | Custom version tracking | Existing `supabase_migrations.schema_migrations` table in migrate.yml | Already implemented and battle-tested |

---

## Common Pitfalls

### Pitfall 1: Scanning wrong output directory for service_role

**What goes wrong:** Grep finds `service_role` in `.output/server/` (it's in `@supabase/auth-js` docstrings) and reports false positive.
**Why it happens:** The `service_role` string appears as a comment in the supabase library: "Never expose your `service_role` key in the browser." — this is in the server bundle, not the public bundle.
**How to avoid:** Grep only `.output/public/` (client-side JS chunks), not `.output/server/`. The D-04 decision correctly scopes this.
**Warning signs:** CI failing on push with "service_role found" when no key is actually leaked — check if scan path includes server bundle.
**Verified:** Current `.output/public/` is clean [VERIFIED: local filesystem grep].

### Pitfall 2: migrate.yml audit query needs correct SSH pattern

**What goes wrong:** Audit query added as standalone step fails because it doesn't follow the SSH pattern established in migrate.yml.
**Why it happens:** migrate.yml uses a multi-step SSH session pattern (`SSH="ssh -o BatchMode=yes root@${VPS_HOST}"`). The audit query must use the same `$SSH` variable and `docker exec` pattern, not attempt a direct psql connection.
**How to avoid:** Add audit step inside the existing `run: |` block, after the `echo "All migrations applied."` line, or as a separate step that re-establishes the same SSH connection.
**Warning signs:** "Connection refused" or "DB container not found" errors in CI.
**[ASSUMED]:** The exact timing (before/after migration apply) affects whether the audit sees the newly-applied migration. Adding it AFTER apply is correct — it validates the post-migration state.

### Pitfall 3: SEC-04 seed.sql vs demo.sql confusion

**What goes wrong:** The config.toml `[db.seed]` references `./seed.sql` (root of supabase/ dir), but the E2E workflows reference `supabase/seed/demo.sql`. These are different.
**Why it happens:** `seed.sql` in config.toml is for `supabase db reset` only (local dev). The E2E workflow explicitly loads `supabase/seed/demo.sql` via docker cp. D-11 says "supabase/seed.sql with fixed fixtures" — this means a NEW file at `supabase/seed.sql` (or `supabase/seed/e2e-staging.sql`) separate from the demo seed.
**How to avoid:** Create a minimal E2E seed (`supabase/seed/e2e-staging.sql` or separate `e2e.sql`) that creates only what E2E tests need: 1 tenant, 1 owner, 1 branch, basic menu items. The demo.sql is for demos with 3 tenants and lots of data — too heavy for staging.
**Warning signs:** E2E setup fails on staging because it expects `demo` and `services-start` slugs (which won't exist in minimal seed).

### Pitfall 4: globalSetup truncate order — FK dependencies

**What goes wrong:** DELETE on `orders` before `order_items` fails with FK constraint violation.
**Why it happens:** `order_items.order_id` references `orders.id` with ON DELETE CASCADE, but a direct DELETE on orders while order_items exist fails (or doesn't cascade if ON DELETE RESTRICT).
**How to avoid:** Delete in FK-leaf-first order. From the schema:
  1. `order_events`, `order_items`, `order_notes` (reference orders)
  2. `orders` (references customers, branches)
  3. `appointments`, `appointment_events`, `appointment_groups` (reference customers)
  4. `customer_sessions` (references customers)
  5. `customers` (references tenants)
  6. `branches` (references tenants)
  7. Last: `tenant_members`, `tenant_roles`, `tenant_invitations`, `tenants`
**Warning signs:** `ForeignKeyViolation` errors in staging globalSetup.

### Pitfall 5: edge_alerts_state — false RLS audit failure

**What goes wrong:** The CI audit query includes `edge_alerts_state` in its check and it fails because this table has no RLS.
**Why it happens:** `edge_alerts_state` is a singleton internal table (pg_cron) with no tenant_id. It should NOT be in TENANT_TABLES. But it has `anon` grants without RLS protection — a real but lower-severity issue.
**How to avoid:** Migration `302_fix_edge_alerts_rls.sql` should add `ENABLE ROW LEVEL SECURITY` to `edge_alerts_state` with no policies (default-deny). The CI audit query should scan ALL public tables (not just TENANT_TABLES) for rowsecurity=false, or include `edge_alerts_state` in a separate check.
**Warning signs:** Audit query returns `edge_alerts_state` even after TENANT_TABLES check passes.
**Current state:** Verified locally — `edge_alerts_state` is the only public table without RLS. [VERIFIED: local docker psql query]

---

## RLS Audit Findings (Live DB)

> [VERIFIED: docker exec supabase_db_fastio psql queries against local dev DB]

### TENANT_TABLES RLS Status
**Result: ALL 46 TENANT_TABLES have `rowsecurity=true`.** No remediation migration needed for TENANT_TABLES themselves.

```sql
-- Verified: returns 0 rows against local DB
SELECT relname FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
AND c.relrowsecurity = false
AND relname = ANY(ARRAY[...all 46 TENANT_TABLES...]);
-- Result: (0 rows)
```

### Tables WITHOUT RLS (full DB scan)
**Result: Only `edge_alerts_state` has `rowsecurity=false`.**

- `edge_alerts_state`: singleton monitoring table (pg_cron), no tenant_id, `anon` grants but no policies — needs `ENABLE ROW LEVEL SECURITY` with no policies (default-deny).

### Tables WITH RLS but NO policies (intentional default-deny)
- `processed_webhook_events`: RLS=true, 0 policies — correct, service_role only via Edge Function.
- `auth_rate_limits`: RLS=true, 0 policies — correct, accessed only via SECURITY DEFINER RPC.

### Shared tables (no tenant_id) — intentional, documented as safe
- `plans`, `billing_config`, `module_configs`: RLS=true with read-only policies for authenticated users.
- `tenants`: in TENANT_TABLES with RLS and membership-based policies (member can select).

---

## Code Examples

### SEC-01: Migration 302 — Fix edge_alerts_state RLS

```sql
-- 302_fix_edge_alerts_rls.sql
-- edge_alerts_state is a singleton internal table used only by pg_cron
-- (monitor_edge_errors function runs as postgres role — bypasses RLS).
-- No application code queries this table directly.
-- Add RLS to close anon read/write access.
ALTER TABLE edge_alerts_state ENABLE ROW LEVEL SECURITY;
-- No policies intentionally: default-deny for anon/authenticated.
-- pg_cron/SECURITY DEFINER functions bypass RLS; this table is safe.
```

### SEC-01: CI Audit Step in migrate.yml

```bash
# After "All migrations applied." in the Apply pending migrations step:

TABLES_MISSING_RLS=$($SSH "docker exec -i $DB_CT psql -U postgres -d postgres -tA" <<'SQL'
SELECT relname FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity = false
  AND relname = ANY(ARRAY[
    'addon_presets','addons','appointment_events','appointment_groups',
    'appointment_settings','appointments','audit_logs','banners',
    'billing_transactions','branches','categories','combo_tag_assignments',
    'combos','customer_sessions','customers','delivery_zones',
    'dish_tag_assignments','dish_tags','dishes','galleries','gallery_photos',
    'kitchen_queue','modifier_groups','order_events','order_items',
    'order_notes','order_number_counters','order_statuses','orders',
    'pending_telegram_auths','promo_codes','promotions','reservation_settings',
    'reservations','resource_unavailability','resources','schedule_templates',
    'services','support_tickets','table_call_types','table_calls','tables',
    'telegram_link_codes','tenant_invitations','tenant_members',
    'tenant_roles','tenants'
  ])
ORDER BY relname;
SQL
)

if [ -n "$TABLES_MISSING_RLS" ]; then
  echo "::error::RLS audit FAILED. TENANT_TABLES with rowsecurity=false: $TABLES_MISSING_RLS"
  exit 1
fi
echo "RLS audit PASSED: all TENANT_TABLES have rowsecurity=true."
```

### SEC-04: Minimal E2E Staging Seed (concept)

```sql
-- supabase/seed/e2e-staging.sql
-- Minimal seed for staging E2E. Creates 1 tenant with fixed UUID for reproducibility.
-- Applied by: Playwright globalSetup before each E2E run (truncate → seed).

DO $$
DECLARE
  _owner_id uuid := 'e2e00000-0000-0000-0000-000000000001';
  _tenant_id uuid := 'e2e00000-0000-0000-0000-000000000002';
  _branch_id uuid := 'e2e00000-0000-0000-0000-000000000003';
BEGIN
  -- auth.users (Supabase Auth) — owner of the E2E tenant
  INSERT INTO auth.users (id, email, email_confirmed_at, encrypted_password, ...)
  VALUES (_owner_id, 'e2e@fastio.app', now(), crypt('e2e-pass-12345', gen_salt('bf')), ...)
  ON CONFLICT (id) DO UPDATE SET encrypted_password = crypt('e2e-pass-12345', gen_salt('bf'));

  -- tenants
  INSERT INTO tenants (id, name, slug, owner_id, ...) VALUES (_tenant_id, 'E2E Tenant', 'e2e', _owner_id, ...)
  ON CONFLICT (id) DO NOTHING;

  -- branches, categories, dishes...
END $$;
```

[ASSUMED — exact schema fields must be verified against current migrations before writing]

### SEC-04: Staging globalSetup — service-role API truncate

```javascript
// tests/e2e/global-setup-staging.mjs (or updated global-setup.mjs)
import { createClient } from '@supabase/supabase-js'

const isStaging = Boolean(process.env.SUPABASE_STAGING_URL)

export default async function globalSetup() {
  if (isStaging) {
    await setupStaging()
  } else {
    await setupLocal()  // existing docker exec path
  }
}

async function setupStaging() {
  const sb = createClient(
    process.env.SUPABASE_STAGING_URL,
    process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY
  )

  // Truncate in FK-leaf-first order
  const tenantId = 'e2e00000-0000-0000-0000-000000000002'
  await sb.from('order_items').delete().eq('tenant_id', tenantId)
  await sb.from('order_events').delete().eq('tenant_id', tenantId)
  // ... rest of FK-ordered truncate
  // Then re-apply seed via RPC or re-insert fixtures
}
```

[ASSUMED — exact truncate order must be validated against FK schema]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Owner-based RLS (owner_id = auth.uid()) | Membership-based RLS (is_tenant_member, has_permission) | Migration 007, 109 | Multi-member tenants supported; staff can access their tenant's data |
| Direct docker exec in E2E setup | Service-role API (to implement for staging) | Phase 1 (this phase) | Enables CI staging without docker access |
| 404 for unknown tenant | 503 (to implement) | Phase 1 (this phase) | Prevents tenant enumeration, correct retry signal for load balancers |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | SECURITY DEFINER RPC is viable alternative to REST API DELETE for staging truncate | Code Examples, SEC-04 | If RPC approach chosen, needs a new migration adding the RPC; adds schema complexity |
| A2 | `supabase db push --db-url $STAGING_DB_URL` is supported in supabase CLI 2.75.0 | Standard Stack | If syntax differs, need to verify actual CLI flags before writing migrate.yml step |
| A3 | Fixed UUIDs in staging seed (e2e00000-...) are safe and stable | Code Examples | If UUIDs collide with prod data, staging is unsafe; but separate project makes this a non-issue |
| A4 | FK-ordered truncate via service-role DELETE is sufficient (no TRUNCATE CASCADE needed) | Pitfalls, SEC-04 | If FK relationships are more complex, individual DELETEs may fail; TRUNCATE ... RESTART IDENTITY CASCADE via RPC may be needed |
| A5 | The existing e2e-smoke.yml and e2e-nightly.yml do NOT need modification for SEC-04 | SEC-04 scope | If the E2E workflows need to target staging instead of local supabase, they need env var injection for staging credentials |

---

## Open Questions

1. **Does `supabase db push` support `--db-url` in CLI 2.75.0?**
   - What we know: supabase CLI 2.75.0 is installed locally; `db push` is documented for pushing migrations to remote.
   - What's unclear: exact flag name — may be `--db-url`, `--linked`, or requires `supabase link` first.
   - Recommendation: Verify with `supabase db push --help` before writing the migrate.yml step.

2. **Should E2E smoke/nightly workflows also be modified to target staging?**
   - What we know: Currently they start a local supabase instance via `supabase start`.
   - What's unclear: D-09 says "separate Supabase Cloud project for E2E tests" — does this mean CI tests always hit staging, or only Phase 3 E2E tests will be wired to staging?
   - Recommendation: Phase 1 should only create the staging project and the migration step. Wiring E2E workflows to staging is Phase 3 work (where E2E-01 through E2E-04 live).

3. **Does the `security` CI job need to be a required check in branch protection?**
   - What we know: D-04 says "runs only on push to main (not PR) — non-zero exit blocks deploy." But GH Actions alone doesn't block deploy unless wired to required checks or a deploy workflow with `needs: security`.
   - What's unclear: Is there a deploy workflow that should `needs: security`?
   - Recommendation: Wire `security` job as a `needs` dependency in the deploy-functions workflow or add to migrate.yml dependency chain.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | CI, globalSetup | ✓ | v20.20.0 | — |
| pnpm | CI builds | ✓ | 9.15.0 | — |
| Docker | Local E2E, migrate.yml | ✓ | 29.2.1 | — |
| Supabase CLI | migrate.yml, db push | ✓ | 2.75.0 | — |
| Local Supabase | Local dev/E2E | ✓ | Running (PostgreSQL 17) | — |
| Supabase Cloud (staging) | SEC-04 | ✗ | — | **No fallback — human must create** |
| GH Secrets (staging) | SEC-04 CI | ✗ | — | **No fallback — human must configure** |

**Missing dependencies with no fallback:**
- Supabase Cloud staging project — must be created manually by developer. Blocks SEC-04 testing in CI.
- GitHub Secrets `SUPABASE_STAGING_URL`, `SUPABASE_STAGING_SERVICE_ROLE_KEY`, `SUPABASE_STAGING_ANON_KEY` — must be set after project creation. Blocks staging E2E in CI.

**These are human actions**, not automation. The plan must include a `checkpoint:human-verify` task for Supabase Cloud project creation and secret configuration.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `pnpm vitest run apps/storefront/server/utils/__tests__/` |
| Full suite command | `pnpm test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | TENANT_TABLES all have rowsecurity=true | Integration (live DB) | `RUN_TENANT_TABLES_DRIFT_CHECK=1 SUPABASE_URL=... pnpm vitest run apps/storefront/server/utils/__tests__/tenantTablesDrift.test.ts` | ✅ exists |
| SEC-01 | CI audit query exits non-zero if RLS missing | CI/shell | Part of migrate.yml (new step) | ❌ Wave 0 |
| SEC-02 | service_role not in .output/public | CI/shell | Part of ci.yml security job | ❌ Wave 0 |
| SEC-03 | Missing Host → 503 | Unit | New test in `__tests__/tenant-middleware.test.ts` | ❌ Wave 0 |
| SEC-03 | Unknown tenant → 503 (not 404) | Unit | New test in `__tests__/tenant-middleware.test.ts` | ❌ Wave 0 |
| SEC-03 | Missing tenantId in getTenantDb → 500 | Unit | New test in `__tests__/tenantDb.test.ts` (extend existing) | ❌ Wave 0 |
| SEC-04 | Staging project exists and accepts connections | Manual | `supabase db push --db-url $STAGING_DB_URL` succeeds | ❌ Wave 0 (human action) |

### Sampling Rate
- **Per task commit:** `pnpm test:run` (full unit suite, ~fast with no live DB)
- **Per wave merge:** `pnpm test:run` + drift check if supabase is running
- **Phase gate:** All unit tests green + migrate.yml audit step passes in CI

### Wave 0 Gaps
- [ ] `apps/storefront/server/middleware/__tests__/tenant.test.ts` — unit tests for SEC-03 (missing host → 503, unknown tenant → 503)
- [ ] `apps/storefront/server/utils/__tests__/tenantDb.test.ts` extension — test for missing tenantId → 500 status code
- No framework install needed — Vitest already configured

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A (Supabase Auth handles this) |
| V3 Session Management | no | N/A (Supabase Auth JWT) |
| V4 Access Control | yes | Supabase RLS + membership-based policies |
| V5 Input Validation | partial | Host header validation in tenant middleware |
| V6 Cryptography | no | N/A for this phase |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tenant data leakage via missing RLS | Information Disclosure | ENABLE ROW LEVEL SECURITY + restrictive policies |
| Service-role key in client bundle | Information Disclosure | Nuxt runtimeConfig server-only scoping + CI grep check |
| Tenant enumeration via 404 | Information Disclosure | 503 for all unknown-domain responses |
| DB access without tenant context | Elevation of Privilege | 500 error (not 400) signals server bug → Sentry alert |
| Anon write to edge_alerts_state | Tampering | ENABLE ROW LEVEL SECURITY (no policies = default-deny) |
| Cross-tenant contamination in E2E | Information Disclosure | Separate Supabase Cloud project for staging |

---

## Sources

### Primary (HIGH confidence)
- `apps/storefront/server/middleware/tenant.ts` — read directly, current implementation
- `apps/storefront/server/utils/tenantDb.ts` — read directly, TENANT_TABLES set and getTenantDb() code
- `apps/storefront/server/utils/__tests__/tenantTablesDrift.test.ts` — read directly
- `.github/workflows/ci.yml`, `migrate.yml`, `e2e-nightly.yml`, `e2e-smoke.yml` — read directly
- `supabase/migrations/003_rls.sql`, `007_rls_membership.sql`, `099_custom_dish_tags.sql`, `109_rls_permissions.sql`, `267_enable_rls_banners_and_counters.sql` — read directly
- Local PostgreSQL (live query): `docker exec supabase_db_fastio psql` — tables without RLS confirmed

### Secondary (MEDIUM confidence)
- `apps/storefront/nuxt.config.ts` — confirms `supabaseServiceRoleKey` is server-only runtimeConfig
- `tests/e2e/global-setup.mjs`, `scripts/e2e/setup.mjs` — confirms current docker exec approach
- `supabase/seed/demo.sql` — confirms existing seed structure for SEC-04 planning

### Tertiary (LOW confidence)
- `supabase db push --db-url` flag syntax [ASSUMED] — documentation not fetched, verify with `supabase db push --help`

---

## Metadata

**Confidence breakdown:**
- SEC-01 (RLS audit): HIGH — live DB query confirms current state, established SQL patterns exist in codebase
- SEC-02 (grep CI job): HIGH — current .output/public confirmed clean, GH Actions structure understood
- SEC-03 (middleware hardening): HIGH — exact lines to change identified in source files
- SEC-04 (staging): MEDIUM — architecture clear, but staging CLI flags and seed schema need verification

**Research date:** 2026-05-21
**Valid until:** 2026-06-20 (stable domain; Supabase CLI flags may change with minor versions)
