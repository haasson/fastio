# Technology Stack

**Analysis Date:** 2026-05-20

## Languages

**Primary:**
- TypeScript 5.7 - All apps and packages (`tsconfig.json` target: ESNext, strict: true)
- Vue 3 SFC (`.vue`) - All frontend apps and UI packages

**Secondary:**
- SCSS - Styling (`packages/styles/`, scoped styles in all `.vue` files)
- SQL - Supabase migrations (`supabase/migrations/`, 301 migration files)
- TypeScript/Deno - Supabase Edge Functions (`supabase/functions/`, runtime: Deno)

## Runtime

**Environment:**
- Node.js >=20 (enforced in all `package.json` `engines` fields; local: v20.20.0)
- Deno (Edge Functions only, Supabase runtime)

**Package Manager:**
- pnpm 9.15.0 (enforced via `packageManager` field in root `package.json`)
- Lockfile: `pnpm-lock.yaml` — present and committed

## Monorepo Orchestration

**Build System:**
- Turborepo 2.3.3 (`turbo.json`) — task pipeline: `build` → `^build`, `dev` persistent, `typecheck` → `^build`
- pnpm workspaces — `apps/*`, `packages/*`

## Applications

**`apps/admin`** — Nuxt 3.21, SPA (dev: SSR+client-only via routeRules, prod: SSR off), port 4710
**`apps/storefront`** — Nuxt 3.21, SSR on, port 4711
**`apps/help`** — Nuxt 3.21, SSR on, port 4712
**`apps/backoffice`** — Nuxt 3.21 (internal ops dashboard)
**`apps/landing`** — Nuxt 3.21 (public landing page)

## Internal Packages

| Package | Purpose |
|---------|---------|
| `@fastio/ui` | Admin UI library wrapping Naive UI |
| `@fastio/public-ui` | Storefront/landing UI (reka-ui based) |
| `@fastio/shared` | TypeScript types, shared utils, observability, ESLint config |
| `@fastio/kit` | Minimal shared Vue composables |
| `@fastio/icons` | Icon library (Lucide wrapper) |
| `@fastio/styles` | SCSS tokens, mixins, fontsource fonts |
| `@fastio/kb` | Knowledge base content (Markdown files) |

## Frameworks

**Core:**
- Nuxt 3.21.6 — all apps; auto-import DISABLED in all projects (explicit imports required)
- Vue 3.5.34 (pinned across workspace via pnpm overrides)
- Pinia 3.0.4 + `@pinia/nuxt` 0.11.3 — state management (setup API preferred)
- VueUse 14.2.1 + `@vueuse/nuxt` — composable utilities

**Admin UI:**
- Naive UI 2.42.0 — base component library for admin and help apps
- Tiptap 3.20 (`@tiptap/vue-3`, starter-kit, color, text-style) — rich text editor
- ApexCharts 5.10.4 + vue3-apexcharts — charts (lazy-loaded)
- vue-draggable-plus 0.6.1 — drag-and-drop lists
- vue-advanced-cropper 2.8.9 — image cropping
- driver.js 1.4.0 — product tours / onboarding
- jsPDF 4.2.1 — PDF generation (lazy-loaded)
- qrcode 1.5.4 — QR code generation (table QR codes)

**Storefront UI:**
- reka-ui 2.1 — accessible primitives (storefront and public-ui)
- vaul-vue 0.4.1 — bottom sheet drawer
- Embla Carousel 8.6 — carousel component
- PhotoSwipe 5.4.4 — image lightbox
- maska 3.2.0 — input masking

**Shared Frontend:**
- lucide-vue-next 0.575.0 — icons (all apps)
- vue-yandex-maps 3.0.3 — Yandex Maps (admin delivery zones + storefront)
- zod 4.3.6 — runtime schema validation
- marked 18.0.2 — Markdown rendering
- dompurify / isomorphic-dompurify — HTML sanitization

**AI:**
- `@ai-sdk/openai` 3.0.52 + `@ai-sdk/vue` 3.0.141 + `ai` 6.0.141 — Vercel AI SDK (admin AI assistant)

**Data Fetching:**
- `@supabase/supabase-js` 2.98.0 — database, auth, realtime, storage (all apps)
- `@supabase/ssr` 0.8.0 — SSR Supabase client (storefront)
- undici 7.25.0 — HTTP client for server-side fetches (Telegram API, proxied calls)
- lru-cache 11.3.6 — server-side caching (DaData coords, etc.)

**Testing:**
- Vitest 4.1.2 — unit tests
- `@vitest/coverage-v8` — coverage (v8 provider)
- `@vue/test-utils` 2.4.6 — Vue component testing
- happy-dom 20.8.9 — test environment (DOM simulation)
- Playwright 1.60 — E2E tests (`playwright.config.ts`)
- Deno test — Edge Function unit tests

**Build/Dev:**
- Vite (`@vitejs/plugin-vue` 6.0.5) — underlying build for Nuxt
- Sass 1.80.7 — SCSS compilation (devDep in all apps)
- TypeScript 5.7.2 — type checking

## Code Quality

**Linting:**
- ESLint 9.35 with `typescript-eslint` + `eslint-plugin-vue` — JS/TS/Vue linting
- `@nuxt/eslint` — Nuxt-specific ESLint config (storefront, help, landing)
- Stylelint 17.7 with `stylelint-config-standard-scss` + `stylelint-config-recommended-vue` + `stylelint-declaration-strict-value` — CSS/SCSS
- lint-staged 16.1.6 — pre-commit linting

**Git Hooks:**
- Husky 9.1.7 — git hooks (`/.husky/pre-commit`)
- Pre-commit: codemap scan, feature manifest validation, barrel generation check, ESLint

## Configuration

**TypeScript:**
- Root `tsconfig.json`: strict true, moduleResolution bundler, target ESNext
- Each app has its own `tsconfig.json` extending root or Nuxt-generated

**Environment:**
- `.env.local` — local dev secrets (not committed)
- Nuxt `runtimeConfig` per app defines expected env var names (see INTEGRATIONS.md)
- Supabase: `supabase/config.toml` — local dev config, project_id `fastio`, PostgreSQL 17

**Build:**
- `turbo.json` — task pipeline
- `pnpm-workspace.yaml` — workspace globs

## Platform Requirements

**Development:**
- Node >=20, pnpm 9.15.0
- Docker (Supabase local stack via `supabase start`)
- Supabase CLI

**Production:**
- VPS: 109.71.242.205 (Timeweb Cloud)
- Coolify v4 — self-hosted PaaS managing all Nuxt app deployments
- Self-hosted Supabase stack (Docker): Postgres 15.8, GoTrue 2.186, Realtime 2.76.5, Storage 1.44, Edge Runtime 1.71
- PostgreSQL 17 (local dev), 15.8 (production)
- Traefik (via Coolify) — reverse proxy, wildcard SSL for `*.fastio.ru`

---

*Stack analysis: 2026-05-20*
