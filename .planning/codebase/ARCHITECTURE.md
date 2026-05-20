<!-- refreshed: 2026-05-20 -->
# Architecture

**Analysis Date:** 2026-05-20

## System Overview

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS (Browser)                                │
├──────────────────────────┬───────────────────────────┬────────────────────────┤
│       apps/admin         │      apps/storefront       │       apps/help        │
│   Nuxt 3 SPA (SSR off)   │    Nuxt 3 SSR (on)        │   Nuxt 3 SSR (on)     │
│   port 4710              │    port 4711               │   port 4712            │
│   `apps/admin/`          │    `apps/storefront/`      │   `apps/help/`         │
└──────────┬───────────────┴──────────────┬────────────┴────────────────────────┘
           │ Supabase JS client           │ $fetch → Nitro endpoints
           │ (anon key + RLS)             │ (service-role key, no RLS bypass)
           ▼                              ▼
┌──────────────────────────┐  ┌────────────────────────────────────────────────┐
│   Supabase (PostgreSQL)  │  │   apps/storefront/server/ (Nitro)              │
│   + Auth (GoTrue)        │  │   `server/middleware/tenant.ts`  (host→tenant) │
│   + Storage              │  │   `server/api/*`  (REST endpoints)             │
│   + Realtime             │  │   `server/utils/tenantDb.ts`  (db client)      │
│   + Edge Functions       │◄─┤   `server/utils/tenantCache.ts` (LRU cache)   │
│   `supabase/`            │  └────────────────────────────────────────────────┘
└──────────────────────────┘
           ▲
           │ service-role
           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│   supabase/functions/ (Deno Edge Functions)                                   │
│   accept-invite, invite-member, payment-webhook, proxy-image, dadata-suggest  │
└──────────────────────────────────────────────────────────────────────────────┘
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

**Overall:** Feature-isolated vertical architecture with a shared data aggregator.

**Key Characteristics:**
- Each domain feature lives in `features/<X>/` with its own `api/`, `composables/`, `components/`, `stores/`, `index.ts` barrel.
- Cross-feature imports only allowed through the public barrel (`~/features/<X>` → `index.ts`). Deep-path imports (`~/features/<X>/api/Y`) are forbidden cross-module by ESLint rules.
- Business verticals (retail vs services) are isolated by ESLint barriers: retail features cannot import services features and vice versa. Aggregator files (pages, `useGate.ts`, `useCatalogMode.ts`) are in an explicit ESLint allow-list.
- Supabase client is provided via Nuxt plugin (`$supabase`). Admin accesses DB through `useDatabase()` aggregator that binds the client to every feature's raw API functions.
- Storefront accesses DB only through Nitro server endpoints (`server/api/*.ts`). Direct Supabase calls from storefront client are an anti-pattern.

## Layers

**Admin — Pages layer:**
- Purpose: Nuxt file-based routing, compose feature composables, render UI
- Location: `apps/admin/pages/`
- Contains: `.vue` route files, no business logic
- Depends on: `features/<X>` barrels, `shared/*`
- Used by: end users via browser

**Admin — Features layer:**
- Purpose: Encapsulated domain modules (api, composables, components, stores)
- Location: `apps/admin/features/<X>/`
- Contains: `api/*.ts` (CRUD), `composables/use*.ts`, `components/*.vue`, `stores/*.ts`, `index.ts` (barrel), `feature.manifest.ts`, `AGENTS.md`
- Depends on: `~/shared/*`, `@fastio/*` packages
- Used by: pages, other features (via barrel only)

