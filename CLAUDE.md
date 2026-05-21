# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# FastFood SaaS — Инструкции для AI

## TECHDEBT.md и LATER.md

Два файла в директории автопамяти (рядом с `MEMORY.md`):

- **`TECHDEBT.md`** — технический долг: заглушки, хаки, мёртвый код, временные решения.
- **`LATER.md`** — идеи на будущее (краткий индекс). Детальные спеки — в `WISHLIST.md` корня.

**Правило:** при упоминании техдолга или идеи — сразу фиксировать в нужный файл, не дожидаясь конца сессии. Одна запись = один абзац с названием и кратким «что/почему».

---

## Codemap — карты проектов

В `.claude/codemap/` лежат карты-индексы монорепо: что есть и для чего. Список карт (TS/Vue + SCSS) — в `.claude/codemap/index.json` (читать по требованию, не всегда).

**Правила:**
1. Нужна утилка / composable / UI-компонент — загляни в карту проекта, потом пиши код.
2. Карта говорит ЧТО есть и ДЛЯ ЧЕГО. Реализацию/сигнатуру — в исходнике через Read.
3. Перед стилями (.scss / `<style>`) — Read нужную styles-карту. Используй токены `var(--…)` и миксины вместо хардкода.
4. Не грузи карты «на всякий случай» — обычно достаточно карты нужного проекта + `packages/shared.json`.

**Сигналь:** каждый раз когда читаешь файл из `.claude/codemap/`, добавь строку `📋 загружена карта: <путь>`.

**Обновление:** при `git commit` срабатывает precommit hook — обновляет карты, блокирует если `purpose: null`. Ручной запуск: `pnpm codemap:scan --all`.

---

## Сбор информации

- Если не уверен — сначала собери информацию через инструменты, не спрашивай юзера
- Перед изменениями читай релевантные файлы
- **В папках фич есть AGENTS.md** — читай перед работой с модулем
- **Никогда не выдумывай несуществующие компоненты, пропсы или API** — читай исходник, или спроси

---

## Стиль кода

- `type` вместо `interface` для TypeScript типов
- Mobile-first адаптивный дизайн
- **Стили — только в scoped styles**, не глобальные
- **Без БЭМ** — простые короткие имена классов
- Корневой класс компонента — постфикс `-root`

### UI-компоненты — что использовать

**Базовые (всегда):**
- Карточка → `UiCard` (НЕ `<div class="card">`)
- Текст → `UiText` (НЕ `<p>`/`<span>`), Заголовки → `UiTitle` (НЕ `<h*>`)
- Тег → `UiTag`, чип → `UiChip`, кнопка → `UiButton`, inline-edit → `UiEditButton`
- Пустое состояние → `UiEmpty`, Loading → `UiSkeleton`

**Layout-примитивы (проверить перед вёрсткой):**
- Заголовок страницы → `UiPageHeader`
- Секция формы → `UiFormSection`, "Label: value" → `UiKeyValue`
- Стат-карточка → `UiStatBlock`, Заголовок секции → `UiSectionHeader`

**Списки:** сортируемый → `UiDraggableList` + `UiListRow`, таблица → `UiDataTable`

**Оверлеи:**
- `UiDrawer` — сложная форма >5 полей (720-900px)
- `UiModal` — точечное действие, 1-3 поля (400-560px)
- `useConfirm()` — простое подтверждение без формы

**Запрещено:** хардкодить `padding: 12px`, `color: #333` — только токены. `<div>` с самопальными карточечными стилями вместо `UiCard`. Grid формы вручную вместо `UiFormSection`.

---

## Стиль общения

- Неформально, дружески, с юмором и лёгким подколом
- Markdown + бэктики для кода/файлов/функций
- НИКОГДА не ври и не выдумывай — точность критична
- **Никогда не используй скучные формальные фразы согласия** — реагируй с характером и сарказмом
- **Относись к юзеру как к коллеге** — вступай в дискуссии, указывай когда не прав
- **СТОП: Вопрос ≠ просьба.** На "почему X?", "зачем Y?" — ТОЛЬКО отвечай словами. Не трогай код.
- **СТОП: НИКОГДА не делать `git commit` без явного слова "коммит"/"commit"/"закоммить".**

---

## Кастомные скиллы

Хранятся в `~/.claude/skills/`. Вызов — Skill tool с именем папки.

---

## GSD для больших задач

