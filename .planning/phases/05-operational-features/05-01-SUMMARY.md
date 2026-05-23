---
phase: 05-operational-features
plan: 01
subsystem: storefront
tags: [storefront, legal-pages, footer, vertical-slice, tdd, ssr]
requires: []
provides: ["/terms route", "SiteFooter /terms link", "isLegalInfoComplete gate test"]
affects: ["apps/storefront/pages", "apps/storefront/shared/ui/sections"]
tech-stack:
  added: []
  patterns: ["useNuxtData SSR cache", "isLegalInfoComplete gate", "TDD RED/GREEN"]
key-files:
  created:
    - apps/storefront/pages/terms.vue
    - apps/storefront/pages/terms.test.ts
  modified:
    - apps/storefront/shared/ui/sections/SiteFooter.vue
decisions:
  - "D-07: terms.vue is a structural clone of privacy.vue — mirror layout, swap content"
  - "D-08: Six §-sections (Предмет договора, Оформление заказа, Стоимость/оплата, Доставка/самовывоз, Права/обязанности, Ответственность) plus legalInfo header"
  - "D-09: isLegalInfoComplete gate — same gate as /privacy; SfEmptyState when false"
  - "D-10: SiteFooter gains hasTerms computed + NuxtLink to /terms; offerUrl label disambiguated to Оферта (PDF); hasDocuments extended"
metrics:
  duration: "5 minutes"
  completed: "2026-05-23"
  tasks: 4
  files: 3
---

# Phase 05 Plan 01: OPS-03 Legal Pages Vertical Slice Summary

**One-liner:** /terms public offer page gated by isLegalInfoComplete, reachable via SiteFooter NuxtLink, with 6 §-sections and legalInfo header sourced from useNuxtData SSR cache.

## What Was Built

### Task 1 — TDD RED: `apps/storefront/pages/terms.test.ts` (commit `078e78d2`)

Vitest unit test suite for the `isLegalInfoComplete` gate used by the /terms page.
- 6 assertions covering: complete legalInfo → true; null → false; undefined → false; empty `inn` → false; whitespace `ogrn` → false; empty `privacyEmail` → false.
- Imports `isLegalInfoComplete` and `TenantLegalInfo` from `@fastio/shared` (not `~/...` — vitest `~` alias points to apps/admin).
- No Vue component mounting — gate function is the unit under test.
- Result: `pnpm vitest run apps/storefront/pages/terms.test.ts` exits 0, 6/6 passing.

### Task 2 — TDD GREEN: `apps/storefront/pages/terms.vue` (commit `7fc88bf9`)

New SSR page rendering the public offer (оферта) for every tenant storefront.
- Structural clone of `apps/storefront/pages/privacy.vue` with offer-specific content.
- `useNuxtData<Tenant>('tenant')` to read from SSR cache (no duplicate fetch).
- `legalInfo` computed returns `info` when `isLegalInfoComplete(info)` is true, else `null`.
- `useHead({ title: 'Оферта' })` — renders as "Оферта — Название заведения" via global titleTemplate.
- Template: `StorePageLayout` with breadcrumbs `[{ label: 'Главная', to: '/' }]`, `current="Оферта"`.
- legalInfo header: `{{ legalInfo.legalName }}`, defensive `v-if` on inn/ogrn/legalAddress, mailto link for privacyEmail.
- 6 §-sections with `<h2 class="section-title">` titles per D-08.
- `SfEmptyState` fallback: `title="Документ недоступен"`, `description="Заведение ещё не опубликовало оферту"`, `<FileX :size="48" />`.
- SCSS: `.terms-root` block copied from privacy.vue, uses only `var(--color-text)`, `var(--color-text-secondary)`, `var(--primary)` tokens.
- No `definePageMeta` (public unauthenticated page), no `deliveryEnabled`, no `interface` keyword.

### Task 3 — SiteFooter.vue update (commit `86ae509e`)

Two targeted changes to `apps/storefront/shared/ui/sections/SiteFooter.vue`:

