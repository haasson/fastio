# Phase 5: Operational Features — Research

**Researched:** 2026-05-23
**Domain:** Storefront Vue/Nuxt pages — legal documents, footer update
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**OPS-01 — DEFERRED:** Email confirmation is out of scope for this phase. `customer_email` is not collected at checkout, so transactional email is impossible without a separate checkout form change.

**OPS-02 — ALREADY DONE:** `/order/[id]` page is fully implemented (`apps/storefront/pages/order/[id].vue`, 284 lines). Polling every 15s, IDOR guard via guest_token or auth, status display. Needs only verification, no code changes.

**OPS-03 — Implementation locked:**
- `/privacy` already exists, do not change it
- Create NEW `/terms` page: clone of `privacy.vue` structure, standard food-delivery offer text, tenant legalInfo in page header
- Sections: §1 Предмет договора, §2 Порядок оформления заказа, §3 Стоимость и оплата, §4 Доставка/самовывоз, §5 Права и обязанности, §6 Ответственность
- Show `/terms` only when `isLegalInfoComplete(tenant.legalInfo)` returns true — same gate as privacy
- Add `/terms` link to `SiteFooter.vue` via `<NuxtLink to="/terms">` next to existing `/privacy` link
- `offerUrl` (external PDF) stays and remains independent — shown if set, regardless of `/terms`
- `hasDocuments` computed in footer must include `hasTerms` condition

### Claude's Discretion

- Exact HTML text of terms offer (paragraphs 1–6) — standard legal text for food-delivery Russia
- Styling for `/terms` — copy styles from `privacy.vue`
- SEO meta for `/terms` and `/privacy`

### Deferred Ideas (OUT OF SCOPE)

- OPS-01 transactional email — backlog, requires checkout email field first
- Supabase Realtime for order page — not in this phase (polling is sufficient for MVP)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OPS-01 | Transactional email — customer receives order confirmation | **DEFERRED to backlog** — not implementable, customer_email not collected |
| OPS-02 | Order status page — accessible by unique link without login | **ALREADY IMPLEMENTED** — `apps/storefront/pages/order/[id].vue` (284 lines). Needs verification only. |
| OPS-03 | Legal pages — privacy policy and terms of service reachable from footer of every tenant | **REQUIRES:** new `/terms` page + `SiteFooter.vue` update |
</phase_requirements>

---

## Summary

Phase 5 scope has been radically narrowed by the discuss-phase session. Of three requirements, one is deferred (OPS-01), one is already done (OPS-02), and one is a focused two-file implementation: create `apps/storefront/pages/terms.vue` and update `apps/storefront/shared/ui/sections/SiteFooter.vue`.

The code patterns are fully established: `privacy.vue` is a direct model for `terms.vue` — same imports (`useNuxtData<Tenant>`, `isLegalInfoComplete` from `@fastio/shared`, `FsSection`, `PageShell`, `StorePageLayout`, `SfEmptyState`), same guard logic, same SCSS structure. The footer update is a minimal diff: add `hasTerms` computed, add a `<NuxtLink to="/terms">` in the `footer-docs` block, extend the `hasDocuments` condition.

The entire phase reduces to three deliverable tasks: (1) create `terms.vue`, (2) update `SiteFooter.vue`, (3) verify OPS-02 is working end-to-end.

**Primary recommendation:** Copy `privacy.vue` as `terms.vue`, replace text with offer content, remove `deliveryEnabled` conditional, then make a minimal targeted edit to `SiteFooter.vue`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Terms of service page render | Frontend Server (SSR) | — | Static legal page, SSR optimal for SEO and direct link access |
| Tenant legalInfo data access | Frontend Server (SSR) | Browser/Client | Data pre-loaded in app.vue via `useAsyncData('tenant')`, available via `useNuxtData` in all pages |
| Footer link rendering | Browser / Client | — | Footer is a component rendered client-side within SSR layout |
| Order status display | Browser / Client | Frontend Server (SSR) | Initial SSR render, then polling via client-side `setInterval` |
| IDOR authorization for orders | API / Backend | — | Nitro server endpoint `/api/orders/[id].get.ts` guards access |