**Триггеры — задача считается «большой» если ≥1:**
1. >5 логически связанных подзадач
2. >10 файлов на запись/правку
3. >2 часов трудозатрат
4. Многофайловая миграция / архитектурные изменения
5. Юзер явно говорит «через GSD» / «по фазам»

**Workflow:** `/gsd-discuss-phase` (если неясно) → `/gsd-plan-phase` → `/gsd-execute-phase` → `/gsd-verify-work` + `/gsd-code-review` → `/gsd-ship`

**Когда НЕ нужен:** точечный фикс 1-3 файла, code review без правок, quick-task, ответ на вопрос.

**Reverse-check:** если задача под триггер и начал без GSD — остановись, признайся юзеру, предложи переключиться.

---

## База данных

- **НИКОГДА не запускать `supabase db reset`** — дропает всю базу
- Seed: копировать в контейнер + `docker exec ... psql -f`
- Миграции: по одной через `docker exec ... psql -f <migration>`

---

## Коммиты

Правила: `../ai-frontend/COMMIT.md` (читай только когда юзер просит коммит). Нет номера задачи → `no-refs`.

### ⛔ Перед каждым коммитом: актуализировать KB

Файлы: `packages/kb/content/*.md`

Если в коммите изменения в `apps/admin/pages/`, `apps/admin/components/`, `apps/storefront/` или `packages/shared/` — обновить соответствующий KB-файл в том же коммите. **Делать автоматически, не спрашивать.**

---

## Команды

```bash
pnpm dev / dev:admin / dev:storefront / dev:help
pnpm build / typecheck / lint / lint:style / test / test:run
pnpm supabase:start / stop / studio
```

Порты: admin — 4710, help — 4712. Один тест: `pnpm vitest run <path>`.

---

## Архитектура монорепо

```
apps/admin/       — Nuxt 3, SPA (SSR off), порт 4710
apps/storefront/  — Nuxt 3, SSR on
apps/help/        — Nuxt 3, SSR on, порт 4712
packages/shared/  — @fastio/shared: TypeScript-типы
packages/ui/      — @fastio/ui: UI на базе Naive UI
packages/icons/   — @fastio/icons
packages/styles/  — @fastio/styles
packages/kb/      — @fastio/kb: база знаний
supabase/migrations/ / functions/
```

pnpm workspaces + Turborepo. Auto-import в Nuxt **отключён** — всё импортировать явно.

Детальная архитектура: [`docs/admin-arch.md`](docs/admin-arch.md), [`docs/storefront-arch.md`](docs/storefront-arch.md).

---

## Артефакты модулей (AGENTS.md + feature.manifest.ts)

В `features/<X>/` каждой материальной фичи — `feature.manifest.ts` + `AGENTS.md`. Без них precommit-hook блокирует коммит.

Детали (когда обновлять, что проверяет валидатор): [`docs/feature-manifests.md`](docs/feature-manifests.md).

---

## Пакет @fastio/ui

Компоненты оборачивают Naive UI. **Перед использованием читай исходник** `packages/ui/src/components/UiFoo.vue` — не угадывай пропсы.

Миксины: `@use '@fastio/styles/mixins/media-queries' as mq`.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Fastio**

Fastio — SaaS-платформа для заведений малого и среднего бизнеса: кафе, рестораны, бары, салоны красоты, ритейл, сервисные точки. Владельцу и персоналу — веб-админка для управления меню, заказами, командой и настройками. Клиентам — брендированный SSR-сайт-витрина для просмотра меню и оформления заказов.

**Core Value:** Заказ клиента должен поступить в заведение без потерь и задержек — всё остальное второстепенно.

### Constraints

