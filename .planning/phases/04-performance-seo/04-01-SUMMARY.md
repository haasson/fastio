---
phase: 04-performance-seo
plan: 01
subsystem: ui
tags: [nuxt, seo, og-meta, twitter-card, ssr, vue, vitest, tdd]

# Dependency graph
requires:
  - phase: 03-e2e-testing
    provides: stable storefront SSR baseline
provides:
  - buildHead pure helper extracting OG/Twitter/canonical meta from Tenant data
  - null-safe ogUrl derivation preventing https://undefined.fastio.ru regression
  - Vitest unit tests (7) covering all head-config invariants including null-tenant safety
  - og:url, twitter card, canonical link in storefront SSR HTML (was previously missing)
affects: [04-02-NuxtImage, 04-03-LHCI]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure head-builder helper extracted from SFC — testable without rendering Vue component"
    - "Conditional meta spread pattern: ...(value ? [{ property: ..., content: value }] : [])"
    - "Null-safe slug URL: tenant?.slug ? `${tenant.slug}.fastio.ru` : '' — prevents undefined expansion"

key-files:
  created:
    - apps/storefront/shared/composables/buildHead.ts
    - apps/storefront/app.test.ts
  modified:
    - apps/storefront/app.vue

key-decisions:
  - "buildHead is a pure function receiving Tenant|null snapshot — not a composable — enabling Vitest unit testing without Vue mount"
  - "og:url derived from tenant.customDomain ?? slug.fastio.ru (not useRequestURL()) to prevent internal Coolify hostname leakage (T-4-02)"
  - "LinkEntry type uses Record<string, string | undefined> to accommodate optional favicon attributes (type, key)"
  - "Test file uses relative import './shared/composables/buildHead' not ~/ alias because vitest.config.ts binds ~ to apps/admin"

patterns-established:
  - "Pure head helper pattern: extract SSR head computation into buildHead.ts, import in app.vue"
  - "Worktree TDD: pnpm install creates node_modules in worktree from shared store; .nuxt symlinked from main repo for tsconfig resolution"

requirements-completed: [PERF-01]

# Metrics
duration: 20min
completed: 2026-05-23
---

# Phase 4 Plan 1: OG/SEO Meta Fix Summary

**buildHead pure helper extracting og:url + absolute og:image + twitter card + canonical link for storefront SSR, locked by 7 Vitest unit tests including null-tenant safety**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-23T14:03:00Z
- **Completed:** 2026-05-23T14:22:00Z
- **Tasks:** 2 (+ 1 checkpoint awaiting human verify)
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- Extracted `buildHead(tenant, googleFontLink, faviconLink): MetaObject` pure helper from `app.vue` inline computation — now testable without Vue/Nuxt
- Added `og:url` (derived from `customDomain ?? slug.fastio.ru`, null-safe), `og:type`, `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image` to SSR HTML
- Added `<link rel="canonical">` matching `og:url` (conditional — omitted when tenant has no usable host)
- Guarded `og:image` and `twitter:image` with `.startsWith('http')` — rejects javascript:, data: and relative URLs (T-4-01)
- 7 Vitest tests cover all head-config invariants; null-tenant safety test catches `https://undefined.fastio.ru` regression
- Storefront typecheck passes clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Write Vitest unit test asserting head config shape** - `835a01c1` (test)
2. **Task 2: Extract buildHead helper and rewire app.vue** - `d3ca5499` (feat)

_Note: Both tasks follow TDD flow (RED → GREEN). Task 3 is checkpoint:human-verify awaiting SSR source inspection._

## Files Created/Modified

- `apps/storefront/shared/composables/buildHead.ts` — Pure head builder: og:url (null-safe), og:image guard, twitter card, canonical link, title/description/robots meta
- `apps/storefront/app.test.ts` — 7 Vitest unit tests for buildHead invariants (relative import path, no Vue mount needed)
- `apps/storefront/app.vue` — Added `import { buildHead }` from `~/shared/composables/buildHead`; replaced inline useHead block with `buildHead(tenant.value, googleFontLink.value, faviconLink.value)`

