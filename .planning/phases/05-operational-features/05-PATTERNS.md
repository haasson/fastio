# Phase 5: Operational Features — Pattern Map

**Mapped:** 2026-05-23
**Files analyzed:** 3 (2 new, 1 modified)
**Analogs found:** 3 / 3

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/storefront/pages/terms.vue` | page/component | request-response (SSR) | `apps/storefront/pages/privacy.vue` | exact |
| `apps/storefront/shared/ui/sections/SiteFooter.vue` | component | request-response (SSR hydrated) | self (targeted diff) | exact |
| `apps/storefront/pages/terms.test.ts` | test | — | `apps/storefront/app.test.ts` | role-match |

---

## Pattern Assignments

### `apps/storefront/pages/terms.vue` (page, request-response SSR)

**Analog:** `apps/storefront/pages/privacy.vue` — direct structural clone, copy verbatim and replace content.

**Imports pattern** (privacy.vue lines 73–82):
```typescript
import { computed } from 'vue'
import { useNuxtData } from 'nuxt/app'
import { FileX } from 'lucide-vue-next'
import type { Tenant } from '@fastio/shared'
import { isLegalInfoComplete } from '@fastio/shared'
import { FsSection } from '@fastio/public-ui'
import PageShell from '~/shared/ui/sections/PageShell.vue'
import StorePageLayout from '~/shared/ui/layout/StorePageLayout.vue'
import SfEmptyState from '~/shared/ui/sf/domain/SfEmptyState.vue'
```

Add `useHead` to the `nuxt/app` import for page title:
```typescript
import { useNuxtData, useHead } from 'nuxt/app'
```

**Tenant data + gate pattern** (privacy.vue lines 84–89):
```typescript
const { data: tenant } = useNuxtData<Tenant>('tenant')

const legalInfo = computed(() => {
  const info = tenant.value?.legalInfo
  return isLegalInfoComplete(info) ? info : null
})
```

`terms.vue` uses this exact pattern. Do NOT add `deliveryEnabled` — it is not needed for the offer page.

**Page title pattern** (from `apps/storefront/pages/category/[slug].vue`, verified in RESEARCH.md):
```typescript
useHead({ title: 'Оферта' })
```

The global `titleTemplate` in `app.vue` automatically renders it as `"Оферта — Название заведения"`.

**Template shell pattern** (privacy.vue lines 1–71):
```vue
<template>
  <PageShell>
    <FsSection>
      <StorePageLayout :breadcrumbs="[{ label: 'Главная', to: '/' }]" current="Политика конфиденциальности">
        <div v-if="legalInfo" class="privacy-root">
          <!-- content sections -->
        </div>

        <SfEmptyState
          v-else
          title="Документ недоступен"
          description="Заведение ещё не опубликовало политику конфиденциальности"
        >
          <FileX :size="48" />
        </SfEmptyState>
      </StorePageLayout>
    </FsSection>
  </PageShell>
</template>
```

For `terms.vue`: replace `current="Политика конфиденциальности"` with `current="Оферта"`, `class="privacy-root"` with `class="terms-root"`, and the empty state `description`.

**legalInfo data fields available** (packages/shared/src/types/tenant.ts lines 122–128):
```typescript
export type TenantLegalInfo = {
  legalName: string
  inn: string
  ogrn: string
  legalAddress: string
  privacyEmail: string
}
```

All five fields are guaranteed non-empty when `isLegalInfoComplete()` returns true.

**Section pattern from privacy.vue** (lines 11–18) — use same structure for each §:
```vue
<section class="section">
  <h2 class="section-title">1. Оператор персональных данных</h2>
  <p>{{ legalInfo.legalName }}</p>
  <p v-if="legalInfo.inn">ИНН: {{ legalInfo.inn }}</p>
  <p v-if="legalInfo.ogrn">ОГРН/ОГРНИП: {{ legalInfo.ogrn }}</p>
  <p v-if="legalInfo.legalAddress">Адрес: {{ legalInfo.legalAddress }}</p>
  <p>E-mail: <a :href="`mailto:${legalInfo.privacyEmail}`" class="link">{{ legalInfo.privacyEmail }}</a></p>
