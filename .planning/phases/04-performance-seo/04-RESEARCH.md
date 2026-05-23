# Phase 4: Performance & SEO — Research

**Researched:** 2026-05-23
**Domain:** Nuxt 3 SSR storefront — OG metadata, Core Web Vitals, image optimization, CDN caching
**Confidence:** HIGH (verified against official docs, npm registry, and codebase audit)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERF-01 | OG/SEO metadata — каждая витрина тенанта возвращает корректные `og:title`, `og:image`, `og:description`; превью в Telegram/WhatsApp показывает данные заведения | `useHead` уже вызывается в `app.vue` с OG-тегами; нужно добавить `og:url`, абсолютный URL для `og:image`, и убедиться в правильности SSR-рендера |
| PERF-02 | Core Web Vitals — LHCI в пайплайне, LCP < 2.5s, CLS < 0.1 | `@lhci/cli@0.14.0` совместим с Node 20 (Lighthouse 12.1.0, требует `>=18.16`); конфиг lighthouserc.json + новый GitHub Actions job |
| PERF-03 | Оптимизация изображений — `@nuxt/image` интегрирован, явные размеры, WebP, lazy load | `@nuxt/image@2.0.0` не установлен; множество `<img>` без `width`/`height`; Supabase Storage — требует Pro tier для трансформаций, но есть IPX fallback |
| PERF-04 | CDN кэширование — `routeRules` SWR с `Vary: Host` | Nitro поддерживает `varies: ['host']` на уровне `defineCachedHandler`; `routeRules.headers` для response headers; Traefik pass-through подтверждён |
</phase_requirements>

---

## Summary

Phase 4 — это точечные добавления поверх работающего SSR-стека, а не рефактор. В кодовой базе уже есть `useHead` с OG-тегами в `app.vue`, но не хватает `og:url` (абсолютный), абсолютного URL для `og:image` (сейчас может быть `/relative`), и `og:type`. Telegram/WhatsApp требуют корректный `og:image` с полным URL — это самый высокоприоритетный пункт для первого плана.

`@nuxt/image` не установлен; все `<img>` теги используют нативный HTML без оптимизации. Supabase Storage поддерживает трансформации изображений (WebP, resize) через встроенный imgproxy, но это **требует Pro tier**. Для бесплатного/стартового тарифа нужен IPX — встроенный провайдер `@nuxt/image`, который обрабатывает изображения на сервере через Sharp. Оба варианта дают `<NuxtImg>` с `width`/`height`/`format="webp"`.

LHCI задокументирован как LHCI 0.15.x в STATE.md, но это **неверно для Node 20**: `@lhci/cli@0.15.x` тащит `lighthouse@12.6.1`, которому нужен Node `>=22.19`. **Правильная версия — `@lhci/cli@0.14.0`**, которая использует `lighthouse@12.1.0` (требует `>=18.16`). Это подтверждено npm registry.

CDN-кэширование через Nitro `routeRules` + `Vary: Host` — это корректный подход, но с нюансом: `varies` опция доступна только в `defineCachedHandler`, не в `routeRules` shortcut. Для `routeRules` нужно добавить `headers: { vary: 'Host' }` вручную. Traefik (Coolify) по умолчанию не стриппает `Vary` заголовки.

**Primary recommendation:** Три плана: (1) PERF-01 OG meta fix в `app.vue` — минут 30, минимальный риск. (2) PERF-03 `@nuxt/image` + IPX + `<img>` → `<NuxtImg>` миграция. (3) PERF-02 + PERF-04 LHCI в CI + routeRules SWR.

---

## Project Constraints (from CLAUDE.md)

