# Phase 1: Security Foundation - Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 7 (2 modified source files, 1 new migration, 2 modified CI workflows, 1 new seed file, 1 modified E2E setup)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/storefront/server/middleware/tenant.ts` | middleware | request-response | self (existing file, 2 surgical edits) | exact |
| `apps/storefront/server/utils/tenantDb.ts` | utility | request-response | self (existing file, 1 surgical edit) | exact |
| `supabase/migrations/302_fix_edge_alerts_rls.sql` | migration | batch | `supabase/migrations/267_enable_rls_banners_and_counters.sql` | exact |
| `.github/workflows/ci.yml` | config | batch | self (existing file, new job block) | exact |
| `.github/workflows/migrate.yml` | config | batch | self (existing file, new step + staging push) | exact |
| `supabase/seed/e2e-staging.sql` | config | batch | `supabase/seed/demo.sql` (implicit from e2e-smoke.yml) | role-match |
| `tests/e2e/global-setup.mjs` | test | event-driven | self (existing file, branching rewrite) | exact |

---

## Pattern Assignments

### `apps/storefront/server/middleware/tenant.ts` (middleware, request-response)

**Analog:** self — `apps/storefront/server/middleware/tenant.ts`

**Change 1 — Add host guard before DB lookup** (after line 17, `const domain = host.split(':')[0]`):

Insert immediately after `const domain = ...` at line 17:
```typescript
// NEW: Guard against missing/empty Host header before any DB lookup (SEC-03, D-07)
if (!domain) {
  throw createError({ statusCode: 503, message: 'Missing or invalid Host header' })
}
```

**Change 2 — 404 → 503 for unknown tenant** (line 159, `devFallbackOrThrow` function):
```typescript
// WAS (line 159):
throw createError({ statusCode: 404, message: 'Tenant not found' })
// NOW (D-06):
throw createError({ statusCode: 503, message: 'Tenant not found' })
```

**Existing error-throwing pattern to copy** (lines 67-69, already uses 503):
```typescript
if (domainRes.error || slugRes.error) {
  throw createError({ statusCode: 503, message: 'Database temporarily unavailable' })
}
```

**Existing middleware structure** (lines 7-18) — `defineEventHandler` + `getRequestHeader` + `createError` — no new imports needed; all three are already in use in this file via Nuxt auto-import of h3 globals.

---

### `apps/storefront/server/utils/tenantDb.ts` (utility, request-response)

**Analog:** self — `apps/storefront/server/utils/tenantDb.ts`

**Change — 400 → 500 for missing tenant context** (line 75):
```typescript
// WAS (line 75):
if (!tenantId) throw createError({ statusCode: 400, message: 'Missing tenant context' })
// NOW (D-08): missing tenant = server bug (middleware didn't run), not client error
if (!tenantId) throw createError({ statusCode: 500, message: 'Missing tenant context' })
```

**Existing test to update** — `apps/storefront/server/utils/__tests__/tenantDb.test.ts` line 100:
```typescript
// Test currently asserts 400, must be updated to 500
expect(caught.statusCode).toBe(400)  // change to 500
```

---

### `supabase/migrations/302_fix_edge_alerts_rls.sql` (migration, batch)

**Analog:** `supabase/migrations/267_enable_rls_banners_and_counters.sql`

**Migration header pattern** (lines 1-29 of 267):
```sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- NNN: Short description of what this migration fixes.
--
-- Контекст: why this table had the problem, what was the state before.
-- Стратегия: what approach we take and why.
-- ═══════════════════════════════════════════════════════════════════════════════
```

**ENABLE ROW LEVEL SECURITY without policies pattern** (lines 32, 43-44 of 267, and `processed_webhook_events` precedent from RESEARCH.md):
```sql
-- edge_alerts_state is a singleton monitoring table used only by pg_cron.
-- The monitor_edge_errors function runs as postgres role (SECURITY DEFINER)
-- and bypasses RLS. No application code queries this table directly.
-- Adding RLS with no policies = default-deny for anon/authenticated.
ALTER TABLE edge_alerts_state ENABLE ROW LEVEL SECURITY;
-- No policies intentionally: default-deny for anon/authenticated.
-- pg_cron/SECURITY DEFINER functions bypass RLS — this table remains accessible
-- to internal automation.
```

**Idempotent policy pattern** (lines 38-50 of 267):
```sql
DROP POLICY IF EXISTS "policy_name" ON table_name;
CREATE POLICY "table: description"
  ON table_name FOR SELECT
  USING (is_tenant_member(tenant_id));
```

**Migration file naming:** `302_fix_edge_alerts_rls.sql` — follows 3-digit `NNN_description.sql` convention (migration 300 and 301 are the current latest, so 302 is next).

---

### `.github/workflows/ci.yml` (config, batch)

**Analog:** self — `.github/workflows/ci.yml`