</section>
```

Note: `v-if` on individual fields is used in `privacy.vue` even though `isLegalInfoComplete` guarantees them. Keep the same defensive pattern for consistency.

**SCSS pattern** (privacy.vue lines 94–137) — copy verbatim, replace `.privacy-root` with `.terms-root`:
```scss
.terms-root {
  display: flex;
  flex-direction: column;
  gap: 32px;
  max-width: 720px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

p, li {
  font-size: 14px;
  line-height: 1.7;
  color: var(--color-text-secondary);
  margin: 0;
}

ul {
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.link {
  color: var(--primary);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}
```

---

### `apps/storefront/shared/ui/sections/SiteFooter.vue` (component, targeted diff)

**Analog:** self — this is a targeted modification. Read the file before editing.

**Current computed block** (SiteFooter.vue lines 121–123):
```typescript
const hasPrivacy = computed(() => isLegalInfoComplete(tenant.value?.legalInfo))
const offerUrl = computed(() => tenant.value?.contacts?.offerUrl ?? null)
const hasDocuments = computed(() => hasPrivacy.value || !!offerUrl.value)
```

**After update — insert `hasTerms` and extend `hasDocuments`:**
```typescript
const hasPrivacy = computed(() => isLegalInfoComplete(tenant.value?.legalInfo))
const hasTerms = computed(() => isLegalInfoComplete(tenant.value?.legalInfo))
const offerUrl = computed(() => tenant.value?.contacts?.offerUrl ?? null)
const hasDocuments = computed(() => hasPrivacy.value || hasTerms.value || !!offerUrl.value)
```

`hasPrivacy` and `hasTerms` resolve identically (both use `isLegalInfoComplete`). Keep them as separate named computeds — the CONTEXT.md (D-09, D-10) treats privacy and terms as independent gates.

**Current footer-docs template block** (SiteFooter.vue lines 82–89):
```vue
<div v-if="hasDocuments" class="footer-docs">
  <NuxtLink v-if="hasPrivacy" to="/privacy" target="_blank" class="doc-link">
    Политика конфиденциальности
  </NuxtLink>
  <a v-if="offerUrl" :href="offerUrl" target="_blank" rel="noopener noreferrer" class="doc-link">
    Оферта
  </a>
</div>
```

**After update — add `/terms` NuxtLink between privacy and offerUrl:**
```vue
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

Label for `offerUrl` changes from "Оферта" to "Оферта (PDF)" to disambiguate when both `/terms` and `offerUrl` are present. This is Claude's discretion per CONTEXT.md (D-10 says both show independently).

No SCSS changes needed — `.doc-link` class already covers all link variants (lines 226–234).

---

### `apps/storefront/pages/terms.test.ts` (test, unit)

**Analog:** `apps/storefront/app.test.ts` — pattern for storefront unit tests using Vitest and a fake `Tenant` factory.

**Test file structure pattern** (app.test.ts lines 1–10):
```typescript
import { describe, it, expect } from 'vitest'
import type { Tenant } from '@fastio/shared'
```

Note: use relative imports (not `~/...`) — `app.test.ts` line 4 comments explain that `vitest.config.ts` binds `~` alias to `apps/admin`, not `apps/storefront`. Use relative paths from the test file location.

**Minimal fake Tenant factory pattern** (app.test.ts lines 10–116) — the `makeTenant()` function with `legalInfo: null` default, overridden in individual tests:
```typescript
function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    // ... all required fields with safe defaults ...
    legalInfo: null,
    ...overrides,
  } as Tenant
}
```

For `terms.test.ts`, override `legalInfo` with a complete object:
```typescript
const completeLegalInfo = {
  legalName: 'ООО Тест',
  inn: '1234567890',
  ogrn: '1234567890123',
  legalAddress: 'г. Москва, ул. Тестовая, д. 1',
  privacyEmail: 'privacy@test.ru',
}
```

**Test coverage for `terms.vue`** — test the `isLegalInfoComplete` gate logic (pure function, import directly from `@fastio/shared`):
```typescript
import { isLegalInfoComplete } from '@fastio/shared'
import type { TenantLegalInfo } from '@fastio/shared'

describe('terms page gate — isLegalInfoComplete', () => {
  it('returns true when all fields are non-empty', () => {
    expect(isLegalInfoComplete(completeLegalInfo)).toBe(true)
  })

  it('returns false when legalInfo is null', () => {
    expect(isLegalInfoComplete(null)).toBe(false)
  })

  it('returns false when any required field is empty string', () => {
    expect(isLegalInfoComplete({ ...completeLegalInfo, inn: '' })).toBe(false)
    expect(isLegalInfoComplete({ ...completeLegalInfo, ogrn: '  ' })).toBe(false)
  })
})
```

Note: `terms.vue` itself is an SSR page component — Vue component mounting tests are not needed. The gate function is a pure util; testing it directly is sufficient and avoids complex Nuxt plugin mocking.

---

## Shared Patterns

### Tenant data access in SSR pages
**Source:** `apps/storefront/pages/privacy.vue` line 84
**Apply to:** `terms.vue`
```typescript
const { data: tenant } = useNuxtData<Tenant>('tenant')
```
Reads from SSR cache pre-loaded by `app.vue` `useAsyncData('tenant')`. Never use `useFetch('/api/tenant')` in pages — causes duplicate server request.

### Legal info guard (single source of truth)
**Source:** `packages/shared/src/types/tenant.ts` lines 130–133
**Apply to:** `terms.vue` (computed), `SiteFooter.vue` (computed `hasTerms`)
```typescript
export function isLegalInfoComplete(legalInfo: TenantLegalInfo | null | undefined): boolean {
  if (!legalInfo) return false
  return !!(legalInfo.legalName?.trim() && legalInfo.inn?.trim() && legalInfo.ogrn?.trim() && legalInfo.legalAddress?.trim() && legalInfo.privacyEmail?.trim())
}
```

### Explicit imports (no auto-import)
**Source:** all storefront files, enforced by ESLint
**Apply to:** every file in this phase
```typescript
import { computed } from 'vue'
import { useNuxtData, useHead } from 'nuxt/app'
```
Nuxt auto-import is disabled project-wide. Forgetting explicit imports produces ESLint errors at commit.

### SCSS token-only styles (no hardcoded values)
**Source:** `apps/storefront/pages/privacy.vue` lines 108–120
**Apply to:** `terms.vue` scoped styles
```scss
.section-title {
  color: var(--color-text);   // token, not #333
}
p, li {
  color: var(--color-text-secondary);   // token
}
.link {
  color: var(--primary);   // token
}
```

---

## No Analog Found

None. All three files have direct analogs in the codebase.

---

## Metadata

**Analog search scope:** `apps/storefront/pages/`, `apps/storefront/shared/`, `packages/shared/src/types/`
**Files scanned:** 4 source files read (`privacy.vue`, `SiteFooter.vue`, `tenant.ts`, `app.test.ts`)
**Pattern extraction date:** 2026-05-23