**Computed block** (new `hasTerms` + extended `hasDocuments`):
```typescript
const hasPrivacy = computed(() => isLegalInfoComplete(tenant.value?.legalInfo))
const hasTerms = computed(() => isLegalInfoComplete(tenant.value?.legalInfo))
const offerUrl = computed(() => tenant.value?.contacts?.offerUrl ?? null)
const hasDocuments = computed(() => hasPrivacy.value || hasTerms.value || !!offerUrl.value)
```

**Template block** (new NuxtLink + label disambiguation):
```vue
<NuxtLink v-if="hasTerms" to="/terms" target="_blank" class="doc-link">Оферта</NuxtLink>
<a v-if="offerUrl" ... class="doc-link">Оферта (PDF)</a>
```

- `hasPrivacy` and `hasTerms` kept as separate named computeds per D-10 (independent gates).
- No new imports — `isLegalInfoComplete` and `NuxtLink` already imported.
- No SCSS changes — `.doc-link` class covers all link variants.

## Decisions Honored

| Decision | Status |
|----------|--------|
| D-06: /privacy unchanged — terms.vue does not modify privacy.vue | Honored — privacy.vue not touched |
| D-07: terms.vue is a structural clone of privacy.vue | Honored — copy-swap approach |
| D-08: 6 §-sections (§1–§6) plus legalInfo header (≥7 `<h2 class="section-title">`) | Honored — 7 total |
| D-09: isLegalInfoComplete gate; SfEmptyState fallback | Honored |
| D-10: hasTerms + NuxtLink to /terms; offerUrl label → "Оферта (PDF)"; hasDocuments extended | Honored |

## Test Results

```
pnpm vitest run apps/storefront/pages/terms.test.ts
Test Files: 1 passed (1)
Tests: 6 passed (6)
```

## Deviations from Plan

### Pre-existing ESLint Error (Out of Scope)

**Found during:** Task 3 ESLint verification
**Issue:** `apps/storefront/server/api/table/__tests__/call.post.test.ts` line 93 — `@typescript-eslint/no-dynamic-delete` error. This is a pre-existing error not introduced by this plan.
**Action:** ESLint verified clean on both modified files (`SiteFooter.vue`, `terms.vue`). Pre-existing error logged per scope boundary rules.
**Files affected:** `apps/storefront/server/api/table/__tests__/call.post.test.ts` (not modified in this plan)

All other deviations: None — plan executed as written.

## Known Stubs

None — legalInfo fields are sourced directly from `useNuxtData('tenant')` SSR cache. No placeholder text or hardcoded mock data.

## Threat Surface Scan

No new security surface beyond what the threat model in the plan covers. All legalInfo fields rendered via Vue mustache interpolation (auto-escaped). No `v-html` used. `/terms` is an intentionally public page.

## TDD Gate Compliance

- RED gate: `test(05-01)` commit `078e78d2` — terms.test.ts created
- GREEN gate: `feat(05-01)` commit `7fc88bf9` — terms.vue created

Both gates present and in correct order.

### Task 4 — Human Verification Checkpoint (commit `86d9ada2`)

Human verification checkpoint (type: human-verify, gate: blocking) — APPROVED 2026-05-23.

The user confirmed:
- `/terms` page renders correctly with complete `legalInfo` (6 §-sections + legalInfo header visible)
- `/terms` page renders `SfEmptyState` when `legalInfo` is incomplete
- Footer shows "Оферта" NuxtLink conditionally based on `isLegalInfoComplete`
- Label disambiguation ("Оферта" vs "Оферта (PDF)") correct when both `/terms` and `offerUrl` coexist
- No regression on `/privacy` page

## Self-Check: PASSED

Files created:
- `apps/storefront/pages/terms.vue` — FOUND
- `apps/storefront/pages/terms.test.ts` — FOUND
- `apps/storefront/shared/ui/sections/SiteFooter.vue` — FOUND (modified)

Commits:
- `078e78d2` — FOUND (test RED)
- `7fc88bf9` — FOUND (feat GREEN)
- `86ae509e` — FOUND (feat SiteFooter)
- `86d9ada2` — FOUND (docs SUMMARY + state)