**Existing `check` job structure to copy** (lines 14-51) — use same pnpm/node setup steps:
```yaml
security:
  runs-on: ubuntu-latest
  timeout-minutes: 15
  needs: check
  if: github.ref == 'refs/heads/main'  # D-04: only on push to main, not PR
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
      # D-04: scan .output/public/ only — server bundle legitimately contains
      # "service_role" in @supabase/auth-js docstrings. Public bundle must not.
      run: |
        if grep -r "service_role" apps/storefront/.output/public/ 2>/dev/null; then
          echo "::error::SECURITY: service_role found in storefront public bundle"
          exit 1
        fi
        echo "Security check passed: service_role not found in public bundle"
```

**Job placement:** Append `security:` job after the existing `deno-tests:` job at the end of the file.

---

### `.github/workflows/migrate.yml` (config, batch)

**Analog:** self — `.github/workflows/migrate.yml`

**Existing SSH+psql pattern to extend** (lines 43-116):

The audit step appends after `echo "All migrations applied."` at line 116. Must use the same `$SSH` variable and `$DB_CT` container name established earlier in the same `run: |` block:

```bash
# RLS audit: verify all TENANT_TABLES have rowsecurity=true (SEC-01, D-03)
# Uses $SSH and $DB_CT from the Apply pending migrations step above.
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

**Staging push step** — add as a new `step` after `Apply pending migrations`, NOT inside the same `run: |` block (separate step for clarity and separate env injection):

```yaml
- name: Push migrations to staging
  if: ${{ secrets.SUPABASE_STAGING_DB_URL != '' }}
  env:
    STAGING_DB_URL: ${{ secrets.SUPABASE_STAGING_DB_URL }}
  run: |
    # D-10: supabase db push deploys pending migrations to staging Cloud project.
    # Verify flag name with: supabase db push --help
    supabase db push --db-url "$STAGING_DB_URL"
```

---

### `supabase/seed/e2e-staging.sql` (config, batch)

**Analog:** `supabase/seed/demo.sql` (referenced in `e2e-smoke.yml` lines 49-50) and RESEARCH.md SEC-04 code example

**Loading pattern from e2e-smoke.yml** (lines 49-50):
```bash
docker cp supabase/seed/demo.sql supabase_db_fastio:/tmp/seed.sql
docker exec supabase_db_fastio psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/seed.sql
```
The new e2e-staging.sql is NOT loaded via docker cp — it is applied via service-role API INSERT in the staging globalSetup. The file structure should be a self-contained SQL script with `ON CONFLICT DO NOTHING` idempotency guards (same pattern as demo.sql).

**Seed SQL structure pattern** (D-11 + RESEARCH.md):
```sql
-- supabase/seed/e2e-staging.sql
-- Minimal E2E seed: 1 tenant, 1 owner, 1 branch, basic menu items.
-- Applied by: Playwright globalSetup (staging path) via service-role RPC or INSERT.
-- Fixed UUIDs for reproducibility: e2e00000-0000-0000-0000-00000000000N.
-- WARNING: Never reference demo.sql slugs ('demo', 'services-start') here.

DO $$
DECLARE
  _owner_id  uuid := 'e2e00000-0000-0000-0000-000000000001';
  _tenant_id uuid := 'e2e00000-0000-0000-0000-000000000002';
  _branch_id uuid := 'e2e00000-0000-0000-0000-000000000003';
BEGIN
  -- Use ON CONFLICT DO NOTHING for idempotency (re-runnable seed)
  INSERT INTO tenants (id, name, slug, owner_id, ...)
  VALUES (_tenant_id, 'E2E Tenant', 'e2e', _owner_id, ...)
  ON CONFLICT (id) DO NOTHING;
  -- ... branches, categories, dishes
END $$;
```

**Schema fields must be verified** against current migration files before writing the final seed. Check `supabase/migrations/001_init.sql` or `003_rls.sql` for column definitions.

---

### `tests/e2e/global-setup.mjs` (test, event-driven)

**Analog:** self — `tests/e2e/global-setup.mjs`

**Existing structure** (lines 1-25) — wrap with staging branch:
```javascript
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
// ADD for staging path:
import { createClient } from '@supabase/supabase-js'

export default async function globalSetup() {
  // D-12: branch on SUPABASE_STAGING_URL presence
  if (process.env.SUPABASE_STAGING_URL) {
    await setupStaging()
  } else {
    await setupLocal()  // existing docker exec path
  }
}

// Existing local path — preserve as-is:
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

