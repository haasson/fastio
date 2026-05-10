---
focus: tech
mapped: 2026-05-10
---

# Tech Stack

## Languages & Runtime

- **TypeScript** `^5.7.2` — used in all apps and packages (strict mode, `moduleResolution: bundler`, target `ESNext`)
- **Node.js** `>=20` (required in `engines` for all apps)
- **Deno 2** — used for Supabase Edge Functions (`supabase/functions/`)
- **SCSS/Sass** `^1.80.7` — styles in all apps and UI packages
- **SQL** — Supabase migrations in `supabase/migrations/`

## Frameworks

| Project | Framework | Version | Mode |
|---|---|---|---|
| `apps/admin` | Nuxt 3 | `^3.15.0` | SPA (SSR off), port 4710 |
| `apps/storefront` | Nuxt 3 | `^3.15.0` | SSR on, port 4711 |
| `apps/backoffice` | Nuxt 3 | `^3.15.0` | SSR (default) |
| `apps/help` | Nuxt 3 | `^3.15.0` | SSR on, port 4712 |
| `apps/landing` | Nuxt 3 | `^3.15.0` | SSR on |
| `packages/ui` | Vue 3 component library | `^3.5.13` | — |
| `packages/public-ui` | Vue 3 component library | `^3.5.13` | — |
| `packages/kit` | Vue 3 composables | `^3.5.13` | — |
| `packages/shared` | TypeScript utilities (no framework) | — | — |
| `packages/styles` | SCSS token library | — | — |
| `packages/kb` | Knowledge base content (markdown + TS index) | — | — |
| `packages/icons` | SVG icon registry (Vue components) | — | — |

## Key Dependencies

### `apps/admin`
- `nuxt` `^3.15.0` — SPA framework
- `pinia` `^3.0.4` + `@pinia/nuxt` `^0.11.3` — state management
- `@supabase/supabase-js` `^2.98.0` — database/auth/storage client
- `naive-ui` `^2.42.0` — base UI component library (wrapped by `@fastio/ui`)
- `@tiptap/core` + `@tiptap/vue-3` `^3.20.x` — rich-text editor
- `@ai-sdk/openai` `^3.0.52` + `ai` `^6.0.141` — Vercel AI SDK for OpenAI integration
- `@sentry/nuxt` `^10.47.0` — error monitoring
- `@vueuse/core` `^14.2.1` — Vue utilities
- `driver.js` `^1.4.0` — onboarding tours
- `vue-draggable-plus` `^0.6.1` — drag-and-drop
- `vue-advanced-cropper` `^2.8.9` — image cropping
- `vue-yandex-maps` `^3.0.3` — Yandex Maps integration
- `apexcharts` + `vue3-apexcharts` `^5.10.4` — charts/analytics
- `jspdf` `^4.2.1` — PDF generation
- `qrcode` `^1.5.4` — QR code generation
- `zod` `^4.3.6` — runtime validation
- `dompurify` `^3.3.3` — HTML sanitization
- `lucide-vue-next` `^0.575.0` — icon set
- `marked` `^18.0.0` — Markdown rendering

### `apps/storefront`
- `nuxt` `^3.15.0` — SSR framework
- `@supabase/ssr` `^0.8.0` + `@supabase/supabase-js` `^2.98.0` — SSR-aware Supabase client
- `pinia` `^3.0.4` + `@pinia/nuxt` `^0.11.3` — state management
- `@sentry/nuxt` `^10.47.0` — error monitoring
- `reka-ui` `^2.9.1` — headless UI primitives
- `vaul-vue` `^0.4.1` — drawer/bottom sheet
- `embla-carousel-vue` `^8.6.0` — carousel
- `photoswipe` `^5.4.4` — image lightbox
- `maska` `^3.2.0` — input masking
- `vue-yandex-maps` `^3.0.3` — Yandex Maps
- `@iconify/vue` `^5.0.0` — icon component

