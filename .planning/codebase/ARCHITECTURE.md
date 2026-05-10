---
focus: arch
mapped: 2026-05-10
---

# Architecture

## Pattern

**Multi-app monorepo** managed by pnpm workspaces + Turborepo. Five Nuxt 3 applications sharing a suite of local packages. Backend is Supabase (PostgreSQL + Row-Level Security + Realtime + Edge Functions). No dedicated API service layer — apps talk directly to Supabase through generated clients, or via Nuxt server routes (H3) for server-side rendering and sensitive operations.

Key architectural decisions:
- **Auto-imports disabled** in all apps — every import is explicit
- **Multi-tenant** system: every tenant is identified by subdomain or custom domain; all DB tables carry `tenant_id` which is enforced at both RLS and application layers
- **Business-type split**: tenants are either `retail` (food/products) or `services` (salon/clinic/etc.) — modules activate accordingly
- **Feature modules** toggle functionality per tenant: `modifiers`, `addons`, `combos`, `delivery`, `pickup`, `tables`, `reservations`, `appointments`, `services`, etc.
- **Branch isolation**: tenants can have multiple branches; staff membership can be scoped to specific branch IDs

## Applications

| App | SSR | Port | Purpose |
|-----|-----|------|---------|
| `apps/admin` | **SPA** (`ssr: false`) | 4710 | Tenant management panel — menu, orders, kitchen, reservations, appointments, team, settings |
| `apps/storefront` | **SSR** (`ssr: true`) | 4711 | Customer-facing branded storefront — menu, cart, checkout, booking, orders |
| `apps/help` | **SSR** (`ssr: true`) | 4712 | Public knowledge base for tenants, backed by `packages/kb` |
| `apps/landing` | **SSR** (`ssr: true`) | 4713 | Marketing landing page for Fastio product |
| `apps/backoffice` | **SSR** | — | Internal Fastio backoffice (rarely modified) |

### apps/admin — key entry points
- `plugins/supabase.client.ts` — creates Supabase client, seeds `authStore`, sets up `onAuthStateChange`
- `middleware/auth.global.ts` — redirects unauthenticated users to `/login`
- `middleware/gate.global.ts` — checks route-level permissions via `useGate`
- `layouts/default.vue` — main shell with `AppNav`, `BranchSelector`, `PastDueBanner`
- `stores/auth.ts` → `stores/tenant.ts` → `stores/branch.ts` — initialization chain

### apps/storefront — key entry points
- `server/middleware/tenant.ts` — resolves tenant from subdomain/custom-domain on every request, injects `event.context.tenant`
- `server/utils/tenantDb.ts` — `getTenantDb(event)` wraps Supabase client with Proxy that auto-injects `.eq('tenant_id', tenantId)` on all known tenant tables
- Server routes in `server/api/` handle data fetching (menu, tenant config, orders, reservations, appointments)
- `stores/` (Pinia) handle client-side state: `cart`, `menu`, `auth`, `checkout`, `selectedBranch`, `services`, `table`

## Packages

| Package | Name | Consumers | Key Exports |
|---------|------|-----------|-------------|
| `packages/shared` | `@fastio/shared` | all apps | Domain types (`Tenant`, `Order`, `Dish`, `Appointment`, …), pure utils (`pluralize`, `planLevel`, `scheduling`, `price`, `phone`, `slugify`, `vocabulary`, `menu`), composables (`useSchedulingSlots`, `useDadataSuggestions`) |
| `packages/ui` | `@fastio/ui` | admin | Naive UI wrappers: `UiCard`, `UiButton`, `UiModal`, `UiTable`, `UiForm`, `UiSelect`, `UiInput`, `UiText`, `UiTitle`, `UiTag`, `UiBadge`, etc. Composables: `useConfirm`, `useModals`, `useBreakpoints`, `useQuery`, `useMutation` |
| `packages/public-ui` | `@fastio/public-ui` | storefront | Storefront UI on Reka UI/vaul-vue: `FsButton`, `FsDialog`, `FsDrawer`, `FsInput`, `FsForm`, `FsSelect`, `FsTag`, `FsToast`, etc. Structured into `base/`, `form/`, `overlay/`, `layout/`, `nav/`, `typography/` |
| `packages/kit` | `@fastio/kit` | storefront, public-ui | Shared runtime composables (`useBreakpoints`, `useModals`, `useConfirm`, `useQuery`, `useMutation`), form validators, layer utilities, `throttle`, constants |
| `packages/icons` | `@fastio/icons` | admin, storefront | `UiIcon` component + Lucide icon registry (`icons.ts`) |
| `packages/styles` | `@fastio/styles` | all | Global SCSS tokens (`variables/`), reset, typography, mixins (`media-queries`, `surface`, `layout`, `form`, `safe-area`) |
| `packages/kb` | `@fastio/kb` | help, admin | Markdown knowledge base content (`content/*.md`, 50+ articles) + `src/index.ts` structure map. Admin exposes KB via Nitro `fs` storage driver |