- **Tech stack**: Nuxt 3 / Vue 3 / Supabase — менять стек не планируется
- **Timeline**: не зафиксирован, приоритет качества над сроками
- **Тест-стратегия**: E2E для критических флоу достаточно для запуска; unit-тесты бизнес-логики как бонус
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.7 - All apps and packages (`tsconfig.json` target: ESNext, strict: true)
- Vue 3 SFC (`.vue`) - All frontend apps and UI packages
- SCSS - Styling (`packages/styles/`, scoped styles in all `.vue` files)
- SQL - Supabase migrations (`supabase/migrations/`, 301 migration files)
- TypeScript/Deno - Supabase Edge Functions (`supabase/functions/`, runtime: Deno)
## Runtime
- Node.js >=20 (enforced in all `package.json` `engines` fields; local: v20.20.0)
- Deno (Edge Functions only, Supabase runtime)
- pnpm 9.15.0 (enforced via `packageManager` field in root `package.json`)
- Lockfile: `pnpm-lock.yaml` — present and committed
## Monorepo Orchestration
- Turborepo 2.3.3 (`turbo.json`) — task pipeline: `build` → `^build`, `dev` persistent, `typecheck` → `^build`
- pnpm workspaces — `apps/*`, `packages/*`
## Applications
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
- Nuxt 3.21.6 — all apps; auto-import DISABLED in all projects (explicit imports required)
- Vue 3.5.34 (pinned across workspace via pnpm overrides)
- Pinia 3.0.4 + `@pinia/nuxt` 0.11.3 — state management (setup API preferred)
- VueUse 14.2.1 + `@vueuse/nuxt` — composable utilities
- Naive UI 2.42.0 — base component library for admin and help apps
- Tiptap 3.20 (`@tiptap/vue-3`, starter-kit, color, text-style) — rich text editor
- ApexCharts 5.10.4 + vue3-apexcharts — charts (lazy-loaded)
- vue-draggable-plus 0.6.1 — drag-and-drop lists
- vue-advanced-cropper 2.8.9 — image cropping
- driver.js 1.4.0 — product tours / onboarding
- jsPDF 4.2.1 — PDF generation (lazy-loaded)
- qrcode 1.5.4 — QR code generation (table QR codes)
- reka-ui 2.1 — accessible primitives (storefront and public-ui)
- vaul-vue 0.4.1 — bottom sheet drawer
- Embla Carousel 8.6 — carousel component
- PhotoSwipe 5.4.4 — image lightbox
- maska 3.2.0 — input masking
- lucide-vue-next 0.575.0 — icons (all apps)
- vue-yandex-maps 3.0.3 — Yandex Maps (admin delivery zones + storefront)
- zod 4.3.6 — runtime schema validation
- marked 18.0.2 — Markdown rendering
- dompurify / isomorphic-dompurify — HTML sanitization
- `@ai-sdk/openai` 3.0.52 + `@ai-sdk/vue` 3.0.141 + `ai` 6.0.141 — Vercel AI SDK (admin AI assistant)
- `@supabase/supabase-js` 2.98.0 — database, auth, realtime, storage (all apps)
- `@supabase/ssr` 0.8.0 — SSR Supabase client (storefront)
- undici 7.25.0 — HTTP client for server-side fetches (Telegram API, proxied calls)
- lru-cache 11.3.6 — server-side caching (DaData coords, etc.)
- Vitest 4.1.2 — unit tests
- `@vitest/coverage-v8` — coverage (v8 provider)
- `@vue/test-utils` 2.4.6 — Vue component testing
- happy-dom 20.8.9 — test environment (DOM simulation)
- Playwright 1.60 — E2E tests (`playwright.config.ts`)
- Deno test — Edge Function unit tests
- Vite (`@vitejs/plugin-vue` 6.0.5) — underlying build for Nuxt
- Sass 1.80.7 — SCSS compilation (devDep in all apps)
- TypeScript 5.7.2 — type checking
## Code Quality
- ESLint 9.35 with `typescript-eslint` + `eslint-plugin-vue` — JS/TS/Vue linting
- `@nuxt/eslint` — Nuxt-specific ESLint config (storefront, help, landing)
- Stylelint 17.7 with `stylelint-config-standard-scss` + `stylelint-config-recommended-vue` + `stylelint-declaration-strict-value` — CSS/SCSS
- lint-staged 16.1.6 — pre-commit linting
- Husky 9.1.7 — git hooks (`/.husky/pre-commit`)
- Pre-commit: codemap scan, feature manifest validation, barrel generation check, ESLint
## Configuration
- Root `tsconfig.json`: strict true, moduleResolution bundler, target ESNext
- Each app has its own `tsconfig.json` extending root or Nuxt-generated
- `.env.local` — local dev secrets (not committed)
- Nuxt `runtimeConfig` per app defines expected env var names (see INTEGRATIONS.md)
- Supabase: `supabase/config.toml` — local dev config, project_id `fastio`, PostgreSQL 17
- `turbo.json` — task pipeline
- `pnpm-workspace.yaml` — workspace globs
## Platform Requirements
- Node >=20, pnpm 9.15.0
- Docker (Supabase local stack via `supabase start`)
- Supabase CLI
- VPS: 109.71.242.205 (Timeweb Cloud)
- Coolify v4 — self-hosted PaaS managing all Nuxt app deployments
- Self-hosted Supabase stack (Docker): Postgres 15.8, GoTrue 2.186, Realtime 2.76.5, Storage 1.44, Edge Runtime 1.71
- PostgreSQL 17 (local dev), 15.8 (production)
- Traefik (via Coolify) — reverse proxy, wildcard SSL for `*.fastio.ru`
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Vue components: `PascalCase.vue` (e.g., `ModuleCard.vue`, `OrderContent.vue`)
- TypeScript modules: `camelCase.ts` (e.g., `useOrders.ts`, `order-events.ts`, `format-order.ts`)
- Feature API files: `kebab-case.ts` under `api/` (e.g., `orders.ts`, `order-events.ts`, `order-notes.ts`)
- Stores: `kebab-case.ts` under `stores/` (e.g., `order-statuses.ts`, `deliveryZone.ts`)
- Types files: `types.ts` per feature
- Manifests: `feature.manifest.ts` per feature
- Barrel: `index.ts` per feature
- Composables: `useFoo` prefix (e.g., `useOrders`, `useDashboardStats`, `useOnboarding`)
- Arrow functions preferred for utilities: `const getDayKey = (iso: string) => iso.slice(0, 10)`
- Named exports for everything (`export function useOrders(...)`, `export const mapOrder = ...`)
- Private internals prefixed with `_` (e.g., `_orders = ref<Order[]>([])`)
- ESLint rule: `arrow-body-style: ['error', 'as-needed']` — no unnecessary braces in arrow functions
- `camelCase` throughout
- Params to ignore in unused-vars: `^_` prefix (e.g., `_data`, `_cb`)
- `type` keyword universally — `interface` is forbidden in application code (only used in `.d.ts` augmentation files like `server/types/h3-context.d.ts`)
- PascalCase for type names (e.g., `OrderUpdateData`, `DashboardPeriod`, `UseOrdersOptions`)
- Domain types in `packages/shared/src/types/` (e.g., `menu.ts`, `appointment.ts`)
- Local types defined at top of file before the composable/function
- PascalCase in templates enforced by ESLint: `vue/component-name-in-template-casing: ['error', 'PascalCase']`
- `defineProps<{...}>()` with generic syntax (no runtime validators)
- `defineEmits<{ toggle: [value: boolean] }>()` with generic event object
- Props: no default values required (`vue/require-default-prop: 'off'`)
- Block order enforced: `template` → `script` → `style`
- Short, non-BEM class names (`.module-card`, `.top`, `.icon`, `.meta`, `.footer`)
- Root element class has component-relevant name (not `-root` suffix; e.g., `.module-card` for `ModuleCard.vue`)
- Modifier classes via `&.locked`, `&--locked` in SCSS nesting
## Code Style
- Indent: 2 spaces
- Quotes: single
- Semicolons: none (`semi: false`)
- Trailing commas: always-multiline
- Arrow parens: always (`(x) => x`, not `x => x`)
- Brace style: 1tbs with `allowSingleLine: true`
- Max 1 empty line between statements
- Blank line always before `return`
- Blank line after variable declaration groups (not between consecutive declarations)
- Object spacing: `{ always }`, array spacing: never
- Indent: 2 spaces
- Self-closing for all elements: `<Component />`, `<input />`
- Max 3 attributes on single line, 1 per line when multiline
- HTML closing bracket on new line for multiline
- ESLint flat config (`eslint.config.mjs`) per app, extending `@fastio/shared/configs/eslint`
- TypeScript: `typescript-eslint` recommended
- `@typescript-eslint/no-explicit-any: 'warn'` (not error)
- `@typescript-eslint/no-unused-vars: ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]`
- `no-debugger: 'error'`
- Config: `/.stylelintrc.cjs`
- Extends: `stylelint-config-standard-scss` + `stylelint-config-recommended-vue/scss`
- Plugin: `stylelint-declaration-strict-value` enforces `var(--...)` tokens for colors, spacing, typography, border-radius (severity: warning currently)
- Storefront/landing/public-ui are exempt from strict-value rules (semantic tokens used there)
## Import Organization
- `~/` → app root (e.g., `~/shared/stores/auth` in admin)
- `@fastio/shared` → `packages/shared/src`
- `@fastio/shared/server` → `packages/shared/src/server/index.ts`
- `@fastio/shared/observability` → `packages/shared/src/observability/index.ts`
- `@fastio/ui` → `packages/ui/src`
- `@fastio/icons` → `packages/icons/src`
- `@fastio/kit` → `packages/kit/src`
- Cross-module TS imports only through barrel `~/features/<X>` (index.ts), never deep paths
- Vue components from other modules allowed via deep path: `~/features/<X>/components/Foo.vue`
- Vertical isolation (services ↔ retail) enforced by ESLint `no-restricted-imports` — full rules in `apps/admin/eslint.config.mjs`
## Error Handling
- `console.warn(...)` — for unexpected but recoverable states (e.g., `[useOrders] order not found`)
- `console.error(...)` — for Supabase/API errors in lower-level api functions
- `console.log()` is **banned** by ESLint rule (`no-restricted-syntax`)
## Logging
- `reportError(error)` — catch blocks in composables, stores, and API functions
- `reportError(error, { orderId, context })` — when additional context needed for Sentry
- `console.warn('[composableName] message')` — dev-time warnings with composable name prefix
- `console.error('[ScopeTag]', error.message, error)` — in lower-level API files (e.g., Supabase query errors)
- `import.meta.dev` guard for dev-only logging: `if (import.meta.dev) console.warn(...)`
## Comments
- Architecture decisions and non-obvious rationale (e.g., PREPROD-NNN issue references in code)
- WHY something is done a certain way, not what it does
- Workaround explanations (e.g., Nuxt 3.21 bug workaround in `nuxt.config.ts`)
- Russian language used in comments throughout (the project codebase uses Russian for inline comments and test descriptions)
## Function Design
- Options bags via typed object for composable options: `options: UseOrdersOptions = {}`
- Reactive refs passed directly: `tenantId: Ref<string>`, not raw values
- Default parameters via `??`: `options.branchId?.value ?? null`
- Composables return plain objects (not reactive wrappers): `return { orders, loading, updateStatus, page, total }`
- Store actions return void or primitive (no reactive objects from actions)
- Mapper functions return the domain type directly
## Module Design
## Vue Component Structure
## UI Component Library
- Text/Headings: `UiText`, `UiTitle` (not `<p>`, `<span>`, `<h*>`)
- Cards: `UiCard` (not `<div class="card">`)
- Buttons: `UiButton`, `UiEditButton`
- Lists: `UiDraggableList` + `UiListRow`, or `UiDataTable`
- Tags/chips: `UiTag`, `UiChip`
- Overlays: `UiDrawer` (complex forms >5 fields), `UiModal` (1-3 fields), `useConfirm()` (confirmation only)
- States: `UiEmpty`, `UiSkeleton`
- Layout: `UiPageHeader`, `UiFormSection`, `UiKeyValue`, `UiStatBlock`, `UiSectionHeader`
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## System Overview
```text
```
## Component Responsibilities
| Component | Responsibility | Location |
|-----------|----------------|----------|
| `apps/admin` | Tenant management SPA: menu, orders, staff, settings, billing | `apps/admin/` |
| `apps/storefront` | Public-facing SSR storefront for food/services ordering | `apps/storefront/` |
| `apps/help` | Help center, docs | `apps/help/` |
| `packages/shared` | Domain types (`Tenant`, `Dish`, `Order`…) + utils shared across all apps | `packages/shared/src/` |
| `packages/ui` | Admin UI component library built on Naive UI (`Ui*` components) | `packages/ui/src/` |
| `packages/public-ui` | Storefront UI components (`Fs*` prefix, no Naive UI dependency) | `packages/public-ui/src/` |
| `packages/styles` | SCSS tokens, mixins, reset | `packages/styles/` |
| `packages/icons` | Icon name enum for type-safe icon refs | `packages/icons/src/` |
| `packages/kb` | Markdown knowledge-base content served via Nitro storage | `packages/kb/content/` |
| `packages/kit` | Shared composables/utils for storefront-side kit | `packages/kit/src/` |
| `supabase/migrations` | Versioned PostgreSQL DDL (numbered 001–301+) | `supabase/migrations/` |
| `supabase/functions` | Deno edge functions invoked by admin or webhooks | `supabase/functions/` |
## Pattern Overview
- Each domain feature lives in `features/<X>/` with its own `api/`, `composables/`, `components/`, `stores/`, `index.ts` barrel.
- Cross-feature imports only allowed through the public barrel (`~/features/<X>` → `index.ts`). Deep-path imports (`~/features/<X>/api/Y`) are forbidden cross-module by ESLint rules.
- Business verticals (retail vs services) are isolated by ESLint barriers: retail features cannot import services features and vice versa. Aggregator files (pages, `useGate.ts`, `useCatalogMode.ts`) are in an explicit ESLint allow-list.
- Supabase client is provided via Nuxt plugin (`$supabase`). Admin accesses DB through `useDatabase()` aggregator that binds the client to every feature's raw API functions.
- Storefront accesses DB only through Nitro server endpoints (`server/api/*.ts`). Direct Supabase calls from storefront client are an anti-pattern.
## Layers
- Purpose: Nuxt file-based routing, compose feature composables, render UI
- Location: `apps/admin/pages/`
- Contains: `.vue` route files, no business logic
- Depends on: `features/<X>` barrels, `shared/*`
- Used by: end users via browser
- Purpose: Encapsulated domain modules (api, composables, components, stores)
- Location: `apps/admin/features/<X>/`
- Contains: `api/*.ts` (CRUD), `composables/use*.ts`, `components/*.vue`, `stores/*.ts`, `index.ts` (barrel), `feature.manifest.ts`, `AGENTS.md`
- Depends on: `~/shared/*`, `@fastio/*` packages
- Used by: pages, other features (via barrel only)
- Purpose: Cross-feature infrastructure; dependencies flow FROM features TO shared, never reverse
- Location: `apps/admin/shared/`
- Sub-layers:
- Purpose: Thin CRUD wrappers around Supabase client, receive `SupabaseClient` as first arg
- Location: `apps/admin/features/<X>/api/*.ts` and `apps/admin/shared/data/api/*.ts`
- Pattern: pure functions `(sb: SupabaseClient, ...args) => Promise<...>`
- Used by: `useDatabase()` which binds `sb` and exposes bound methods
- Purpose: SSR route files, aggregators for hybrid retail/services pages
- Location: `apps/storefront/pages/`
- Hybrid pages: `index.vue`, `menu.vue`, `cart.vue`, `checkout.vue`, `category/*` — show retail or services UI based on `businessType`
- Vertical-only: `booking.vue` (retail), `appointments/*` (services)
- Purpose: Domain modules for the public storefront
- Location: `apps/storefront/features/<X>/`
- Same structure as admin features: `api/`, `composables/`, `stores/`, `index.ts`, `feature.manifest.ts`, `AGENTS.md`
- Key modules: `menu-catalog`, `cart`, `checkout`, `delivery`, `booking`, `appointments`, `services-catalog`, `auth`, `branch`, `account`
- Purpose: All DB reads for storefront — proxied through Nitro to use service-role key safely
- Location: `apps/storefront/server/`
- Sub-layers:
- Purpose: Cross-feature utilities for the storefront client
- Location: `apps/storefront/shared/`
- Contains: composables (`useTheme`, `useToast`, `useCurrency`, `useCatalogMode`), utils, layout UI components
- `shared/ui/sections/` — `SiteHeader.vue`, `SiteFooter.vue`, `HeroSection.vue`, `CategoryBar.vue`, etc.
## Data Flow
### Admin — Primary Request Path
### Admin — Realtime Path
### Storefront — Primary Request Path (SSR)
### Feature Gate Flow (Admin)
- Admin: Pinia stores for global state (`auth`, `tenant`, `branch`), reactive `ref` in feature composables for local state
- Storefront: Pinia stores in feature folders (`cart/stores/cart.ts`, etc.), SSR-compatible with `useState()`
## Key Abstractions
- Purpose: Single access point to all Supabase CRUD — injects `$supabase` client into every API module
- File: `apps/admin/shared/data/useDatabase.ts`
- Pattern: `bindAll(featureApi, sb)` — wraps every function to pre-fill `SupabaseClient` arg
- Purpose: Machine-readable metadata per module — routes, permissions, DB tables, realtime subs, dependencies
- Files: `apps/admin/features/<X>/feature.manifest.ts`, `apps/storefront/features/<X>/feature.manifest.ts`
- Type: `FeatureManifest` / `StorefrontFeatureManifest` from `apps/admin/features/_manifest.ts`
- Validated at pre-commit via `scripts/features/validate-manifests.mjs`
- Purpose: Generic composables for Supabase Realtime-backed reactive lists/single objects
- Files: `apps/admin/shared/data/useRealtimeList.ts`, `apps/admin/shared/data/useRealtimeWatch.ts`
- Pattern: receives `channelKey`, `table`, `filter`, `fetch`, `mapper` — handles subscribe/unsubscribe lifecycle
- Purpose: Public API of a feature module — only way to import from another module
- Files: `apps/admin/features/<X>/index.ts`, `apps/storefront/features/<X>/index.ts`
- Pattern: re-exports composables, components, types that are safe for cross-module use
- Purpose: Centralized feature access control — checks plan tier, module toggle, permissions, suspension
- Files: `apps/admin/shared/plan/useGate.ts`, `useGate.retail.ts`, `useGate.services.ts`
- Returns `GateResult = { enabled: boolean, reason: string }` — UI uses `reason` to show correct banner
- Purpose: Map incoming request host to `Tenant` row; cache to avoid DB round-trip per request
- Files: `apps/storefront/server/middleware/tenant.ts`, `apps/storefront/server/utils/tenantCache.ts`
- Pattern: LRU in-memory cache with stampede protection; subscription status always re-fetched fresh
## Entry Points
- Location: `apps/admin/app.vue` (root), `apps/admin/plugins/supabase.client.ts` (bootstrap)
- Triggers: browser loads SPA shell
- Responsibilities: create Supabase client, set auth state, run global middleware
- Location: `apps/storefront/app/` or `apps/storefront/pages/index.vue`
- Server entry: `apps/storefront/server/middleware/tenant.ts` (runs on every request)
- Responsibilities: resolve tenant, serve SSR HTML with tenant-specific data
- Location: `supabase/functions/<name>/index.ts`
- Triggers: admin panel actions (invite), Stripe webhooks (`payment-webhook`), Telegram webhooks
## Architectural Constraints
- **No auto-imports:** Nuxt auto-import is disabled in all apps — every Vue/Nuxt API (`ref`, `computed`, `useNuxtApp`, etc.) must be explicitly imported.
- **Admin is client-only SPA:** SSR is off in production (`ssr: false`). All DB access is direct from browser via anon key + RLS.
- **Storefront DB access — server only:** Direct `supabase.from()` on the storefront client is an anti-pattern; all reads go through `server/api/*.ts` Nitro endpoints.
- **Vertical isolation enforced by ESLint:** `apps/admin/eslint.config.mjs` and `apps/storefront/eslint.config.mjs` block cross-vertical imports (retail ↔ services) and deep-path cross-module imports. Aggregators are in explicit allow-lists.
- **Circular import prevention:** `useDatabase.ts` imports feature API functions directly (not via barrels) to avoid circular dependency with composables that call `useDatabase()`.
- **Global state:** Module-level singletons — `$supabase` Nuxt plugin, Pinia stores (`auth`, `tenant`, `branch`). All others are composable-scoped.
- **Threading:** Single-threaded event loop (Node/Deno). Storefront Nitro may have multiple worker threads in production (Coolify deployment).
## Anti-Patterns
### Direct cross-feature deep-path imports
### Direct Supabase queries from storefront client
### Using `useDatabase()` barrel from inside `useDatabase.ts` itself
### Importing from `~/shared/*` inside a feature that another feature depends on
## Error Handling
- Plugin bootstrap: `try/catch` around `getSession()`, fail gracefully with `authStore.setUser(null)`
- Feature composables: return `{ data, error, loading }` reactive refs
- Tenant init: `partialInitFailures` ref collects non-critical loader errors (plans, configs, roles); displayed as banner
- Nitro handlers: uncaught errors return HTTP 5xx; tenant-not-found returns 404
## Cross-Cutting Concerns
- Admin: Supabase Auth (email/password). Session managed by `plugins/supabase.client.ts`, enforced by `middleware/auth.global.ts`.
- Storefront customer auth: `apps/storefront/features/auth/` — Supabase Auth OTP (phone/email). Customer sessions stored in Supabase cookies.
- Admin: tenant resolved from `memberships` table; `useTenantStore` holds current tenant; switching via `switchTenant()`.
- Storefront: tenant resolved from request host (subdomain or custom domain) in Nitro middleware.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