---

## Standard Stack

No new packages are installed for this phase. All required dependencies already exist in the project.

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@fastio/shared` | workspace | `TenantLegalInfo`, `isLegalInfoComplete()`, `Tenant` type | [VERIFIED: source read] Only source of truth for legalInfo types |
| `@fastio/public-ui` | workspace | `FsSection`, `FsHeading`, `FsText`, `FsDivider` | [VERIFIED: source read] Storefront UI primitives |
| `nuxt/app` | Nuxt 3.21.6 | `useNuxtData`, `useHead` | [VERIFIED: source read] Used in every storefront page |
| `lucide-vue-next` | 0.575.0 | `FileX` icon for empty state | [VERIFIED: source read] Used in privacy.vue |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `~/shared/ui/sections/PageShell.vue` | local | Full-page shell wrapper | Every storefront page |
| `~/shared/ui/layout/StorePageLayout.vue` | local | Breadcrumb + heading layout | Sub-pages with breadcrumbs |
| `~/shared/ui/sf/domain/SfEmptyState.vue` | local | Empty/fallback state | When legalInfo is incomplete |

**Installation:** No packages to install.

---

## Package Legitimacy Audit

No external packages are being installed in this phase. All dependencies are existing workspace packages.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Browser request: GET /terms
        │
        ▼
Nitro SSR (Nuxt 3)
        │
        ├─ tenant already in SSR payload (loaded in app.vue via useAsyncData)
        │
        ├─ terms.vue: useNuxtData('tenant')
        │       │
        │       └─ isLegalInfoComplete(tenant.legalInfo)
        │               ├─ true  → render offer sections with legalInfo data
        │               └─ false → render SfEmptyState ("Документ недоступен")
        │
        └─ HTML response to browser (SSR hydrated)


SiteFooter.vue (client-side component in layout):
        │
        ├─ useNuxtData('tenant')  [SSR data, hydrated]
        │
        ├─ hasPrivacy = isLegalInfoComplete(legalInfo)
        ├─ hasTerms   = isLegalInfoComplete(legalInfo)   [NEW]
        ├─ offerUrl   = tenant.contacts.offerUrl
        │
        └─ hasDocuments = hasPrivacy || hasTerms || !!offerUrl
                │
                └─ footer-docs block (visible when hasDocuments):
                        ├─ NuxtLink to="/privacy"  (v-if="hasPrivacy")
                        ├─ NuxtLink to="/terms"    (v-if="hasTerms")    [NEW]
                        └─ <a :href="offerUrl">    (v-if="offerUrl")
```

### Recommended Project Structure

No new directories needed. Files:
```
apps/storefront/
├── pages/
│   ├── privacy.vue          # exists — do NOT modify
│   └── terms.vue            # NEW — offer page
└── shared/ui/sections/
    └── SiteFooter.vue       # UPDATE — add hasTerms + /terms link
```

### Pattern 1: Legal page with tenant gate

Established by `privacy.vue`. Clone exactly:

```vue
<!-- Source: apps/storefront/pages/privacy.vue (verified by Read) -->
<script setup lang="ts">
import { computed } from 'vue'
import { useNuxtData } from 'nuxt/app'
import { FileX } from 'lucide-vue-next'
import type { Tenant } from '@fastio/shared'
import { isLegalInfoComplete } from '@fastio/shared'
import { FsSection } from '@fastio/public-ui'
import PageShell from '~/shared/ui/sections/PageShell.vue'
import StorePageLayout from '~/shared/ui/layout/StorePageLayout.vue'
import SfEmptyState from '~/shared/ui/sf/domain/SfEmptyState.vue'

const { data: tenant } = useNuxtData<Tenant>('tenant')

const legalInfo = computed(() => {
  const info = tenant.value?.legalInfo
  return isLegalInfoComplete(info) ? info : null
})
</script>
```