## Data Flow

### Admin (SPA)
```
Vue Component / Page
  → composables/data/use[Domain].ts    (business logic, realtime subscriptions)
    → useDatabase()                    (aggregates all API modules, binds Supabase client)
      → utils/api/[domain].ts          (raw CRUD functions: (sb, ...args) => Promise)
        → Supabase JS client           (PostgreSQL via PostgREST + RLS)
```
Realtime events flow in reverse: `Supabase Realtime channel → useRealtimeList/useRealtimeWatch → reactive ref → component re-render`.

For server-side operations (AI chat, Telegram webhooks, email notifications):
```
Component → fetch('/api/...') → apps/admin/server/api/[route].ts → Supabase service-role client
```

### Storefront (SSR)
```
Nuxt SSR page request
  → server/middleware/tenant.ts        (resolves tenant from host, injects context)
    → server/api/[resource].get.ts     (H3 event handler)
      → getTenantDb(event)             (tenant-scoped Supabase Proxy)
        → Supabase service-role client → PostgreSQL
  → hydrated page sent to browser

Browser (client-side):
  stores/[domain].ts (Pinia)
    → composables/use[Domain].ts
      → server/api/ endpoints via $fetch / useSupabaseClient
        → Supabase anon client (for auth-gated customer actions)
```

Customer mutations (place order, create reservation, book appointment):
```
Browser → POST /api/orders / /api/reservations / /api/appointments/request
  → server route validates, writes via service-role Supabase
  → returns result + triggers email/Telegram notifications
```

## Abstractions & Layers

### Admin layers (bottom → top)
1. **`utils/api/*.ts`** — lowest level: pure functions `(SupabaseClient, ...args) => Promise<T>`. No state, no reactivity. Domain-split into `retail/`, `services/`, and root-level files.
2. **`composables/data/useDatabase.ts`** — aggregates all API modules; binds the Supabase client via `bindAll()`. Single call site for the client.
3. **`composables/data/use[Domain].ts`** — business logic layer: fetch + realtime subscription + local state management. Uses `useRealtimeList` or `useRealtimeWatch` for reactive lists/objects.
4. **`stores/*.ts`** (Pinia) — global shared state: `auth`, `tenant`, `branch`. Feature stores in `stores/retail/` and `stores/services/`.
5. **`pages/` + `components/`** — UI layer. Pages import from stores/composables; components receive props.

### Storefront layers (bottom → top)
1. **`server/utils/tenantDb.ts`** — Proxy-wrapped Supabase client with automatic `tenant_id` injection
2. **`server/api/*.ts`** — H3 event handlers for SSR data fetching and mutations
3. **`stores/*.ts`** — client-side state (cart, menu, auth, checkout, selectedBranch)
4. **`composables/use*.ts`** — UI logic composables (booking flow, dish customization, cart edit, etc.)
5. **`pages/` + `components/`** — UI layer

## State Management

All stores use **Pinia setup-API** (arrow-function style, not options API).

### Admin stores