**Admin — Shared infrastructure:**
- Purpose: Cross-feature infrastructure; dependencies flow FROM features TO shared, never reverse
- Location: `apps/admin/shared/`
- Sub-layers:
  - `shared/data/` — `useDatabase()` aggregator, `useTenant()`, `useRealtimeList()`, `useRealtimeWatch()`
  - `shared/stores/` — global Pinia: `auth.ts`, `tenant.ts`, `branch.ts`
  - `shared/plan/` — feature gates (`useGate`, `useGate.retail`, `useGate.services`), plan/module checks
  - `shared/utils/` — pure helpers: `query.ts`, `featureFlags.ts`, `moduleToggleChecks.ts`, etc.
  - `shared/composables/` — cross-feature composables: `useRealtimeChannels.ts`, `usePageTitle.ts`
  - `shared/components/` — layout components: `AppNav.vue`, `BranchSelector.vue`, `TenantSwitcher.vue`
  - `shared/ui/` — admin-specific UI: `RichTextEditor.vue`, `ImageUploadModal.vue`, `ColorPicker.vue`; UI composables: `useEditableForm.ts`, `useDrawer.ts`, `useFormDirty.ts`

**Admin — API layer:**
- Purpose: Thin CRUD wrappers around Supabase client, receive `SupabaseClient` as first arg
- Location: `apps/admin/features/<X>/api/*.ts` and `apps/admin/shared/data/api/*.ts`
- Pattern: pure functions `(sb: SupabaseClient, ...args) => Promise<...>`
- Used by: `useDatabase()` which binds `sb` and exposes bound methods

**Storefront — Pages layer:**
- Purpose: SSR route files, aggregators for hybrid retail/services pages
- Location: `apps/storefront/pages/`
- Hybrid pages: `index.vue`, `menu.vue`, `cart.vue`, `checkout.vue`, `category/*` — show retail or services UI based on `businessType`
- Vertical-only: `booking.vue` (retail), `appointments/*` (services)

**Storefront — Features layer:**
- Purpose: Domain modules for the public storefront
- Location: `apps/storefront/features/<X>/`
- Same structure as admin features: `api/`, `composables/`, `stores/`, `index.ts`, `feature.manifest.ts`, `AGENTS.md`
- Key modules: `menu-catalog`, `cart`, `checkout`, `delivery`, `booking`, `appointments`, `services-catalog`, `auth`, `branch`, `account`

**Storefront — Server layer (Nitro):**
- Purpose: All DB reads for storefront — proxied through Nitro to use service-role key safely
- Location: `apps/storefront/server/`
- Sub-layers:
  - `server/middleware/tenant.ts` — resolves `Tenant` from request host, writes to `event.context.tenant`; uses `tenantCache.ts` LRU cache
  - `server/middleware/0-security-headers.ts` — security headers
  - `server/api/*.ts` — REST endpoints (e.g., `menu.get.ts`, `orders.post.ts`)
  - `server/utils/tenantDb.ts` — builds RLS-scoped Supabase client per request
  - `server/utils/supabase.ts` — service-role client singleton

**Storefront — Shared infrastructure:**
- Purpose: Cross-feature utilities for the storefront client
- Location: `apps/storefront/shared/`
- Contains: composables (`useTheme`, `useToast`, `useCurrency`, `useCatalogMode`), utils, layout UI components
- `shared/ui/sections/` — `SiteHeader.vue`, `SiteFooter.vue`, `HeroSection.vue`, `CategoryBar.vue`, etc.

## Data Flow

### Admin — Primary Request Path

1. Plugin init: `apps/admin/plugins/supabase.client.ts` — creates Supabase client, sets `authStore.user`
2. Global middleware: `apps/admin/middleware/auth.global.ts` — checks auth, calls `tenantStore.init()` on first load
3. `useTenantStore.init()` → `useTenant()` → `useDatabase().tenants.*` → Supabase `tenants` table
4. Page/feature composable: calls `useDatabase().<resource>.<method>()` (e.g., `useDatabase().dishes.list()`)
5. `useDatabase()` (`apps/admin/shared/data/useDatabase.ts`) — returns bound API methods with `$supabase` already injected
6. Feature API function: direct Supabase `.from('dishes').select(...)` with RLS enforced by anon key
7. Composable maps response to domain type from `@fastio/shared` and updates reactive `ref`

### Admin — Realtime Path

