---
phase: 05-operational-features
reviewed: 2026-05-24T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - apps/storefront/pages/terms.vue
  - apps/storefront/pages/terms.test.ts
  - apps/storefront/shared/ui/sections/SiteFooter.vue
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-05-24
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Three files were reviewed covering the OPS-03 legal pages vertical slice: the `/terms` route, its unit test, and the shared `SiteFooter` component that links to the new pages.

The terms page itself is straightforward and correct — the `isLegalInfoComplete` gate properly guards all content rendering. No critical bugs or security vulnerabilities were found.

Two quality issues stand out in `SiteFooter.vue`: `hasPrivacy` and `hasTerms` are computed identically (always the same value), making the distinction meaningless; and `NuxtLink` with `target="_blank"` is missing `rel="noopener noreferrer"` while the plain `<a>` tags in the same component include it correctly — inconsistency that creates a mild tabnapping risk. Additionally, the `onMounted` branch fetch is client-only in an SSR context, causing guaranteed hydration mismatch for multi-branch tenants.

The unit test file carries a known tech-debt workaround (wrong vitest `~` alias) documented in a comment but not tracked in `TECHDEBT.md`.

---

## Warnings

### WR-01: `hasPrivacy` and `hasTerms` are identical computed properties

**File:** `apps/storefront/shared/ui/sections/SiteFooter.vue:124-125`
**Issue:** Both `hasPrivacy` and `hasTerms` call `isLegalInfoComplete(tenant.value?.legalInfo)` and will always have the same boolean value. This means both document links always appear or disappear together — it is impossible for one to show without the other. The separation into two named constants implies they are independently controlled, which they are not. If a tenant ever wants to publish a privacy page but not a terms page (or vice versa), this gates them identically.

The current implementation also means `hasDocuments` simplifies to `isLegalInfoComplete(...) || !!offerUrl.value`, but the code reads as if there are three independent conditions.

**Fix:**
```ts
// Option A — if both pages always track the same gate, collapse to one flag:
const hasLegalPages = computed(() => isLegalInfoComplete(tenant.value?.legalInfo))
const hasDocuments = computed(() => hasLegalPages.value || !!offerUrl.value)

// Then in template:
// <NuxtLink v-if="hasLegalPages" to="/privacy" ...>
// <NuxtLink v-if="hasLegalPages" to="/terms" ...>

// Option B — if they should be independently controllable, derive from separate
// fields in the data model (e.g., tenant.value?.legalInfo?.publishedAt or a
// separate boolean flag per document).
```

---

### WR-02: `NuxtLink` with `target="_blank"` missing `rel="noopener noreferrer"`

**File:** `apps/storefront/shared/ui/sections/SiteFooter.vue:83,86`
**Issue:** The `/privacy` and `/terms` NuxtLink elements use `target="_blank"` without `rel="noopener noreferrer"`. This allows the opened page to access `window.opener` (tabnapping vector). The plain `<a>` elements at lines 89 and 99 in the same component correctly include `rel="noopener noreferrer"`, making the omission an inconsistency rather than an oversight of the pattern.

Note: for same-origin internal routes (which `/privacy` and `/terms` are) the practical tabnapping risk is lower than for external URLs, but the inconsistency is the primary concern.

**Fix:**
```html
<NuxtLink
  v-if="hasPrivacy"
  to="/privacy"
  target="_blank"
  rel="noopener noreferrer"
  class="doc-link"
>
  Политика конфиденциальности
</NuxtLink>
<NuxtLink
  v-if="hasTerms"
  to="/terms"
  target="_blank"
  rel="noopener noreferrer"
  class="doc-link"
>
  Оферта
</NuxtLink>
```

---

### WR-03: `onMounted` branch fetch causes SSR/client hydration mismatch for multi-branch tenants

**File:** `apps/storefront/shared/ui/sections/SiteFooter.vue:129-133`
**Issue:** `branches` is initialised as `[]` and populated only in `onMounted`, which runs client-side only. On the server, `branches.length > 1` is always `false`, so the branch block is never rendered in the SSR HTML. On the client, if `/api/branches` returns > 1 branch, Vue renders the block and Vue's hydration detects a DOM mismatch, printing a hydration warning and potentially causing layout shift / flash of missing content.

```ts
onMounted(async () => {
  try {
    branches.value = await $fetch<BranchPublic[]>('/api/branches')
  } catch { /* silent */ }
})
```

