---
phase: 03-e2e-testing
plan: 01
subsystem: infra
tags: [playwright, supabase, github-actions, e2e, staging, postgresql]

requires:
  - phase: 01-security-foundation
    provides: RLS audit in migrate.yml — staging push step added after it

provides:
  - Staging push step in migrate.yml (no-op when secret absent)
  - Minimal E2E seed supabase/seed/e2e-staging.sql with fixed UUIDs
  - Dual-path global-setup.mjs (staging HTTP API + local docker)
  - Staging env vars + postgresql-client in e2e-smoke.yml / e2e-nightly.yml

affects: [03-02, 03-03, 03-04, 03-05]

tech-stack:
  added: []
  patterns:
    - "Dual-path globalSetup: dispatch on SUPABASE_STAGING_URL, no silent fallback"
    - "FK-leaf-first DELETE for staging truncate via service-role HTTP API"
    - "Fixed UUID convention: e2e00000-0000-0000-0000-00000000000N for test fixtures"
    - "GitHub Actions secret gate: if: ${{ secrets.NAME != '' }} for conditional steps"

key-files:
  created:
    - supabase/seed/e2e-staging.sql
  modified:
    - .github/workflows/migrate.yml
    - .github/workflows/e2e-smoke.yml
    - .github/workflows/e2e-nightly.yml
    - tests/e2e/global-setup.mjs

key-decisions:
  - "Staging URL is the sole dispatch signal: no try/catch, no partial-env detection"
  - "Service-role DELETE (not TRUNCATE CASCADE) for staging cleanup — HTTP API limitation"
  - "Fixed UUIDs (e2e00000-...) allow predictable test fixtures across seeds"
  - "postgresql-client installed via apt-get on CI runner (Pitfall 5)"
  - "NUXT_PUBLIC_SUPABASE_* injected so Nuxt webServer uses staging, not prod URL"

requirements-completed:
  - SEC-04

duration: 10min
completed: 2026-05-22
---

# Phase 03 Plan 01: Staging Supabase Infrastructure Summary

**Dual-path Playwright globalSetup with staging Supabase Cloud support: FK-leaf-first DELETE + psql seed re-apply via service-role, no docker dependency in CI**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-22T07:58:00Z
- **Completed:** 2026-05-22T08:05:56Z
- **Tasks:** 4 auto (2, 3, 4, 6); 2 checkpoints pending (Task 1, Task 5)
- **Files modified:** 4

## Accomplishments

- `migrate.yml` gets staging push step (gated on `SUPABASE_STAGING_DB_URL` secret, no-op until Task 1 complete)
- `supabase/seed/e2e-staging.sql` — 136 lines, 7 ON CONFLICT clauses, fixed UUIDs, one tenant/branch/category/dish
- `tests/e2e/global-setup.mjs` — dual-path: staging (HTTP API truncate + psql seed) vs local (docker exec), no fallback
- `e2e-smoke.yml` and `e2e-nightly.yml` — `postgresql-client` install step + full `SUPABASE_STAGING_*`/`NUXT_PUBLIC_*` env vars injected into test steps

## Task Commits

| Task | Name | Commit | Type |
|------|------|--------|------|
| 2 | Add staging push step to migrate.yml | `a3408e8c` | chore |
| 3 | Create minimal E2E staging seed | `52849613` | feat |
| 4 | Rewrite global-setup.mjs dual-path | `d58ee51e` | feat |
| 6 | Add staging env vars + postgresql-client to E2E workflows | `c5e3fc56` | chore |

## Files Created/Modified

- `/supabase/seed/e2e-staging.sql` — E2E staging seed: 1 tenant (slug=e2e), 1 owner (e2e@fastio.app), 1 branch, 1 category, 1 dish; idempotent ON CONFLICT
- `/.github/workflows/migrate.yml` — Added "Setup Supabase CLI for staging push" + "Push migrations to staging" steps after "Apply pending migrations"
- `/.github/workflows/e2e-smoke.yml` — Added "install postgresql-client" step + 6 staging env vars in "run smoke tests" step
- `/.github/workflows/e2e-nightly.yml` — Added "install postgresql-client" step + 6 staging env vars in "run E2E suite" step
- `/tests/e2e/global-setup.mjs` — Rewrote with `setupLocal()` (verbatim original) and `setupStaging()` (HTTP API truncate + psql seed)

## Decisions Made

- **Sole dispatch signal:** `SUPABASE_STAGING_URL` presence is the only branch condition — no try/catch, no partial detection, no automatic fallback to local when env is partially set
- **service-role DELETE not TRUNCATE:** Supabase HTTP API doesn't support CASCADE, so 14 tables are deleted in FK-leaf-first order
- **Fixed UUID convention:** `e2e00000-0000-0000-0000-000000000001..5` — predictable across runs without needing to read fixtures
- **postgresql-client via apt-get:** Ubuntu runner doesn't include it by default (Pitfall 5); added as workflow step

## Deviations from Plan

None — plan executed exactly as specified. The PATTERNS.md showed `uses:` and `run:` as separate steps for the staging CLI setup, which was implemented correctly as two distinct steps in migrate.yml.

## Pending Checkpoints

### Task 1: [BLOCKING] Human action — create Supabase Cloud staging project

**Status:** Awaiting human action before the staging CI path can be tested

**Steps required:**
1. Create `fastio-staging` project at https://app.supabase.com (Frankfurt region, Free tier)
2. Copy URL, anon key, service_role key, DB URI from project Settings
3. Add 4 GitHub Secrets: `SUPABASE_STAGING_URL`, `SUPABASE_STAGING_ANON_KEY`, `SUPABASE_STAGING_SERVICE_ROLE_KEY`, `SUPABASE_STAGING_DB_URL`
4. Run initial migration push: `supabase db push --db-url "$SUPABASE_STAGING_DB_URL"`
5. Verify: `psql "$SUPABASE_STAGING_DB_URL" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"` → count >= 60

### Task 5: [BLOCKING] End-to-end staging connectivity verify

**Status:** Awaiting Task 1 completion, then manual verification of truncate+seed roundtrip

**Resume signal:** Write "approved" when all 4 secrets are set and initial push succeeded

## User Setup Required

**External service requires manual configuration.** See Task 1 checkpoint details above, or reference:
- https://app.supabase.com/new/project — create fastio-staging
- https://github.com/settings/secrets/actions — add 4 secrets
- Secret names: `SUPABASE_STAGING_URL`, `SUPABASE_STAGING_ANON_KEY`, `SUPABASE_STAGING_SERVICE_ROLE_KEY`, `SUPABASE_STAGING_DB_URL`

## Next Phase Readiness

- All code artifacts for staging infrastructure are committed and ready
- The staging pipeline will activate automatically once GitHub Secrets are set (Task 1)
- After Task 5 approval, plans 03-02 through 03-05 can execute against staging
- Existing local E2E path (docker) is fully preserved and unaffected

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: information_disclosure | tests/e2e/global-setup.mjs | `SUPABASE_STAGING_SERVICE_ROLE_KEY` used in Node.js process env (not browser context); GitHub Actions masks secrets in logs |

---

*Phase: 03-e2e-testing*
*Completed: 2026-05-22 (auto tasks); checkpoints pending*