## Decisions Made

- Used `Record<string, string | undefined>` for `LinkEntry` type to accommodate optional `type` and `key` attributes on favicon link entries — TypeScript strict mode required this
- Chose `tenant?.slug ? \`${tenant.slug}.fastio.ru\` : ''` form instead of `(tenant?.slug + '.fastio.ru')` — the latter produces `undefined.fastio.ru` when slug is falsy
- Placed `buildHead.ts` in `shared/composables/` (not `shared/utils/`) per project convention — it's a composable-adjacent helper used by the root composable

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript error: LinkEntry type too narrow for optional attributes**
- **Found during:** Task 2 (typecheck step)
- **Issue:** `LinkEntry = Record<string, string>` rejected favicon link objects that have `type?: string, key?: string` (optional properties, which TypeScript infers as `string | undefined`)
- **Fix:** Changed `LinkEntry` to `Record<string, string | undefined>` in `buildHead.ts`
- **Files modified:** `apps/storefront/shared/composables/buildHead.ts`
- **Verification:** `pnpm --filter storefront typecheck` exits 0
- **Committed in:** `d3ca5499` (Task 2 commit)

**2. [Rule 3 - Blocking] Ran pnpm install to create node_modules in worktree**
- **Found during:** Task 1 commit attempt
- **Issue:** Git worktree has no `node_modules` — pre-commit hooks (lint-staged, nuxt typecheck, vitest) couldn't find binaries; commit failed
- **Fix:** Ran `pnpm install --frozen-lockfile` from worktree root; also symlinked `.nuxt` from main repo to resolve Nuxt-generated tsconfig for Vitest
- **Files modified:** Worktree-local node_modules (not tracked in git)
- **Verification:** Pre-commit hooks pass; tests run successfully from worktree
- **Committed in:** n/a (infrastructure change, not code)

---

**Total deviations:** 2 auto-fixed (1 bug: TypeScript type narrowing; 1 blocking: worktree setup)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered

- Worktree had no `node_modules` — required `pnpm install` before pre-commit hooks could run. This is standard worktree setup that future worktree executors should handle upfront.
- `apps/storefront/tsconfig.json` extends `.nuxt/tsconfig.json` which is Nuxt-generated. Symlinked from main repo's `.nuxt/` to worktree's `apps/storefront/.nuxt/` to allow Vitest to resolve storefront TypeScript correctly.

## User Setup Required

None — no external service configuration required for this plan.

## Next Phase Readiness

- PERF-01 complete: OG meta tags will appear in SSR HTML after human verification at checkpoint
- Manual verification pending: view source of storefront page, confirm og:url/og:image/twitter:card present
- PERF-03 (@nuxt/image) and PERF-02 (LHCI) can proceed in parallel once this checkpoint clears
- `buildHead.ts` established as single source of truth for head metadata — Plans 04-02/04-03 should not modify inline useHead in app.vue

## Known Stubs

None — all meta tags are wired to live tenant data from `useAsyncData<Tenant>`.

## Threat Flags

No new threat surfaces introduced beyond those documented in the plan's `<threat_model>`.
- T-4-01 (og:image injection): mitigated by `.startsWith('http')` guard in `buildHead.ts`
- T-4-02 (internal hostname leakage via og:url): mitigated by `customDomain ?? slug.fastio.ru` derivation

## Self-Check

Verification results:

- `apps/storefront/shared/composables/buildHead.ts`: FOUND
- `apps/storefront/app.test.ts`: FOUND
- Commit `835a01c1`: FOUND (test(04-01))
- Commit `d3ca5499`: FOUND (feat(04-01))
- 7 tests passing: CONFIRMED
- storefront typecheck: CLEAN

## Self-Check: PASSED

---
*Phase: 04-performance-seo*
*Completed: 2026-05-23*
