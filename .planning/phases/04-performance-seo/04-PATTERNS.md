# Phase 4: Performance & SEO — Pattern Map

**Mapped:** 2026-05-23
**Files analyzed:** 8 new/modified files
**Analogs found:** 7 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/storefront/app.vue` | component (root) | request-response (SSR) | self — already exists with `useHead` block | exact |
| `apps/storefront/nuxt.config.ts` | config | — | self — already exists with `modules`, `sentry`, `runtimeConfig` | exact |
| `.github/workflows/ci.yml` | config (CI) | — | self — already exists with `check`, `security` jobs | exact |
| `lighthouserc.json` (repo root) | config (CI) | — | none in codebase | no analog |
| `apps/storefront/shared/ui/sections/SiteHeader.vue` | component | request-response | self — has `<img>` on line 5 | exact |
| `apps/storefront/shared/ui/sections/BannersSection.vue` | component | request-response | self — has `<img>` on line 16 | exact |
| `apps/storefront/shared/ui/sf/domain/SfProductCard.vue` | component | request-response | self — has `<img>` on lines 11, 60 | exact |
| `apps/storefront/shared/ui/sections/HeroSection.vue` | component | request-response | self — uses CSS `background-image` for hero, not `<img>` | partial |

---

## Pattern Assignments

### `apps/storefront/app.vue` — OG meta fix (PERF-01)

**Analog:** self — current file `apps/storefront/app.vue`

**Current useHead block** (lines 100–119) — the block to modify:
```typescript
useHead(computed(() => {
  const t = tenant.value
  const seo = t?.seo
  const title = seo?.metaTitle || t?.name || ''
  const description = seo?.metaDescription || ''
  const ogImage = seo?.ogImage || t?.siteContent?.logo || ''

  return {
    titleTemplate: (pageTitle) => pageTitle ? `${pageTitle} — ${title}` : title,
    meta: [
      { name: 'description', content: description },
      { name: 'robots', content: seo?.robots === 'noindex' ? 'noindex,nofollow' : 'index,follow' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      ...(ogImage ? [{ property: 'og:image', content: ogImage }] : []),
      { property: 'og:type', content: 'website' },
    ],
    link: [...googleFontLink.value, ...faviconLink.value],
  }
}))
```

**Import pattern** (line 16) — existing, copy for new composables:
```typescript
import { useRoute, useAsyncData, useHead, useRequestFetch } from 'nuxt/app'
```

**What to change:**
1. `ogImage` — add `.startsWith('http')` guard: `const rawOgImage = seo?.ogImage || t?.siteContent?.logo || ''; const ogImage = rawOgImage.startsWith('http') ? rawOgImage : ''`
2. `og:url` — derive from tenant data using a **null-safe** form (not `useRequestURL()` — see Pitfall 2 in RESEARCH.md). The naive `\`https://\${t?.customDomain ?? (t?.slug + '.fastio.ru')}\`` form is buggy: when both `customDomain` and `slug` are null/undefined, it expands to `https://undefined.fastio.ru` (still a syntactically valid string, but a real bug). Use the canonical null-safe form instead:
   ```typescript
   const host = t?.customDomain
     ?? (t?.slug ? `${t.slug}.fastio.ru` : '')
   const ogUrl = host ? `https://${host}` : ''
   ```
   Then conditionally include the meta entry: `...(ogUrl ? [{ property: 'og:url', content: ogUrl }] : [])` (omit entirely when host is empty rather than emit an empty/garbage string).
3. Add to meta array: the null-safe `og:url` entry (above), `{ name: 'twitter:card', content: 'summary_large_image' }`, twitter title/description/image
4. Add to link array: `...(ogUrl ? [{ rel: 'canonical', href: ogUrl }] : [])` (matches the conditional spread used for `og:url`)
5. No new import needed — `useHead` and `computed` already imported

> Authoritative implementation lives in `apps/storefront/shared/composables/buildHead.ts` (Plan 04-01 Task 2). PATTERNS.md describes the pattern; the helper file is the single source of truth. Plan 04-01 Task 1 includes Test 7 that locks `buildHead(null)` against the `https://undefined.fastio.ru` regression.

---

### `apps/storefront/nuxt.config.ts` — image module + routeRules (PERF-03, PERF-04)

**Analog:** self — current file `apps/storefront/nuxt.config.ts`

**Current modules line** (line 29) — replace:
```typescript
modules: ['@pinia/nuxt', '@nuxt/eslint', '@vueuse/nuxt', '@sentry/nuxt/module'],
```

**Current sentry config** (lines 39–46) — shows how module config objects are structured in this file:
```typescript
sentry: {
  autoInjectServerSentry: 'experimental_dynamic-import',
  sentryUrl: 'https://errors.fastio.ru',
  org: process.env.SENTRY_ORG,
  // ...
},
```

**What to add:**

Add `'@nuxt/image'` to modules array. Add after `sentry: { ... }` block:
```typescript
image: {
  provider: 'ipx',
  domains: [
    process.env.NUXT_PUBLIC_SUPABASE_URL?.replace('https://', '') ?? '',
  ],
  screens: { xs: 320, sm: 640, md: 768, lg: 1024, xl: 1280 },
  quality: 80,
  format: ['webp'],
},

routeRules: {
  '/**': { swr: 60, headers: { vary: 'Host' } },
  '/_ipx/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
  '/api/**': { headers: { 'cache-control': 'no-store' } },
},
```

---

### `.github/workflows/ci.yml` — LHCI job (PERF-02)

**Analog:** self — current file `.github/workflows/ci.yml`

**Existing `security` job** (lines 87–119) — copy structure for `lhci` job:
```yaml
security:
  runs-on: ubuntu-latest
  timeout-minutes: 15
  needs: check
  if: github.ref == 'refs/heads/main'
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
```

**`check` job step structure** (lines 14–61) — shows how steps are named and ordered. `needs: check` pattern already used by `security` job (line 91).

**What to add** — new job after `security`:
```yaml
lhci:
  name: Lighthouse CI
  runs-on: ubuntu-latest
  needs: check
  timeout-minutes: 20
  steps:
    - uses: actions/checkout@v4

    - uses: pnpm/action-setup@v4
      with:
        version: 9.15.0

    - uses: actions/setup-node@v4
      with:
        node-version: 20    # NOT 22 — @lhci/cli@0.14.0 requires >=18.16
        cache: pnpm

    - run: pnpm install --frozen-lockfile

    - name: build storefront
      run: pnpm build --filter storefront
      env:
        NUXT_PUBLIC_SUPABASE_URL: ${{ secrets.NUXT_PUBLIC_SUPABASE_URL }}
        NUXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NUXT_PUBLIC_SUPABASE_ANON_KEY }}

    - name: run LHCI
      run: npx @lhci/cli@0.14.0 autorun
      env:
        LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

---

### `lighthouserc.json` (repo root) — NEW FILE

**No analog in codebase.** Use RESEARCH.md Pattern 3 directly.

> NOTE: This sketch uses the `desktop` preset with `numberOfRuns: 3`. Plan 04-03 Task 1 OVERRIDES both fields because ROADMAP success criterion #2 mandates a "simulated mobile connection" measurement. The shipped file uses `"preset": "mobile"` and `"numberOfRuns": 5` (mobile is noisier in headless CI; 5 runs damps variance while staying under the 20-minute job timeout). PATTERNS.md is left as the pattern reference; PLAN.md is authoritative.

```json
{
  "ci": {
    "collect": {
      "url": ["https://demo.fastio.ru/"],
      "numberOfRuns": 3,
      "settings": {
        "preset": "desktop",
        "onlyCategories": ["performance"],
        "chromeFlags": "--no-sandbox --disable-dev-shm-usage"
      }
    },
    "assert": {
      "preset": "lighthouse:no-pwa",
      "assertions": {
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "first-contentful-paint": ["warn", { "maxNumericValue": 1800 }],
        "interactive": ["warn", { "maxNumericValue": 3800 }],
        "uses-optimized-images": ["warn"],
        "uses-webp-images": ["warn"],
        "render-blocking-resources": ["warn"]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

Note: RESEARCH.md Pitfall 5 — if no staging tenant exists at `demo.fastio.ru`, the planner must decide between: (a) creating a demo tenant, or (b) using `startServerCommand` + `startServerReadyPattern` with a CI-specific host env var.

---

### `apps/storefront/shared/ui/sections/SiteHeader.vue` — `<img>` → `<NuxtImg>` (PERF-03)

**Analog:** self — current file `apps/storefront/shared/ui/sections/SiteHeader.vue`

**Current `<img>` tag** (line 5) — the line to replace:
```vue
<img v-if="tenant?.siteContent?.logo" class="logo" :src="tenant.siteContent.logo" :alt="tenant.name" >
```

**Current logo CSS** (lines 232–237) — sizes to use as `width`/`height` values:
```scss
.logo {
  height: 36px;
  width: auto;
  max-width: 160px;
  object-fit: contain;
}
```

**Replace with:**
```vue
<NuxtImg
  v-if="tenant?.siteContent?.logo"
  class="logo"
  :src="tenant.siteContent.logo"
  :alt="tenant.name"
  width="160"
  height="36"
  format="webp"
  loading="eager"
  fetchpriority="high"
/>
```

No script imports needed — `NuxtImg` is a global Nuxt component (registered by `@nuxt/image` module). No style changes required — `.logo` CSS remains as-is.

---

### `apps/storefront/shared/ui/sections/BannersSection.vue` — `<img>` → `<NuxtImg>` (PERF-03)

**Analog:** self — current file `apps/storefront/shared/ui/sections/BannersSection.vue`

**Current `<img>` tag** (line 16):
```vue
<img :src="banner.url" alt="" class="slide-img" loading="lazy" >
```

**Current `.viewport` CSS** (lines 127–130) — provides aspect ratio reference:
```scss
.viewport {
  overflow: hidden;
  border-radius: var(--radius-card);
  aspect-ratio: 3 / 1;
}
```

Banner images are dynamic/variable-size from CMS. Use a representative wide-banner size:
```vue
<NuxtImg
  :src="banner.url"
  alt=""
  class="slide-img"
  width="1200"
  height="400"
  format="webp"
  loading="lazy"
  fit="cover"
/>
```

---

### `apps/storefront/shared/ui/sf/domain/SfProductCard.vue` — `<img>` → `<NuxtImg>` (PERF-03)

**Analog:** self — current file `apps/storefront/shared/ui/sf/domain/SfProductCard.vue`

**Current `<img>` tags** — two instances:

Line 11 (mobile compact layout):
```vue
<img v-if="product.photos[0]" :src="product.photos[0]" :alt="product.name" loading="lazy" >
```
Inside `.compact-photo` which is `width: 110px; height: 110px` (lines 385–389).

Line 60 (default vertical layout `#image` slot):
```vue
<img v-if="product.photos[0]" class="product-photo" :src="product.photos[0]" :alt="product.name" loading="lazy" >
```
`.product-photo` uses `width: 100%; height: 100%; object-fit: cover` (lines 275–280).

**Replace line 11 with:**
```vue
<NuxtImg
  v-if="product.photos[0]"
  :src="product.photos[0]"
  :alt="product.name"
  width="110"
  height="110"
  format="webp"
  loading="lazy"
  fit="cover"
/>
```

**Replace line 60 with:**
```vue
<NuxtImg
  v-if="product.photos[0]"
  class="product-photo"
  :src="product.photos[0]"
  :alt="product.name"
  width="400"
  height="300"
  format="webp"
  loading="lazy"
  fit="cover"
/>
```

---

### `apps/storefront/shared/ui/sections/HeroSection.vue` — fetchpriority on LCP image (PERF-03)

**Analog:** self — current file `apps/storefront/shared/ui/sections/HeroSection.vue`

**Current bg image approach** (lines 3–4, 37–39) — CSS `background-image`, not `<img>`:
```vue
<div v-if="hero.bgType === 'image' && heroContent?.bgUrl" class="bg" :style="bgStyle" />
```
```typescript
const bgStyle = computed(() => ({
  backgroundImage: `url('${props.heroContent?.bgUrl}')`,
}))
```

CSS `background-image` cannot receive `fetchpriority` or `loading` attributes. For LCP optimization, the approach must change from CSS background to `<NuxtImg>` with absolute positioning. This requires a structural change.

**Replace `.bg` div with NuxtImg** — overlay structure stays the same:
```vue
<NuxtImg
  v-if="hero.bgType === 'image' && heroContent?.bgUrl"
  class="bg"
  :src="heroContent.bgUrl"
  alt=""
  width="1280"
  height="720"
  format="webp"
  loading="eager"
  fetchpriority="high"
  fit="cover"
/>
```

**Add to `.bg` scoped styles** (currently `position: absolute; inset: 0; background-size: cover; background-position: center` — lines 65–69):
```scss
.bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
```

Remove `bgStyle` computed (lines 37–39) as it's no longer needed.

---

## Shared Patterns

### Module registration in nuxt.config.ts
**Source:** `apps/storefront/nuxt.config.ts` line 29
**Apply to:** `@nuxt/image` module addition
```typescript
modules: ['@pinia/nuxt', '@nuxt/eslint', '@vueuse/nuxt', '@sentry/nuxt/module'],
// Add '@nuxt/image' to this array
```
Module config object goes at root of `defineNuxtConfig`, same level as `sentry: { ... }`.

### NuxtImg — no explicit import needed
**Apply to:** All `.vue` files receiving `<NuxtImg>`
`NuxtImg` and `NuxtPicture` are auto-registered globally by `@nuxt/image` module — no `import` statement required in `<script setup>`. This is the one exception to the "no auto-imports" rule — module-provided components are always global.

### `<img>` replacement decision matrix
| Context | loading | fetchpriority | Reason |
|---------|---------|---------------|--------|
| Logo in `SiteHeader` | `eager` | `high` | Above fold, LCP candidate |
| Hero background image | `eager` | `high` | Above fold, LCP candidate |
| Banner carousel (first item could be above fold) | `lazy` | — | Below hero in most layouts; acceptable tradeoff |
| Product card photo | `lazy` | — | Below fold, paginated list |
| Gallery slider | `lazy` | — | Below fold |
| Cart line item | `lazy` | — | Below fold |
| Modal product photo | `lazy` | — | Only visible after interaction |

### scoped style preservation
**Apply to:** All component `<img>` → `<NuxtImg>` replacements
The existing CSS class on the replaced `<img>` (e.g., `class="logo"`, `class="product-photo"`) should be kept on `<NuxtImg>`. `@nuxt/image` renders `<img>` in the DOM with the provided class passed through — scoped styles continue to apply without change.

### Explicit imports (auto-import DISABLED)
**Source:** `apps/storefront/app.vue` line 16; `apps/storefront/shared/ui/sections/SiteHeader.vue` line 102
**Apply to:** Any new composables used in modified files
```typescript
// Pattern: explicit import from nuxt/app
import { useRoute, useAsyncData, useHead, useRequestFetch } from 'nuxt/app'
// Pattern: explicit import from vue
import { computed, ref, watch } from 'vue'
```

### CSS tokens — no hardcoded colors/spacing
**Source:** All `.vue` files with `<style scoped lang="scss">`
```scss
// Always use CSS vars, not hex/px literals:
color: var(--color-text-secondary);
background: var(--color-surface);
border-radius: var(--radius-card);
```

### Vitest alias scoping — storefront tests use relative paths
**Source:** `vitest.config.ts` line 14 (`'~': resolve(__dirname, 'apps/admin')`)
**Apply to:** Any test file under `apps/storefront/` that imports storefront sources

The root Vitest config binds the `~` alias to `apps/admin`. A storefront test that writes `import { foo } from '~/shared/...'` will silently resolve to `apps/admin/shared/...` and fail at runtime with "Cannot find module" once the storefront file exists at `apps/storefront/shared/...`.

```typescript
// ❌ WRONG — resolves to apps/admin/shared/... per vitest.config.ts
import { buildHead } from '~/shared/composables/buildHead'

// ✅ CORRECT — relative path from apps/storefront/app.test.ts
import { buildHead } from './shared/composables/buildHead'
```

The production code inside Nuxt (e.g., `apps/storefront/app.vue`) DOES use `import ... from '~/shared/...'` — that path is resolved by Nuxt's own module resolver (which scopes `~` to the running app, the storefront), independent of the Vitest config.

---

## Additional img Tags Identified (Lower Priority)

These files also have `<img>` tags but are lower priority (modals = below fold, not in initial LCP path):

| File | Line | Context | Priority |
|------|------|---------|----------|
| `apps/storefront/features/menu-catalog/components/DishModal.vue` | 10 | product modal image | low (modal) |
| `apps/storefront/shared/ui/sf/domain/SfProductModal.vue` | 10 | product modal image | low (modal) |
| `apps/storefront/features/menu-catalog/components/DishCustomization.vue` | 8 | combo item photo | low (modal) |
| `apps/storefront/features/cart/components/CartLineItem.vue` | 4 | cart line thumbnail | medium |
| `apps/storefront/shared/ui/sections/GallerySlider.vue` | 11 | gallery slider | low |
| `apps/storefront/pages/about.vue` | 6 | about page image | low |

The planner may include these in PERF-03 scope or defer to a follow-up wave.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lighthouserc.json` | config (CI) | — | No LHCI config exists; no similar JSON config files in repo root; use RESEARCH.md Pattern 3 directly |

---

## Metadata

**Analog search scope:** `apps/storefront/` (app.vue, nuxt.config.ts, shared/ui/sections/, shared/ui/sf/domain/), `.github/workflows/`
**Files scanned:** 12
**Pattern extraction date:** 2026-05-23
**Last revised:** 2026-05-23 — fixed null-unsafe `ogUrl` derivation on what was line 59 to use a null-safe ternary (matches `buildHead` in Plan 04-01 Task 2); added Vitest alias scoping pattern; flagged PATTERNS.md `lighthouserc.json` block as a non-authoritative sketch (Plan 04-03 ships `mobile` preset + 5 runs).
