---
phase: 01-security-foundation
plan: "01"
subsystem: storefront-server
tags: [security, tenant-middleware, http-status, sec-03]
dependency_graph:
  requires: []
  provides: [SEC-03-middleware-hardening]
  affects:
    - apps/storefront/server/middleware/tenant.ts
    - apps/storefront/server/utils/tenantDb.ts
tech_stack:
  added: []
  patterns:
    - "Host guard before DB lookup to prevent empty-host probing"
    - "503 for unknown tenant (load-balancer retryable, no enumeration)"
    - "500 for server-side misconfiguration (tenantId absent from context)"
key_files:
  created:
    - apps/storefront/server/middleware/__tests__/tenant.test.ts
  modified:
    - apps/storefront/server/middleware/tenant.ts
    - apps/storefront/server/utils/tenantDb.ts
    - apps/storefront/server/utils/__tests__/tenantDb.test.ts
    - apps/storefront/server/__tests__/cross-tenant.test.ts
decisions:
  - "Use real h3 createError in tests (not a stub) to preserve H3Error shape and statusCode property"
  - "Mock paths in middleware/__tests__/ must use ../../utils/ not ../utils/ (resolved relative to test file)"
  - "source: 'fresh' path used in happy-path test to bypass mergeFreshSubscription supabase call"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-21"
  tasks_completed: 3
  files_modified: 5
  files_created: 1
---

# Phase 01 Plan 01: SEC-03 Tenant Middleware Hardening Summary

SEC-03 hardening: Host guard + 503 for unknown tenant + 500 for missing tenantId context, with TDD coverage via three new middleware unit tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create RED test scaffold | ac64b1f1 | `middleware/__tests__/tenant.test.ts` |
| 2 | Apply SEC-03 source edits + GREEN | 86bd428b | `tenant.ts`, `tenantDb.ts`, `tenantDb.test.ts`, `cross-tenant.test.ts`, `tenant.test.ts` |
| 3 | Full suite + typecheck | (no commit — verification) | — |

## Verification Results

- `pnpm vitest run apps/storefront` — 317 passed, 1 skipped (zero failures)
- `pnpm typecheck` — 5 tasks successful (admin, storefront, help, landing, packages)
- Grep gates all pass:
  - `statusCode: 503, message: 'Missing or invalid Host header'` — 1 match in tenant.ts
  - `statusCode: 503, message: 'Tenant not found'` — 1 match in tenant.ts
  - `statusCode: 404` — 0 matches in tenant.ts
  - `statusCode: 500, message: 'Missing tenant context'` — 1 match in tenantDb.ts
  - `statusCode: 400` — 0 matches in tenantDb.ts
  - `toBe(500)` — 1 match in tenantDb.test.ts

## Threat Model Coverage

| Threat | Disposition | Implementation |
|--------|-------------|----------------|
| T-1-01 Info Disclosure (404 → tenant enumeration) | mitigated | `devFallbackOrThrow` now throws 503 (D-06) |
| T-1-02 Info Disclosure (missing Host → DB probe) | mitigated | Host guard added before `getServerSupabase()` call (D-07) |
| T-1-03 EoP (tenantId absent = client error 400) | mitigated | Changed to 500 so Sentry captures as server bug (D-08) |
| T-1-04 DoS (repeated bad-Host) | accepted | 503 is correct retryable signal; rate limiting out of scope |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed vi.mock paths in tenant.test.ts (RED task)**
- **Found during:** Task 2 (GREEN phase test run)
- **Issue:** Initial test file used `vi.mock('../utils/tenantCache', ...)` which resolved to `middleware/utils/tenantCache.ts` (non-existent) instead of `server/utils/tenantCache.ts`. Tests were failing because mocks weren't applied, causing `useRuntimeConfig is not defined` errors.
- **Fix:** Changed mock paths to `'../../utils/supabase'` and `'../../utils/tenantCache'` (correct relative path from `middleware/__tests__/` to `server/utils/`). Also added `useRuntimeConfig` global stub and switched to real `createError` from h3 for correct H3Error shape.
- **Files modified:** `apps/storefront/server/middleware/__tests__/tenant.test.ts`
- **Commit:** 86bd428b (included with GREEN edits)

**2. [Rule 1 - Bug] Updated cross-tenant.test.ts regression (400 → 500)**
- **Found during:** Task 2 (after changing tenantDb.ts statusCode)
- **Issue:** `cross-tenant.test.ts` line 120 had `expect(caught.statusCode).toBe(400)` which became incorrect after the production code change.
- **Fix:** Updated test name and assertion to `toBe(500)`.
- **Files modified:** `apps/storefront/server/__tests__/cross-tenant.test.ts`
- **Commit:** 86bd428b

## Known Stubs

None. All three SEC-03 behaviors are fully implemented and verified.

## Threat Flags

None. No new network surface introduced — this plan modifies existing middleware throw paths only.

## Self-Check

- [x] `apps/storefront/server/middleware/__tests__/tenant.test.ts` exists
- [x] `apps/storefront/server/middleware/tenant.ts` modified (Host guard + 503 for unknown tenant)
- [x] `apps/storefront/server/utils/tenantDb.ts` modified (400 → 500)
- [x] Commits ac64b1f1 and 86bd428b exist in git log
- [x] All 317 storefront tests pass
- [x] Typecheck clean

## Self-Check: PASSED