**Fix:** Use `useAsyncData` (or `useLazyAsyncData`) so the fetch runs on both server and client, ensuring consistent initial HTML:

```ts
const { data: branches } = await useAsyncData('footer-branches', () =>
  $fetch<BranchPublic[]>('/api/branches'),
  { default: () => [] as BranchPublic[] }
)
```

If SSR fetch overhead is a concern, `useLazyAsyncData` fetches client-side only but also suppresses the hydration mismatch by treating the initial value as intentionally empty.

---

### WR-04: Silent `catch` in branch fetch swallows all errors including programmer errors

**File:** `apps/storefront/shared/ui/sections/SiteFooter.vue:132`
**Issue:** `catch { /* silent */ }` swallows every possible exception — network errors, JSON parse errors, and also programming mistakes like incorrect endpoint path or response type mismatches. The footer simply shows no branches without any indication something went wrong. In production this means silent degradation with no observability.

The project's error handling convention (`CLAUDE.md`) requires `reportError(error)` in catch blocks in composables and components.

**Fix:**
```ts
} catch (error) {
  if (import.meta.dev) console.warn('[SiteFooter] failed to load branches', error)
  // branches stays [] — footer degrades gracefully
}
```

Or, with the `useAsyncData` fix from WR-03:
```ts
const { data: branches, error: branchesError } = await useAsyncData(...)
// branchesError is reactive; log via reportError if needed
```

---

## Info

### IN-01: `v-if` guards on guaranteed-non-empty fields inside `isLegalInfoComplete` block

**File:** `apps/storefront/pages/terms.vue:8-10`
**Issue:** Lines 8, 9, and 10 wrap `inn`, `ogrn`, and `legalAddress` in `v-if` guards, but the outer `v-if="legalInfo"` block already guarantees all five fields are non-empty (enforced by `isLegalInfoComplete`). The guards are dead conditionals — they can never be `false` at render time. This misleads readers into thinking these fields are optional.

By contrast, `legalName` (line 7) and `privacyEmail` (lines 11, 106) render without guards — correctly, but inconsistently with the pattern the three other fields establish.

**Fix:** Remove the dead `v-if` guards or add them to all fields for consistency:
```html
<h2 class="section-title">{{ legalInfo.legalName }}</h2>
<p>ИНН: {{ legalInfo.inn }}</p>
<p>ОГРН/ОГРНИП: {{ legalInfo.ogrn }}</p>
<p>Адрес: {{ legalInfo.legalAddress }}</p>
<p>E-mail: <a :href="`mailto:${legalInfo.privacyEmail}`" class="link">{{ legalInfo.privacyEmail }}</a></p>
```

---

### IN-02: Vitest `~` alias bug is undocumented in `TECHDEBT.md`

**File:** `apps/storefront/pages/terms.test.ts:4-5`
**Issue:** The test comment explains that the root `vitest.config.ts` line 14 binds `~` to `apps/admin`, not `apps/storefront`, forcing storefront tests to use `@fastio/shared` instead of `~/...` aliases. This is a known infrastructure limitation but is not recorded in `TECHDEBT.md`. The project's CLAUDE.md rules require tech debt to be tracked there immediately.

**Fix:** Add an entry to `TECHDEBT.md`:
```
### vitest `~` alias points to apps/admin
Root vitest.config.ts line 14 sets `~` → `apps/admin`. Storefront tests (e.g.
apps/storefront/pages/terms.test.ts) cannot use `~/...` path aliases and must
import via `@fastio/shared` or relative paths instead. Fix: add a separate
vitest workspace config per app, or use a conditional alias based on test file
path.
```

---

### IN-03: `useHead` is explicitly imported but is auto-imported in storefront

**File:** `apps/storefront/pages/terms.vue:125`
**Issue:** The storefront does not have `imports: { autoImport: false }` in its `nuxt.config.ts` (unlike admin). Nuxt auto-imports `useHead` from `#imports`. The explicit `import { useNuxtData, useHead } from 'nuxt/app'` import at line 125 is redundant for `useHead`. The `useNuxtData` import is needed (not auto-imported by default), so the import line itself is not wrong, but including `useHead` in it creates a mismatch with other storefront pages (e.g., `category/[slug].vue`) that call `useHead` without importing it.

**Fix:** Remove `useHead` from the explicit import, relying on auto-import:
```ts
import { useNuxtData } from 'nuxt/app'
```

---

_Reviewed: 2026-05-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