`terms.vue` uses this exact same script setup. No `deliveryEnabled` needed (not relevant to offer).

### Pattern 2: SiteFooter documents block update

Current state of `SiteFooter.vue` (lines 121-123, verified by Read):
```typescript
const hasPrivacy = computed(() => isLegalInfoComplete(tenant.value?.legalInfo))
const offerUrl = computed(() => tenant.value?.contacts?.offerUrl ?? null)
const hasDocuments = computed(() => hasPrivacy.value || !!offerUrl.value)
```

After update:
```typescript
const hasPrivacy = computed(() => isLegalInfoComplete(tenant.value?.legalInfo))
const hasTerms = computed(() => isLegalInfoComplete(tenant.value?.legalInfo))
const offerUrl = computed(() => tenant.value?.contacts?.offerUrl ?? null)
const hasDocuments = computed(() => hasPrivacy.value || hasTerms.value || !!offerUrl.value)
```

Template addition (after line 85, next to privacy link):
```vue
<NuxtLink v-if="hasTerms" to="/terms" target="_blank" class="doc-link">
  Оферта
</NuxtLink>
```

Note: `hasPrivacy` and `hasTerms` resolve to the same value (both use `isLegalInfoComplete`). They are kept as separate named computeds for readability and future flexibility (e.g., if terms gate condition ever differs).

### Pattern 3: useHead for page-specific title

Following `category/[slug].vue` pattern (verified by Read):
```typescript
// Source: apps/storefront/pages/category/[slug].vue (verified)
import { useHead } from 'nuxt/app'
useHead({ title: 'Оферта' })
```

The global `buildHead` in `app.vue` provides `titleTemplate: (t) => t ? \`\${t} — \${tenantName}\` : tenantName`, so setting `title: 'Оферта'` in the page will render as `"Оферта — Название заведения"`.

### Anti-Patterns to Avoid

- **Using `useFetch` instead of `useNuxtData`:** Tenant data is pre-fetched in `app.vue`. Re-fetching via `useFetch('/api/tenant')` inside `terms.vue` would make a duplicate server request. Use `useNuxtData<Tenant>('tenant')` — it reads from SSR cache with zero overhead.
- **Adding `legalInfo` to page-specific API endpoint:** No separate endpoint needed. All required data (`legalName`, `inn`, `ogrn`, `legalAddress`, `privacyEmail`) is in `tenant.legalInfo` already loaded by `app.vue`.
- **Importing auto-imported Nuxt/Vue APIs:** All apps have auto-import DISABLED. Always write `import { computed } from 'vue'` and `import { useNuxtData, useHead } from 'nuxt/app'` explicitly.
- **Using `interface` keyword:** Project forbids `interface` — use `type` for all TypeScript types.
- **BEM class naming:** Project uses short non-BEM names. Copy `.section`, `.section-title`, `.link` from `privacy.vue` — do not rename to `terms__section` etc.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Legal page guard logic | Custom `if (!legalInfo)` with redirect | `isLegalInfoComplete()` from `@fastio/shared` | Single source of truth, already used in privacy.vue and SiteFooter.vue |
| Tenant data loading | `useFetch('/api/tenant')` in terms.vue | `useNuxtData<Tenant>('tenant')` | Data already in SSR cache, duplicate fetch wastes resources |
| Empty state UI | Custom `<div>` with error message | `SfEmptyState` component | Consistent with privacy.vue and other storefront pages |
| Page heading + breadcrumbs | Custom HTML structure | `StorePageLayout` with `:breadcrumbs` and `:current` props | Consistent nav pattern across all /privacy, /about, /delivery pages |

**Key insight:** This phase is pure reuse — every pattern already exists in `privacy.vue`. The implementation is a structural clone with different content.

---

## Runtime State Inventory

This is a greenfield page addition, not a rename/refactor. No runtime state migration needed.

- **Stored data:** None — no DB records reference `/terms` URL.
- **Live service config:** None — no n8n workflows, no external service configs.
- **OS-registered state:** None.
- **Secrets/env vars:** None.
- **Build artifacts:** None — adding a new page, no renames.