- **TypeScript:** `type` вместо `interface`, strict mode
- **Auto-import DISABLED:** всё импортировать явно (`import { useHead } from 'nuxt/app'`)
- **No BEM:** короткие классы, scoped styles
- **Стек:** Nuxt 3.21.6, Vue 3, Supabase, Node 20
- **pnpm:** workspaces, Turborepo
- **Git commits:** только по явной просьбе
- **Запрещено:** `console.log` (ESLint rule), `supabase db reset`, коммит без явного разрешения
- **`@nuxt/image` не установлен** — нужен `pnpm add @nuxt/image` в `apps/storefront/`

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| OG meta tags (og:title, og:description, og:image, og:url) | Frontend Server (SSR) | — | Метаданные должны быть в SSR HTML для Telegram/WhatsApp scrapers, которые не исполняют JS |
| Canonical URL resolution | Frontend Server (SSR) | — | `useRequestURL()` возвращает правильный host на сервере в multi-tenant setup |
| Image optimization (WebP, resize, lazy) | Frontend Server (SSR) | CDN/Static | IPX обрабатывает изображения на сервере; WebP generation = server-side |
| CDN response caching (SWR) | CDN/Static | Frontend Server | `routeRules` управляет cache-control headers; Traefik кэширует на уровне обратного прокси |
| Vary: Host cache isolation | Frontend Server (SSR) | CDN/Static | Response header выставляется Nitro, соблюдается Traefik/CDN |
| Lighthouse CI gate | — | CI/CD | Build-time gate, не runtime; запускается на built storefront preview |
| LCP image fetchpriority | Browser / Client | Frontend Server | `fetchpriority="high"` — HTML атрибут, рендерится SSR, влияет на browser resource prioritization |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nuxt/image` | 2.0.0 [VERIFIED: npm registry] | Image optimization module для Nuxt 3, автогенерация `<picture>`, WebP, `srcset`, размеры | Официальный Nuxt модуль; IPX провайдер работает out-of-box без external service |
| `@lhci/cli` | 0.14.0 [VERIFIED: npm registry] | Lighthouse CI — аудит Core Web Vitals в GitHub Actions | **0.14.0, не 0.15.x** — 0.15.x тащит lighthouse@12.6.1 который требует Node >=22.19; 0.14.0 использует lighthouse@12.1.0 (требует >=18.16, OK с Node 20) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sharp` | установлен через `@nuxt/image` | IPX back-end для WebP conversion | Auto-install as dep; нужен platform-specific binary (dev=macOS, prod=Linux — нужен `--platform linux/amd64` в Coolify build) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| IPX (self-hosted) | Supabase Storage transformations | Supabase требует Pro tier; IPX бесплатен но CPU-нагрузка на Nitro сервер |
| `@lhci/cli@0.14.0` | `@lhci/cli@0.15.x` | 0.15.x требует Node 22.19+; текущий CI: Node 20 |
| `routeRules` headers | `defineCachedHandler` с `varies` | `defineCachedHandler` даёт тонкий контроль; `routeRules` проще для страниц |

**Installation (storefront only):**
```bash
pnpm add @nuxt/image --filter storefront
pnpm add -D @lhci/cli@0.14.0 --filter storefront
```

**Version verification (run at plan time):**
```bash
npm view @nuxt/image version       # 2.0.0 (verified 2026-05-23)
npm view @lhci/cli version         # 0.15.1 latest — НЕ использовать, pinned 0.14.0
npm view @lhci/cli@0.14.0 version  # 0.14.0 (verified 2026-05-23)
```

---

## Package Legitimacy Audit