1. After tenant init: `apps/admin/shared/composables/useRealtimeChannels.ts` is called
2. Feature-specific channel composable (e.g., `features/orders/composables/useOrdersChannel.ts`) — subscribes to Supabase Realtime
3. On event: `useRealtimeList.ts` applies insert/update/delete to reactive array
4. Alert handlers (e.g., `useOrderAlertHandler.ts`) — show push notifications

### Storefront — Primary Request Path (SSR)

1. HTTP request arrives at Nitro
2. `server/middleware/tenant.ts` — resolves `Tenant` by host header (with LRU cache), writes to `event.context.tenant`
3. Route handler `server/api/menu.get.ts` — reads `event.context.tenant`, queries DB via `getTenantDb(event)` using service-role key
4. Returns JSON response to client
5. Storefront page/composable calls `$fetch('/api/menu')` to get data
6. Feature store (e.g., `features/menu-catalog/stores/`) holds the data reactively

### Feature Gate Flow (Admin)

1. `useGate()` (`apps/admin/shared/plan/useGate.ts`) — reads `tenantStore`, `branchStore`, plan features
2. Returns `{ enabled: boolean, reason: 'suspended' | 'locked' | 'disabled' | 'forbidden' | ... }`
3. Pages/components read gate result to show upgrade banners or restrict access

**State Management:**
- Admin: Pinia stores for global state (`auth`, `tenant`, `branch`), reactive `ref` in feature composables for local state
- Storefront: Pinia stores in feature folders (`cart/stores/cart.ts`, etc.), SSR-compatible with `useState()`

## Key Abstractions

**`useDatabase()` aggregator:**
- Purpose: Single access point to all Supabase CRUD — injects `$supabase` client into every API module
- File: `apps/admin/shared/data/useDatabase.ts`
- Pattern: `bindAll(featureApi, sb)` — wraps every function to pre-fill `SupabaseClient` arg

**Feature manifest (`feature.manifest.ts`):**
- Purpose: Machine-readable metadata per module — routes, permissions, DB tables, realtime subs, dependencies
- Files: `apps/admin/features/<X>/feature.manifest.ts`, `apps/storefront/features/<X>/feature.manifest.ts`
- Type: `FeatureManifest` / `StorefrontFeatureManifest` from `apps/admin/features/_manifest.ts`
- Validated at pre-commit via `scripts/features/validate-manifests.mjs`

**`useRealtimeList<T>()` / `useRealtimeWatch<T>()`:**
- Purpose: Generic composables for Supabase Realtime-backed reactive lists/single objects
- Files: `apps/admin/shared/data/useRealtimeList.ts`, `apps/admin/shared/data/useRealtimeWatch.ts`
- Pattern: receives `channelKey`, `table`, `filter`, `fetch`, `mapper` — handles subscribe/unsubscribe lifecycle

**Feature barrel (`index.ts`):**
- Purpose: Public API of a feature module — only way to import from another module
- Files: `apps/admin/features/<X>/index.ts`, `apps/storefront/features/<X>/index.ts`
- Pattern: re-exports composables, components, types that are safe for cross-module use

**`useGate()` / `useGateRetail()` / `useGateServices()`:**
- Purpose: Centralized feature access control — checks plan tier, module toggle, permissions, suspension
- Files: `apps/admin/shared/plan/useGate.ts`, `useGate.retail.ts`, `useGate.services.ts`
- Returns `GateResult = { enabled: boolean, reason: string }` — UI uses `reason` to show correct banner

**Tenant resolution (Storefront Nitro):**
- Purpose: Map incoming request host to `Tenant` row; cache to avoid DB round-trip per request
- Files: `apps/storefront/server/middleware/tenant.ts`, `apps/storefront/server/utils/tenantCache.ts`
- Pattern: LRU in-memory cache with stampede protection; subscription status always re-fetched fresh

## Entry Points