---

## Common Pitfalls

### Pitfall 1: `offerUrl` and internal `/terms` are independent, not exclusive

**What goes wrong:** Developer either (a) hides `/terms` link when `offerUrl` is set, or (b) hides `offerUrl` when `/terms` page exists.
**Why it happens:** "Offer" maps conceptually to a single thing.
**How to avoid:** Show both independently. `offerUrl` = external PDF the tenant uploaded. `/terms` = auto-generated page from `legalInfo`. Both can coexist. D-10 in CONTEXT.md confirms this explicitly.
**Warning signs:** Template has `v-if="hasTerms && !offerUrl"` — that's wrong.

### Pitfall 2: `hasTerms` and `hasPrivacy` gate conditions are identical

**What goes wrong:** Developer uses a single `hasLegal` computed for both, then later a requirement adds a different condition for terms.
**Why it happens:** They seem redundant.
**How to avoid:** Keep them as separate named computeds. Current implementation of `privacy.vue` and the planned `terms.vue` share the same gate (`isLegalInfoComplete`), but the CONTEXT.md treats them as independent. D-09 specifically says "такая же логика как у privacy" — same, not shared.
**Warning signs:** A single computed drives both `v-if="hasPrivacy"` and `v-if="hasTerms"` via same reference.

### Pitfall 3: Forgetting explicit imports (no auto-import)

**What goes wrong:** Writing `const { data } = useNuxtData(...)` without importing `useNuxtData` from `'nuxt/app'`, causing runtime error.
**Why it happens:** Nuxt auto-import is expected by developers from other projects.
**How to avoid:** The project enforces explicit imports via ESLint. Use `privacy.vue` as exact import template.
**Warning signs:** ESLint errors on commit for undefined identifiers.

### Pitfall 4: Adding `target="_blank"` to `/terms` NuxtLink might not be necessary

**What goes wrong:** The existing `/privacy` NuxtLink has `target="_blank"` — opening in new tab for internal routes is debatable.
**Why it happens:** Footer links often open externally.
**How to avoid:** Follow the existing `privacy.vue` pattern: `<NuxtLink to="/privacy" target="_blank">`. For consistency, `/terms` should use the same `target="_blank"`. The UX decision is already established.

### Pitfall 5: OPS-02 verification — accessing order page without guest_token

**What goes wrong:** Tester opens `/order/{uuid}` directly without `?t=` param and gets 404, incorrectly concluding the feature is broken.
**Why it happens:** The IDOR guard intentionally returns 404 (not 403) for unauthorized access.
**How to avoid:** Always test via the redirect from checkout which includes `?t={guest_token}`. The token is a UUID generated at order creation and stored in `orders.guest_token`. Use the URL from `/order/${id}?t=${token}` format exactly as generated by `checkout.vue`.

---

## Code Examples

### terms.vue — Full template skeleton

```vue
<!-- Source: derived from apps/storefront/pages/privacy.vue (verified by Read) -->
<template>
  <PageShell>
    <FsSection>
      <StorePageLayout :breadcrumbs="[{ label: 'Главная', to: '/' }]" current="Оферта">
        <div v-if="legalInfo" class="terms-root">
          <!-- Header with tenant legal details -->
          <section class="section">
            <h2 class="section-title">{{ legalInfo.legalName }}</h2>
            <p v-if="legalInfo.inn">ИНН: {{ legalInfo.inn }}</p>
            <p v-if="legalInfo.ogrn">ОГРН/ОГРНИП: {{ legalInfo.ogrn }}</p>
            <p v-if="legalInfo.legalAddress">Адрес: {{ legalInfo.legalAddress }}</p>
          </section>

          <!-- §1–§6 sections with standard offer text -->
          <!-- ... -->
        </div>

        <SfEmptyState
          v-else
          title="Документ недоступен"
          description="Заведение ещё не опубликовало оферту"
        >
          <FileX :size="48" />
        </SfEmptyState>
      </StorePageLayout>
    </FsSection>
  </PageShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNuxtData, useHead } from 'nuxt/app'
import { FileX } from 'lucide-vue-next'
import type { Tenant } from '@fastio/shared'
import { isLegalInfoComplete } from '@fastio/shared'
import { FsSection } from '@fastio/public-ui'
import PageShell from '~/shared/ui/sections/PageShell.vue'
import StorePageLayout from '~/shared/ui/layout/StorePageLayout.vue'
import SfEmptyState from '~/shared/ui/sf/domain/SfEmptyState.vue'

const { data: tenant } = useNuxtData<Tenant>('tenant')

const legalInfo = computed(() => {
  const info = tenant.value?.legalInfo
  return isLegalInfoComplete(info) ? info : null
})

useHead({ title: 'Оферта' })
</script>

<style scoped lang="scss">
/* Copy from privacy.vue — replace .privacy-root with .terms-root */
</style>
```