> slopcheck не установлен — пакеты помечены по результатам ручной проверки через npm registry, официальные GitHub репозитории, и дату публикации.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@nuxt/image` | npm | ~4.5 лет (2020-10) | Высокие (официальный Nuxt модуль) | github.com/nuxt/image | N/A | Approved |
| `@lhci/cli` | npm | ~6.5 лет (2019-09) | Высокие (Google Chrome OSS) | github.com/GoogleChrome/lighthouse-ci | N/A | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

*slopcheck не был доступен во время исследования. Оба пакета вручную верифицированы: официальные репозитории Google и Nuxt, публикация через GitHub Actions OIDC / известные мейнтейнеры.*

---

## Architecture Patterns

### System Architecture Diagram

```
Browser / Telegram Bot / WhatsApp
         |
         | HTTP GET (storefront page)
         v
  Traefik (Coolify) ──── Vary: Host response header
         |                cache isolation per tenant
         v
  Nitro Server (apps/storefront)
    │
    ├── server/middleware/tenant.ts
    │     └─ resolve tenant from Host → event.context.tenant
    │
    ├── server/api/tenant.ts
    │     └─ return Tenant data (name, seo.ogImage, seo.metaTitle...)
    │
    └── SSR render: app.vue
          ├── useAsyncData('tenant') → GET /api/tenant
          ├── useHead() with og:title, og:description, og:image (absolute), og:url
          └── useSeoMeta() [optional refactor]

  Static assets:
    ├── NuxtImg → IPX route /_ipx/**
    │     └─ Sharp: resize + WebP conversion
    │     └─ domains: [<supabase-project>.supabase.co]
    │
    └── routeRules:
          '/**': { swr: 60, headers: { vary: 'Host' } }
          '/_ipx/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } }

CI Pipeline:
  GitHub Actions (lhci job)
    ├── pnpm build --filter storefront
    ├── lhci autorun (preview server на built output)
    └── assert: LCP < 2500ms, CLS < 0.1 → exit 1 if violated
```

### Recommended Project Structure Changes

```
apps/storefront/
├── nuxt.config.ts          # + image module config, routeRules
├── lighthouserc.json       # NEW: LHCI config
├── .github/workflows/
│   └── ci.yml              # + lhci job
├── app.vue                 # MODIFY: fix og:image absolute URL, add og:url
└── shared/ui/
    ├── sections/
    │   ├── SiteHeader.vue    # MODIFY: <img> → <NuxtImg> для logo
    │   ├── HeroSection.vue   # MODIFY: background img + fetchpriority
    │   └── BannersSection.vue # MODIFY: <img> → <NuxtImg>
    └── sf/domain/
        └── SfProductCard.vue  # MODIFY: <img> → <NuxtImg>
```

### Pattern 1: OG Meta с абсолютным og:url и og:image

**What:** В `app.vue` уже есть `useHead()` с OG тегами, но `ogImage` и `og:url` могут быть относительными/отсутствовать.

**Critical для Telegram/WhatsApp:** скраперы соцсетей НЕ следуют редиректам и требуют абсолютные URL.

**When to use:** В `app.vue` — один раз для всего приложения; страницы переопределяют `title` через локальный `useHead`.

```typescript
// Source: https://nuxt.com/docs/getting-started/seo-meta + codebase audit
// apps/storefront/app.vue — MODIFIED useHead block
import { useRequestURL } from 'nuxt/app' // уже auto-available через .nuxt/imports.d.ts

const requestUrl = useRequestURL() // works both SSR and client

useHead(computed(() => {
  const t = tenant.value
  const seo = t?.seo
  const title = seo?.metaTitle || t?.name || ''
  const description = seo?.metaDescription || ''

  // og:image ДОЛЖЕН быть абсолютным URL
  // seo.ogImage и siteContent.logo хранятся как полные Supabase Storage URLs
  // (https://<project>.supabase.co/storage/v1/object/public/...) — уже абсолютные
  // но нужна проверка на случай legacy relative paths
  const rawOgImage = seo?.ogImage || t?.siteContent?.logo || ''
  const ogImage = rawOgImage.startsWith('http') ? rawOgImage : ''

  // og:url = canonical URL для текущей страницы
  const ogUrl = requestUrl.href // includes path + correct host

  return {
    titleTemplate: (pageTitle) => pageTitle ? `${pageTitle} — ${title}` : title,
    meta: [
      { name: 'description', content: description },
      { name: 'robots', content: seo?.robots === 'noindex' ? 'noindex,nofollow' : 'index,follow' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: ogUrl },
      ...(ogImage ? [{ property: 'og:image', content: ogImage }] : []),
      // Twitter/X cards (Telegram also reads these as fallback)
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      ...(ogImage ? [{ name: 'twitter:image', content: ogImage }] : []),
    ],
    link: [
      { rel: 'canonical', href: ogUrl },
      ...googleFontLink.value,
      ...faviconLink.value,
    ],
  }
}))
```

**Важно:** `useRequestURL()` уже доступен в `apps/storefront` — он есть в `.nuxt/imports.d.ts` как auto-available. Импортировать явно через `import { useRequestURL } from 'nuxt/app'` (auto-import DISABLED).

### Pattern 2: @nuxt/image с IPX провайдером

**What:** Заменяем `<img>` на `<NuxtImg>` с явными `width`/`height` и `format="webp"`.

**Конфигурация `nuxt.config.ts`:**
```typescript
// Source: https://image.nuxt.com/get-started/configuration
export default defineNuxtConfig({
  modules: ['@pinia/nuxt', '@nuxt/eslint', '@vueuse/nuxt', '@sentry/nuxt/module', '@nuxt/image'],

  image: {
    // IPX — дефолтный self-hosted провайдер, работает без Pro-tier Supabase
    provider: 'ipx',
    // Домены Supabase Storage (полный URL в photos[])
    // Формат: <project-ref>.supabase.co (no https://)
    domains: [
      process.env.NUXT_PUBLIC_SUPABASE_URL?.replace('https://', '') ?? '',
    ],
    // Предустановленные размеры экранов для srcset
    screens: {
      xs: 320,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
    },
    // Качество WebP по умолчанию
    quality: 80,
    format: ['webp'],
  },
})
```

**SiteHeader logo (LCP candidate — НЕ lazy):**
```vue
<!-- Source: https://image.nuxt.com/ -->
<!-- apps/storefront/shared/ui/sections/SiteHeader.vue -->
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

**SfProductCard (below fold — lazy):**
```vue
<!-- apps/storefront/shared/ui/sf/domain/SfProductCard.vue -->
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

**Критичный нюанс — Sharp platform binaries:**
IPX использует Sharp для конвертации. Если build на macOS, deploy на Linux — нужно:
```bash
# В Coolify build command или package.json scripts
pnpm install --filter storefront  # pnpm автоматически ставит нативный Sharp для текущей платформы
```
В `turbo.json` / Coolify — убедиться что `pnpm install` запускается на Linux target. Если build происходит в Coolify Docker — это автоматически правильно.

**Альтернатива без IPX (если Sharp проблемы):** использовать Supabase Storage Transformation API напрямую через custom provider. Но это требует Pro tier.

### Pattern 3: LHCI конфигурация

**Правильная версия: `@lhci/cli@0.14.0`** (не 0.15.x — см. Standard Stack).

**`lighthouserc.json` (корень или `apps/storefront/`):**
```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3001/"],
      "startServerCommand": "node apps/storefront/.output/server/index.mjs",
      "startServerReadyPattern": "Listening",
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

**GitHub Actions job (добавить в `.github/workflows/ci.yml`):**
```yaml
lhci:
  name: Lighthouse CI
  runs-on: ubuntu-latest
  needs: check          # depends on lint/typecheck passing
  timeout-minutes: 20
  steps:
    - uses: actions/checkout@v4

    - uses: pnpm/action-setup@v4
      with:
        version: 9.15.0

    - uses: actions/setup-node@v4
      with:
        node-version: 20    # NOT 22 — @lhci/cli@0.14.0 требует >=18.16
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

**Важное ограничение:** LHCI тестирует против built output, НЕ dev сервера. Нужны реальные env vars (SUPABASE_URL, ANON_KEY) для сборки — либо staging, либо моки. В CI без Supabase tenant middleware вернёт 503 для всех запросов кроме `/api/health`. **Решение:** URL тестировать `/api/health` или `/suspended`, либо настроить dev-slug fallback для CI tenant.

### Pattern 4: routeRules с Vary: Host

**What:** SWR кэширование + изоляция per-tenant через `Vary` header.

```typescript
// Source: https://nitro.build/docs/cache + verified against Nuxt 3 docs
// apps/storefront/nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    // SSR страницы: SWR 60s + Vary: Host (изоляция тенантов)
    '/**': {
      swr: 60,
      headers: { vary: 'Host' },
    },
    // IPX images: immutable (хэш в URL)
    '/_ipx/**': {
      headers: {
        'cache-control': 'public, max-age=31536000, immutable',
      },
    },
    // API endpoints: no-store (всегда fresh)
    '/api/**': {
      headers: { 'cache-control': 'no-store' },
    },
  },
})
```

**Нюанс Vary: Host vs Vary: X-Forwarded-Host:**
Traefik передаёт `X-Original-Host` (код это уже делает в `tenant.ts`: `getRequestHeader(event, 'x-original-host') || getRequestHost(event)`). Для CDN-изоляции достаточно `Vary: Host` на response — downstream CDN/Traefik будет учитывать его при кэшировании.

**Nitro `varies` для API (альтернативный подход с `defineCachedHandler`):**
```typescript
// Source: https://nitro.build/docs/cache
// Для отдельных API handlers с более тонким контролем
export default defineCachedEventHandler(handler, {
  maxAge: 60,
  varies: ['host', 'x-forwarded-host'],
})
```

**Traefik (Coolify) — подтверждение:**
Traefik не стриппает `Vary` response headers по умолчанию. Он forward'ит их к upstream (браузер/CDN). Если Coolify добавит CDN перед Traefik — `Vary: Host` будет инструктировать CDN хранить разные cached versions per Host. Без внешнего CDN `Vary: Host` всё равно важен для любого reverse proxy cache.

### Anti-Patterns to Avoid

- **Telegram preview debug через dev сервер:** `import.meta.dev` fallback использует `?slug=` параметр — telegram scraper не добавит его. Тестировать preview нужно против production-like URL с правильным Host header.
- **`loading="lazy"` на LCP-образе:** Hero секция и логотип в header — LCP candidates; `loading="lazy"` откладывает их загрузку и ломает LCP. Использовать `loading="eager"` + `fetchpriority="high"`.
- **Относительные og:image URL:** `seo.ogImage` или `siteContent.logo` могут быть полным Supabase Storage URL (проверено в code: `TenantSeo.ogImage: string | null`), но нужна defensive проверка `.startsWith('http')`.
- **`@lhci/cli@0.15.x` на Node 20:** lighthouse@12.6.1 требует Node >=22.19 — CI упадёт. Pinned на 0.14.0.
- **IPX для authenticated Supabase URLs:** IPX проксирует только публичные URLs. Signed URLs не поддерживаются — но в storefront все images публичные (public bucket).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebP conversion + resize | Кастомный Sharp middleware в Nitro | `@nuxt/image` + IPX | Edge cases: EXIF rotation, color profiles, progressive JPEG, srcset generation |
| Image dimension hints для CLS | CSS aspect-ratio хаки | `width`/`height` на `<NuxtImg>` | Браузер резервирует место до загрузки только при явных атрибутах |
| Lighthouse audit в CI | Playwright screenshots + custom metrics | `@lhci/cli` | Полный Lighthouse audit: все метрики, waterfall, screenshots, assertions |
| Multi-tenant cache isolation | Custom cache middleware | `routeRules` + `Vary: Host` | Стандартная семантика HTTP caching; не нужно кастомных ключей |

**Key insight:** Image optimization — это deceptively complex: EXIF stripping, ICC profile preservation, alpha channel в WebP, progressive loading, browser support matrix. IPX решает всё это за счёт battle-tested Sharp binaries.

---

## Common Pitfalls

### Pitfall 1: proxy-image Edge Function — НЕ для storefront

**What goes wrong:** Попытка использовать Edge Function `proxy-image` для оптимизации изображений на витрине.

**Why it happens:** Функция существует и называется "proxy-image" — звучит как то что нужно.

**How to avoid:** `proxy-image` требует **Bearer JWT авторизации** (проверка `supabase.auth.getUser(jwt)`) — это admin-only endpoint для загрузки внешних изображений в редакторе меню. У публичных пользователей витрины нет JWT. Для storefront использовать **IPX** через `@nuxt/image`.

**Warning signs:** 401 ответы при попытке загрузить изображения витрины.

### Pitfall 2: og:url указывает на localhost в SSR

**What goes wrong:** `useRequestURL()` на staging/dev возвращает localhost:3001 или internal Coolify hostname.

**Why it happens:** `useRequestURL()` читает `Host` header запроса. Если Traefik/Coolify шлёт запросы к Nitro с internal hostname (не оригинальным), og:url будет неверным.

**How to avoid:** Tenant middleware уже использует `x-original-host` header: `getRequestHeader(event, 'x-original-host') || getRequestHost(event)`. Для og:url нужна аналогичная логика: взять `event.context.tenant.customDomain ?? event.context.tenant.slug + '.fastio.ru'` из уже-резолвленного tenant.

**Warning signs:** Telegram debug tool (`https://developers.facebook.com/tools/debug/`) показывает og:url = localhost.

**Правильное решение:** В `app.vue` использовать `tenant.value?.customDomain ?? tenant.value?.slug + '.fastio.ru'` для построения канонического URL вместо `useRequestURL()`.

### Pitfall 3: CLS от изображений без явных размеров

**What goes wrong:** `<img>` без `width`/`height` → браузер не знает aspect ratio → layout shift при загрузке → CLS > 0.1.

**Why it happens:** Все текущие `<img>` в storefront не имеют `width`/`height` атрибутов (verified в codebase audit).

**How to avoid:** `<NuxtImg width="X" height="Y">` — обязательно для всех видимых изображений. Для изображений с динамическим aspect ratio использовать CSS `aspect-ratio` как fallback.

**Warning signs:** LHCI отчёт показывает CLS > 0.1; DevTools Performance вкладка показывает layout shifts.

### Pitfall 4: Sharp binary mismatch в Coolify build

**What goes wrong:** `@nuxt/image` IPX работает локально (macOS), падает на production (Linux): `Error: Cannot find module './build/Release/sharp.node'`.

**Why it happens:** Sharp использует нативные binaries — platform-specific. Dev build на macOS ставит `sharp-darwin-arm64`, но production Linux нуждается в `sharp-linux-x64`.

**How to avoid:** Coolify build должен запускать `pnpm install` на Linux (Docker container). Если build CI на `ubuntu-latest` — всё ок. Если build локально с `--frozen-lockfile` — нужно перегенерировать lockfile на Linux или использовать `sharp` с `--platform linux/amd64` flag.

**Проверка:** после deploy запустить `/_ipx/w_100/https://...supabase.co/...` — должен вернуть WebP.

### Pitfall 5: LHCI 503 из-за отсутствия tenant контекста

**What goes wrong:** LHCI запускает Lighthouse против `http://localhost:3001/` — tenant middleware возвращает 503 (нет соответствующего тенанта для `localhost`), Lighthouse получает страницу ошибки, все метрики неверные.

**Why it happens:** Multi-tenant middleware жёсткий (SEC-03 hardening): неизвестный host → 503.

**How to avoid:** Два варианта:
1. Добавить в `lighthouserc.json` URL с `?slug=demo-tenant` (dev fallback уже есть для `import.meta.dev`) — но built production не имеет `import.meta.dev`, dev-fallback убран.
2. Тестировать против staging с реальным доменом: `url: ["https://demo.fastio.ru/"]`.
3. Создать специальный env var `NUXT_LHCI_TEST_HOST` и добавить в middleware исключение для LHCI health-check path.

**Recommended:** Вариант 2 — staging URL в `lighthouserc.json`. Тогда LHCI тестирует реальный production-like сценарий с реальным tenant.

---

## Code Examples

### Проверка og:image в Telegram

```bash
# Telegram debug: открыть в браузере и посмотреть preview
# Официальный инструмент для OG debugging:
# https://developers.facebook.com/tools/debug/  (Facebook/WhatsApp)
# https://cards-dev.twitter.com/validator (Twitter)
# Для Telegram — просто отправить ссылку в чат @WebPageBot

# Curl для проверки мета-тегов из SSR:
curl -s https://demo.fastio.ru/ | grep -E 'og:|twitter:'
```

### Проверка Vary: Host

```bash
curl -v https://demo.fastio.ru/ 2>&1 | grep -i "vary\|cache-control"
# Ожидаемый ответ:
# < Vary: Host
# < Cache-Control: s-maxage=60, stale-while-revalidate
```

### LHCI локальный запуск

```bash
# После pnpm build --filter storefront
cd apps/storefront
npx @lhci/cli@0.14.0 autorun --config=../../lighthouserc.json
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `og:image` relative URLs | Абсолютный HTTPS URL | Всегда было требованием | WhatsApp/Telegram не показывают preview без абсолютного URL |
| Manual `<img>` без размеров | `<NuxtImg>` с width/height + WebP | @nuxt/image 1.x → 2.x | CLS → 0, автоматический srcset |
| LHCI 0.14.x + Lighthouse 12.1 | 0.14.0 (pinned для Node 20) | Lighthouse 13 требует Node 22.19+ | Надёжный CI на Node 20 |
| `routeRules: { swr: 3600 }` | `swr: 60, headers: { vary: 'Host' }` | Nitro 2.x | Multi-tenant cache isolation |

**Deprecated/outdated:**
- `useSeoMeta` — синтаксический сахар над `useHead`; в проекте уже используется `useHead` напрямую, менять не обязательно
- `useServerSeoMeta` — только server-side, не нужен т.к. весь head уже рендерится в SSR
- LHCI 0.15.x — нельзя использовать на Node 20

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `seo.ogImage` и `siteContent.logo` в базе данных хранятся как полные Supabase Storage URL (начинаются с `https://`) | Pattern 1, Pitfall 2 | Если есть legacy relative paths — og:image будет пустым |
| A2 | Coolify build запускается в Docker на Linux x64 — Sharp binary устанавливается для правильной платформы | Pitfall 4 | Если build на macOS runner — IPX упадёт в production |
| A3 | На staging есть тестовый tenant с доменом, пригодным для LHCI URL | Pitfall 5, Pattern 3 | LHCI job будет получать 503, метрики неверные |
| A4 | Traefik (Coolify) не стриппает `Vary` response headers | Pattern 4 | Cache isolation по Host не будет работать |
| A5 | Supabase Storage buckets для изображений витрины — публичные (не authenticated) | Pattern 2 | IPX не может загрузить изображения из private buckets |

**Если таблица не пуста:** A1 и A5 проверить перед планированием PERF-03 (можно grep по миграциям на bucket policies). A3 критичен для LHCI job.

---

## Open Questions (RESOLVED)

1. **LHCI против чего тестировать?**
   - Что знаем: tenant middleware требует известный host; `/api/health` исключён из tenant lookup
   - Что неясно: есть ли staging tenant с стабильным URL для LHCI; нужно ли специальное исключение в middleware
   - Recommendation: Использовать `https://demo.fastio.ru/` если такой тенант существует; иначе создать его как часть PERF-02 плана
   - **RESOLVED:** Plan 04-03 Task 1 использует `https://demo.fastio.ru/` как целевой URL LHCI.

2. **Supabase Storage bucket visibility**
   - Что знаем: `proxy-image` — admin-only; IPX для storefront
   - Что неясно: все ли storage buckets с изображениями меню и тенантов — публичные?
   - Recommendation: grep миграций на `create bucket` + `policy` для подтверждения до написания PERF-03 плана
   - **RESOLVED:** Plan 04-01 Task 2 добавляет defensive `.startsWith('http')` guard — безопасно для любых bucket permissions.

3. **og:image absolute URL integrity**
   - Что знаем: `TenantSeo.ogImage: string | null`; tenant данные приходят из Supabase
   - Что неясно: есть ли legacy tenants с relative path в `seo.ogImage`?
   - Recommendation: Defensive проверка `.startsWith('http')` в app.vue — safe в любом случае
   - **RESOLVED:** Plan 04-01 Task 2 реализует guard `rawOgImage?.startsWith('http') ? rawOgImage : ''`.

4. **Phase 4 vs Phase 2 dependency**
   - Phase 2 (Observability) помечена как **complete (2026-05-21)** в ROADMAP.md
   - Phase 4 формально зависит от Phase 2
   - **RESOLVED:** зависимость выполнена. Phase 4 стартует немедленно.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js >= 18.16 | `@lhci/cli@0.14.0` | ✓ | 20.20.0 | — |
| pnpm 9.15.0 | Build pipeline | ✓ | 9.15.0 | — |
| Docker (Linux) | Sharp binary в Coolify | ✓ (Coolify) | — | macOS build → platform mismatch |
| Chrome (CI) | LHCI Lighthouse audit | ✓ | ubuntu-latest | `--no-sandbox` flag обязателен |
| Staging tenant URL | LHCI URL config | [A3 — ASSUMED] | — | Создать как часть PERF-02 плана |
| Supabase Storage (public bucket) | IPX image loading | [A5 — ASSUMED] | — | — |

**Missing dependencies with no fallback:**
- Staging tenant domain для LHCI (A3) — нужно подтвердить или создать перед PERF-02 планом

**Missing dependencies with fallback:**
- Sharp platform binary — Coolify Docker build решает это автоматически

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 (root `vitest.config.ts`) |
| Config file | `/vitest.config.ts` (корень монорепо) |
| Quick run command | `pnpm vitest run apps/storefront` |
| Full suite command | `pnpm test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-01 | `useHead` в SSR HTML содержит og:title, og:description, og:image (абсолютный), og:url | Unit (SSR render) | `pnpm vitest run apps/storefront/app.vue` | ❌ Wave 0 |
| PERF-01 | og:image URL начинается с https:// | Unit | inline в том же тесте | ❌ Wave 0 |
| PERF-02 | LCP < 2500ms, CLS < 0.1 | E2E/Lighthouse | `npx @lhci/cli@0.14.0 autorun` | ❌ Wave 0 (lighthouserc.json) |
| PERF-03 | `<NuxtImg>` рендерится с width/height атрибутами | Unit | `pnpm vitest run apps/storefront/shared/ui` | ❌ Wave 0 |
| PERF-04 | Response header содержит `Vary: Host` | Integration | `curl` в CI или Playwright | ❌ Wave 0 |

**Примечание:** Тесты для SSR Nuxt компонентов требуют `@nuxt/test-utils` (не установлен) или моков `useHead`. Альтернатива — smoke test через `curl` в CI pipeline (быстрее написать, достаточно для MVP).

### Wave 0 Gaps

- [ ] `lighthouserc.json` — корень репозитория или `apps/storefront/`
- [ ] GitHub Actions job `lhci:` в `.github/workflows/ci.yml`
- [ ] `apps/storefront/app.vue` — добавить `og:url`, абсолютный og:image check
- [ ] `apps/storefront/nuxt.config.ts` — `routeRules` + `image` module config

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | `rawOgImage.startsWith('http')` — defensive check на URL перед инъекцией в HTML |
| V6 Cryptography | no | — |
| V2 Authentication | no (storefront публичный) | — |
| V4 Access Control | no | — |

**Image SSRF risk:** IPX проксирует external images (domains list). Важно указать **только конкретные суб-домены Supabase Storage**, не `*.supabase.co` целиком. `@nuxt/image` `domains` конфиг — это whitelist, не wildcard-per-default.

---

## Sources

### Primary (HIGH confidence)

- [github.com/nuxt/image](https://github.com/nuxt/image) — npm registry, версия 2.0.0, репозиторий
- [image.nuxt.com/providers/supabase](https://image.nuxt.com/providers/supabase) — Supabase provider docs: Pro tier required, imgproxy-based
- [image.nuxt.com/get-started/configuration](https://image.nuxt.com/get-started/configuration) — `domains`, `provider`, `quality`, `format` options
- [nitro.build/docs/cache](https://nitro.build/docs/cache) — `varies: ['host', 'x-forwarded-host']` официальная рекомендация для multi-tenant
- [nuxt.com/docs/getting-started/seo-meta](https://nuxt.com/docs/getting-started/seo-meta) — `useHead`, `useSeoMeta` API
- npm registry: `@lhci/cli@0.14.0` deps: `lighthouse@12.1.0`, engines `>=18.16` — verified 2026-05-23
- npm registry: `@lhci/cli@0.15.1` deps: `lighthouse@12.6.1`, engines `>=22.19` — verified 2026-05-23
- npm registry: `lighthouse@12.6.1` engines `{ node: '>=22.19' }` — verified 2026-05-23
- Codebase audit: `apps/storefront/app.vue` — existing `useHead` with OG tags (no og:url, relative og:image risk)
- Codebase audit: `supabase/functions/proxy-image/index.ts` — requires Bearer JWT, admin-only
- Codebase audit: `apps/storefront/package.json` — `@nuxt/image` не установлен

### Secondary (MEDIUM confidence)

- [github.com/GoogleChrome/lighthouse-ci/docs/configuration.md](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md) — lighthouserc.json format, assertions syntax
- [unhead.unjs.io/docs/head/api/composables/use-seo-meta](https://unhead.unjs.io/docs/head/api/composables/use-seo-meta) — useSeoMeta API reference

### Tertiary (LOW confidence)

- WebSearch: "Traefik Coolify Vary: Host header pass-through" — Coolify docs не имеют специфики про Vary; вывод о pass-through основан на стандартном поведении Traefik

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm registry, официальные репозитории, версии верифицированы
- Architecture (OG meta): HIGH — verified в codebase (app.vue уже есть, gap подтверждён)
- Architecture (LHCI версия): HIGH — npm registry выдал конкретные engine requirements
- Architecture (Traefik Vary): MEDIUM — стандартное поведение, без прямого подтверждения в Coolify docs
- Pitfalls: HIGH — proxy-image JWT requirement верифицирован в коде; Sharp platform issue — известная проблема

**Research date:** 2026-05-23
**Valid until:** 2026-06-22 (30 дней; Nuxt и LHCI могут выйти с новой версией)