### `packages/ui`
- `naive-ui` `^2.42.0` — wrapped UI framework
- `dayjs` `^1.11.18` — date utilities
- `maska` `^3.2.0` — input masking
- `vaul-vue` `^0.4.1` — bottom sheet/drawer

### `packages/public-ui`
- `reka-ui` `^2.9.1` — headless primitives
- `vaul-vue` `^0.4.1` — bottom sheet
- `@vueuse/core` `^14.2.1` — composables
- `lucide-vue-next` `^0.575.0` — icons
- `node-html-parser` `^6.1.13` — server-side HTML parsing

### `packages/styles`
- `@fontsource/inter` `^5.2.6` — Inter font
- `@fontsource/urbanist` `^5.2.6` — Urbanist font

## Build & Tooling

| Tool | Version | Role |
|---|---|---|
| **pnpm** | `9.15.0` | Package manager (`packageManager` field in root `package.json`) |
| **Turborepo** | `^2.3.3` | Monorepo task orchestration (`turbo.json`) |
| **TypeScript** | `^5.7.2` | Type checking (`pnpm typecheck` → `turbo run typecheck`) |
| **Vite** | (via Nuxt) | Bundler for all Nuxt apps |
| **Vitest** | `^4.1.2` | Unit testing (`vitest.config.ts` at root) |
| **ESLint** | `^9.35.0` | Linting — config from `@fastio/shared/configs/eslint` |
| **Stylelint** | `^17.7.0` | CSS/SCSS linting across admin and packages |
| **Husky** | `^9.1.7` | Git hooks — `pre-commit` runs lint-staged + typecheck + barrier tests |
| **lint-staged** | `^16.1.6` | Runs ESLint on staged `.js/.ts/.vue` files |
| **Sass** | `^1.80.7` | SCSS compilation in all apps |
| **happy-dom** | `^20.8.9` | Test environment (simulates DOM) |
| **@vue/test-utils** | `^2.4.6` | Vue component testing helpers |
| **ts-morph** | `^28.0.0` | TypeScript AST tools (used by codemap scripts) |
| **concurrently** | `^9.1.2` | Run admin + storefront dev servers simultaneously |

**Monorepo layout:** pnpm workspaces (`pnpm-workspace.yaml`) declaring `apps/*` and `packages/*`. Turborepo orchestrates `build`, `dev`, `typecheck`, `lint` tasks with correct dependency order (`dependsOn: ["^build"]`).

**CI:** GitHub Actions (`.github/workflows/migrate.yml`) — triggers on push to `main` when `supabase/migrations/**` changes; uses `supabase/setup-cli@v1` + `supabase db push` to apply migrations to the remote project.

## Configuration

| File | What it controls |
|---|---|
| `package.json` (root) | Workspace scripts, dev dependencies, Node/pnpm engines |
| `pnpm-workspace.yaml` | Workspace package globs |
| `turbo.json` | Task pipeline, output caching |
| `tsconfig.json` (root) | Shared TypeScript compiler options |
| `vitest.config.ts` | Test config — environment, aliases, include globs for all workspace tests |
| `apps/admin/nuxt.config.ts` | Admin SPA config — SSR off, runtime config keys, Nitro storage drivers, route rules, Nuxt modules |
| `apps/storefront/nuxt.config.ts` | Storefront SSR config — runtime config keys, Nuxt modules |
| `apps/admin/.env.example` | Documents required env vars for admin (Supabase, Yandex Maps, DaData, Telegram, OpenAI) |
| `apps/storefront/.env.example` | Documents required env vars for storefront |
| `supabase/config.toml` | Local Supabase project config — DB port, auth settings, storage, edge runtime, edge function JWT rules, pg_cron analytics |
| `apps/admin/vercel.json` | Vercel deployment config for admin (region `fra1`) |
| `apps/storefront/vercel.json` | Vercel deployment config for storefront (region `fra1`) |
| `.husky/pre-commit` | Pre-commit hook: lint-staged + typecheck + ESLint barrier tests |