### SiteFooter.vue — Diff for /terms link

```typescript
// Source: apps/storefront/shared/ui/sections/SiteFooter.vue lines 121-123 (verified by Read)
// Before:
const hasPrivacy = computed(() => isLegalInfoComplete(tenant.value?.legalInfo))
const offerUrl = computed(() => tenant.value?.contacts?.offerUrl ?? null)
const hasDocuments = computed(() => hasPrivacy.value || !!offerUrl.value)

// After:
const hasPrivacy = computed(() => isLegalInfoComplete(tenant.value?.legalInfo))
const hasTerms = computed(() => isLegalInfoComplete(tenant.value?.legalInfo))
const offerUrl = computed(() => tenant.value?.contacts?.offerUrl ?? null)
const hasDocuments = computed(() => hasPrivacy.value || hasTerms.value || !!offerUrl.value)
```

```vue
<!-- Source: apps/storefront/shared/ui/sections/SiteFooter.vue lines 82-89 (verified by Read) -->
<!-- After: add NuxtLink for /terms between privacy and offerUrl -->
<div v-if="hasDocuments" class="footer-docs">
  <NuxtLink v-if="hasPrivacy" to="/privacy" target="_blank" class="doc-link">
    Политика конфиденциальности
  </NuxtLink>
  <NuxtLink v-if="hasTerms" to="/terms" target="_blank" class="doc-link">
    Оферта
  </NuxtLink>
  <a v-if="offerUrl" :href="offerUrl" target="_blank" rel="noopener noreferrer" class="doc-link">
    Оферта (PDF)
  </a>
</div>
```

Note: When both `/terms` and `offerUrl` exist, both show. The label for `offerUrl` should distinguish it — e.g., "Оферта (PDF)" vs "Оферта". Claude's discretion on exact label.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Checking `tenant.contacts.offerUrl` alone for offer link | `isLegalInfoComplete` gate for internal `/terms` page | Phase 5 | Two offer sources: generated page + uploaded PDF |
| `/privacy` only in footer docs block | `/privacy` + `/terms` + `offerUrl` | Phase 5 | All legal documents surface in footer |

**No deprecated patterns in this phase.**

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Using `target="_blank"` on `/terms` NuxtLink is correct, matching existing `/privacy` pattern | Code Examples | Minor UX issue only — easy to change |
| A2 | When both `hasTerms` and `offerUrl` are set, showing both links is the desired behavior | Code Examples | Footer may show confusing duplicate "Оферта" labels — need label differentiation |

---

## Open Questions

1. **Label conflict when both `/terms` and `offerUrl` exist**
   - What we know: Both should be shown independently (D-10 in CONTEXT.md)
   - What's unclear: Do they both say "Оферта" and confuse the user?
   - Recommendation: Use "Оферта (PDF)" for the external `offerUrl` link when `/terms` is also present — or always differentiate. Claude's discretion per CONTEXT.md.

---

## Environment Availability