**Admin app:**
- Location: `apps/admin/app.vue` (root), `apps/admin/plugins/supabase.client.ts` (bootstrap)
- Triggers: browser loads SPA shell
- Responsibilities: create Supabase client, set auth state, run global middleware

**Storefront app:**
- Location: `apps/storefront/app/` or `apps/storefront/pages/index.vue`
- Server entry: `apps/storefront/server/middleware/tenant.ts` (runs on every request)
- Responsibilities: resolve tenant, serve SSR HTML with tenant-specific data

**Supabase Edge Functions:**
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

**What happens:** Importing `~/features/orders/api/orders` from the kitchen feature directly.
**Why it's wrong:** Breaks isolation; changes to internals silently break consumers; ESLint rule will fail the build.
**Do this instead:** Import from the feature barrel `~/features/orders` — `import { useOrders } from '~/features/orders'`.

### Direct Supabase queries from storefront client

**What happens:** Calling `supabase.from('tenants').select('*')` in a storefront composable.
**Why it's wrong:** Anon key has no access to most data via RLS on the storefront; risks exposing service-role key if misused; bypasses tenant isolation.
**Do this instead:** Add a Nitro endpoint in `apps/storefront/server/api/`, call `getTenantDb(event)` there, and fetch from client via `$fetch('/api/...')`.

### Using `useDatabase()` barrel from inside `useDatabase.ts` itself

**What happens:** A feature barrel re-exports a composable that calls `useDatabase()`, and `useDatabase.ts` imports from that barrel.
**Why it's wrong:** Creates a circular import chain (`useDatabase → barrel → composable → useDatabase`).
**Do this instead:** `useDatabase.ts` must import feature APIs via deep paths directly (it's in the ESLint aggregator allow-list for exactly this reason).

### Importing from `~/shared/*` inside a feature that another feature depends on

**What happens:** Dependency direction reversed — `shared/` imports from `features/`.
**Why it's wrong:** Violates the unidirectional dependency rule (features depend on shared, not vice versa).
**Do this instead:** Put shared logic in `shared/` and have features import from it.

## Error Handling

**Strategy:** Report-and-continue. Errors are reported via `reportError()` from `@fastio/shared/observability` (wraps Sentry). Critical bootstrap errors (auth plugin) are caught with try/catch to avoid white-screen. Feature-level errors surface through composable `error` refs or alert notifications.

**Patterns:**
- Plugin bootstrap: `try/catch` around `getSession()`, fail gracefully with `authStore.setUser(null)`
- Feature composables: return `{ data, error, loading }` reactive refs
- Tenant init: `partialInitFailures` ref collects non-critical loader errors (plans, configs, roles); displayed as banner
- Nitro handlers: uncaught errors return HTTP 5xx; tenant-not-found returns 404

## Cross-Cutting Concerns

**Logging:** `reportError()` from `@fastio/shared/observability` — wraps Sentry. Used throughout admin plugins, storefront server middleware, and feature composables on critical paths.

**Validation:** Feature manifests validated by `scripts/features/validate-manifests.mjs` at pre-commit. Module toggle pre-checks via `apps/admin/shared/utils/moduleToggleChecks.ts` before disabling a module.

**Authentication:**
- Admin: Supabase Auth (email/password). Session managed by `plugins/supabase.client.ts`, enforced by `middleware/auth.global.ts`.
- Storefront customer auth: `apps/storefront/features/auth/` — Supabase Auth OTP (phone/email). Customer sessions stored in Supabase cookies.

**Multi-tenancy:**
- Admin: tenant resolved from `memberships` table; `useTenantStore` holds current tenant; switching via `switchTenant()`.
- Storefront: tenant resolved from request host (subdomain or custom domain) in Nitro middleware.

**Module system:** `TenantModules` (from `@fastio/shared`) is a boolean map of feature flags per tenant. `useGate()` reads it to gate UI. Modules are toggled in settings; `moduleToggleChecks.ts` prevents disabling a module with active dependencies.

---

*Architecture analysis: 2026-05-20*