// New staging path (D-12):
async function setupStaging() {
  const sb = createClient(
    process.env.SUPABASE_STAGING_URL,
    process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY,
  )

  // FK-leaf-first truncate order (RESEARCH.md Pitfall 4):
  // 1. order_events, order_items, order_notes (reference orders)
  // 2. orders (references customers, branches)
  // 3. appointments, appointment_events, appointment_groups (reference customers)
  // 4. customer_sessions (references customers)
  // 5. customers, branches (reference tenants)
  // 6. tenant_members, tenant_roles, tenant_invitations, tenants (root)
  const tenantId = 'e2e00000-0000-0000-0000-000000000002'
  const tables = [
    'order_events', 'order_items', 'order_notes',
    'orders',
    'appointment_events', 'appointment_groups', 'appointments',
    'customer_sessions',
    'customers', 'branches',
    'tenant_members', 'tenant_roles', 'tenant_invitations', 'tenants',
  ]
  for (const table of tables) {
    const col = table === 'tenants' ? 'id' : 'tenant_id'
    const { error } = await sb.from(table).delete().eq(col, tenantId)
    if (error) throw new Error(`Staging truncate failed on ${table}: ${error.message}`)
  }

  // Re-apply seed via SQL file through RPC, or re-insert via service-role INSERT
  // (exact mechanism TBD during implementation — see RESEARCH.md A1/A4)
}
```

**Anti-pattern to avoid:** Never let staging path fallback to local when `SUPABASE_STAGING_URL` is unset — the `if (process.env.SUPABASE_STAGING_URL)` guard is the safety switch.

---

## Shared Patterns

### `createError` usage
**Source:** `apps/storefront/server/middleware/tenant.ts` (lines 67-69, 159) and `apps/storefront/server/utils/tenantDb.ts` (line 75)
**Apply to:** Both SEC-03 changes in tenant.ts and tenantDb.ts

```typescript
// h3 createError is Nuxt-auto-imported in middleware files.
// In utility files (tenantDb.ts), it is explicitly imported from 'h3' (line 2).
// Follow the same pattern: no import needed in middleware, explicit import in utils.
throw createError({ statusCode: 503, message: 'Human-readable message' })
```

### Migration idempotency
**Source:** `supabase/migrations/267_enable_rls_banners_and_counters.sql` (lines 37-38, 47-49)
**Apply to:** `302_fix_edge_alerts_rls.sql`

```sql
-- Always DROP POLICY IF EXISTS before CREATE POLICY to be re-runnable
DROP POLICY IF EXISTS "policy_name" ON table_name;
CREATE POLICY "policy_name" ON table_name FOR SELECT USING (...);
```

### GH Actions job preamble (pnpm + node setup)
**Source:** `.github/workflows/ci.yml` (lines 17-29) and `.github/workflows/e2e-smoke.yml` (lines 27-35)
**Apply to:** New `security` job in ci.yml

```yaml
- uses: actions/checkout@v4
- uses: pnpm/action-setup@v4
  with:
    version: 9.15.0
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: pnpm
- run: pnpm install --frozen-lockfile
```

### SSH+psql pattern in migrate.yml
**Source:** `.github/workflows/migrate.yml` (lines 43-116)
**Apply to:** RLS audit step added to migrate.yml

The SSH variable `SSH="ssh -o BatchMode=yes root@${VPS_HOST}"` and container discovery `DB_CT=$($SSH ...)` are established in the single `run: |` block. The audit step MUST run inside the same `run: |` block to reuse `$SSH` and `$DB_CT`, or re-establish them identically in a new step.

---

## No Analog Found

No files in this phase are without analogs. All 7 files either modify existing code surgically or follow patterns directly observable in the codebase.

---

## Key Observations for Planner

1. **SEC-03 is truly surgical** — tenant.ts gets 2 lines inserted/changed (line 17+1 and line 159); tenantDb.ts gets 1 character changed (`400` → `500`). Corresponding test `tenantDb.test.ts` line 100 needs `toBe(400)` → `toBe(500)`.

2. **migrate.yml audit step scope** — the audit SQL must append to the existing `run: |` block at line 43 (after line 116 `echo "All migrations applied."`), not as a separate step, to reuse `$SSH`/`$DB_CT` without re-establishing SSH.

3. **Migration 302 is one line** — `ALTER TABLE edge_alerts_state ENABLE ROW LEVEL SECURITY;` plus a header comment. All 46 TENANT_TABLES already have RLS (verified against live DB in RESEARCH.md). No remediation policies needed.

4. **SEC-04 has a human dependency** — Supabase Cloud staging project must be created manually before CI steps can be tested. Plan must include a `human-verify` checkpoint. The seed SQL schema must be verified against `supabase/migrations/` before writing.

5. **New unit test file needed** — `apps/storefront/server/middleware/__tests__/tenant.test.ts` is not listed in existing test files. It must be created from scratch. Pattern to copy: `apps/storefront/server/utils/__tests__/tenantDb.test.ts` (lines 1-60) for vitest structure, mock patterns, and `makeEvent()` helper.

---

## Metadata

**Analog search scope:** `apps/storefront/server/`, `.github/workflows/`, `supabase/migrations/`, `tests/e2e/`
**Files scanned:** 12
**Pattern extraction date:** 2026-05-21