Step 2.6: SKIPPED — no external dependencies. This phase adds one `.vue` page and edits one component. No CLI tools, databases, or runtimes beyond the existing project setup are required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `/Users/evgeniy/WebstormProjects/fastio/vitest.config.ts` |
| Quick run command | `pnpm vitest run apps/storefront` |
| Full suite command | `pnpm test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OPS-01 | DEFERRED — no implementation | — | — | — |
| OPS-02 | Order status page accessible via guest_token, polling stops on completion | manual | manual — requires live checkout flow with real Supabase | N/A |
| OPS-03 (terms.vue) | `isLegalInfoComplete` gate — renders sections when complete, SfEmptyState when not | unit | `pnpm vitest run apps/storefront/pages/terms.test.ts` | ❌ Wave 0 |
| OPS-03 (footer) | Footer shows /terms link when `isLegalInfoComplete` returns true | unit | included in same test file | ❌ Wave 0 |

**Testing note:** OPS-02 has no unit test needed — the existing implementation (`order/[id].vue`) was built without unit tests and testing it would require mocking `useFetch`, Supabase auth, etc. The success criteria specify functional verification, not unit coverage. Verification is manual via the checkout flow.

### Sampling Rate

- **Per task commit:** `pnpm vitest run apps/storefront`
- **Per wave merge:** `pnpm test:run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/storefront/pages/terms.test.ts` — covers OPS-03: renders with complete legalInfo, shows empty state without legalInfo
- [ ] No new framework install needed — Vitest already configured in `vitest.config.ts` with `apps/storefront/**/*.test.ts` glob

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — `/terms` is public, no auth |
| V3 Session Management | no | N/A |
| V4 Access Control | yes | `isLegalInfoComplete()` gate prevents showing legal page without complete tenant data |
| V5 Input Validation | yes | Tenant `legalInfo` fields are read-only from DB, no user input processed on this page |
| V6 Cryptography | no | N/A |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tenant data cross-contamination | Information Disclosure | Tenant resolved from request host in Nitro middleware (`tenant.ts`) — each domain serves its own tenant data only |
| XSS via legalInfo fields | Tampering | Vue template interpolation `{{ legalInfo.legalName }}` auto-escapes HTML — no `v-html` used for legalInfo |

**OPS-02 security:** IDOR guard already implemented and verified in `apps/storefront/server/api/orders/[id].get.ts` — returns 404 (not 403) for unauthorized access, preventing order existence enumeration.

---

## Sources

### Primary (HIGH confidence)
- `apps/storefront/pages/privacy.vue` — verified by Read — complete implementation model for terms.vue
- `apps/storefront/shared/ui/sections/SiteFooter.vue` — verified by Read — exact current state, exact lines to modify
- `packages/shared/src/types/tenant.ts` — verified by Read — `TenantLegalInfo`, `isLegalInfoComplete()`, `TenantContacts.offerUrl`
- `apps/storefront/pages/order/[id].vue` — verified by Read — OPS-02 implementation complete
- `apps/storefront/server/api/orders/[id].get.ts` — verified by Read — IDOR guard logic
- `apps/storefront/shared/composables/buildHead.ts` — verified by Read — `titleTemplate` pattern for page titles
- `apps/storefront/app.vue` — verified by Read — `useAsyncData('tenant')` SSR data flow
- `vitest.config.ts` — verified by Read — test includes `apps/storefront/**/*.test.ts`

### Secondary (MEDIUM confidence)
- `apps/storefront/pages/category/[slug].vue` — verified by Read — `useHead({ title: '...' })` page-level pattern

---

## Metadata

**Confidence breakdown:**
- OPS-02 status (already done): HIGH — read the full 284-line implementation
- OPS-03 implementation pattern: HIGH — read privacy.vue, SiteFooter.vue, tenant types directly
- Terms page offer text: ASSUMED — Claude's discretion per CONTEXT.md; standard Russian food-delivery legal text
- Footer label when both /terms and offerUrl present: LOW — no existing precedent, open question

**Research date:** 2026-05-23
**Valid until:** Stable — no external dependencies, all patterns from codebase itself