| Store | File | Purpose | Initialization |
|-------|------|---------|---------------|
| `useAuthStore` | `stores/auth.ts` | Supabase `User` + `loading` flag | Set by `supabase.client.ts` plugin via `onAuthStateChange` |
| `useTenantStore` | `stores/tenant.ts` | Current tenant, memberships, permissions, roles | `tenantStore.init()` called in `auth.global.ts` middleware after auth resolves; delegates to `useTenant` composable |
| `useBranchStore` | `stores/branch.ts` | Branch list + current branch selection | Initialized from `tenantStore.fetchTenant()`; delegates to `useBranches` + `useBranch` composables |
| `useAppointmentSettingsStore` | `stores/services/appointmentSettings.ts` | Appointment module settings | Loaded in `useTenant.init()` if `services` module is enabled |
| Retail stores | `stores/retail/*.ts` | `deliveryZone`, `order-statuses`, `reservations` | Loaded lazily on demand |

**Initialization order:** `supabase plugin` → `authStore.setUser()` → `tenantStore.init()` → `branchStore` reactive via computed `currentTenantId`.

### Storefront stores

| Store | Purpose |
|-------|---------|
| `auth.ts` | Customer auth (Supabase anon session) |
| `menu.ts` | Loaded menu data (categories, dishes, combos, modifiers) |
| `cart.ts` | Cart items with quantities and modifiers |
| `checkout.ts` | Checkout flow state (delivery/pickup, address, promo) |
| `selectedBranch.ts` | Active branch for per-branch menu filtering |
| `services.ts` | Services catalog for appointment booking |
| `table.ts` | QR table session state |
| `addresses.ts` | Saved customer delivery addresses |

## Key Patterns

### `useRealtimeList<T>` / `useRealtimeWatch<T>`
Universal composables in `apps/admin/composables/data/` for reactive lists and single-object subscriptions. Accept `channelKey` (reactive, `null` = inactive), `table`, `filter`, `fetch`, `mapper`, and optional `shouldInclude`. Auto-subscribe on mount, unsubscribe on unmount. Used by virtually every domain composable in admin.

### `useDatabase()` binding pattern
All `utils/api/*.ts` functions follow signature `(sb: SupabaseClient, ...args) => Promise<T>`. `useDatabase()` uses `bindAll()` to partially apply the client, returning pre-bound methods. This keeps utils pure/testable while composables get ergonomic call sites.

### Tenant/Branch isolation
- **Admin**: `tenantId` flows from `useTenantStore` → every `useRealtimeList` filter → Supabase `.eq('tenant_id', tenantId)`. Branch filter applied on top for branch-scoped views.
- **Storefront**: `tenant_id` is injected server-side via `tenantDb` Proxy — no client code needs to pass it manually.

### `getTenantDb` Proxy pattern (storefront)
`server/utils/tenantDb.ts` wraps the service-role Supabase client. Calling `.from(table)` on a known tenant table (from `TENANT_TABLES` set) automatically chains `.eq('tenant_id', tenantId)` after `select`/`update`/`delete`. `junction()` bypasses the proxy for join tables without `tenant_id`. `crossTenant` exposes the raw client for intentional cross-tenant ops (payment webhooks, etc.).

### Module-gated features
`apps/admin/config/modules.ts` defines `ModuleConfig[]`. Each module has a `requiredPlan` and `businessTypes`. `useGate` composable checks `currentPermissions` from tenant store. Route-level gating in `middleware/gate.global.ts`. Feature-specific stores/composables only activate if the corresponding module flag is on.

### `useGate` + route permissions
Admin middleware (`gate.global.ts`) calls `useGate` on every navigation. `useGate` checks both module availability and role-based permissions. Gate rules are co-located in `useGate.routes.ts` within each composable domain.

### AI chat (admin)
`server/api/ai/chat.post.ts` + `server/ai/knowledge/` + `server/ai/tools.ts` — AI assistant for the admin using OpenAI with knowledge base context loaded from `packages/kb` content via Nitro `fs` storage.

### Telegram notifications
`server/api/telegram/` — inbound webhook for Telegram bot, sends appointment reminders and order notifications. `server/api/tel/` — phone lookup for customer history.
