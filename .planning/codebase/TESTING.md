---
focus: quality
mapped: 2026-05-10
---

# Testing

## Framework & Setup

- **Framework:** [Vitest](https://vitest.dev/) with the `happy-dom` environment.
- **Config file:** `vitest.config.ts` at the monorepo root.
- **Vue test utils:** `@vue/test-utils` is used for component mounting in composable tests that require a host component.
- **Running tests:**
  ```bash
  pnpm test          # vitest in watch mode
  pnpm test:run      # vitest one-shot (CI)
  # Single file:
  pnpm vitest run apps/admin/composables/__tests__/usePlanFeatures.test.ts
  ```
- **Coverage:** v8 provider, outputs `text` and `html` reporters. Excluded: `node_modules`, `dist`, config files.
- **Test environment:** `happy-dom` (DOM-capable, lighter than jsdom). Server-side tests run in the same environment but mock all browser APIs they don't need.

### Aliases configured in vitest.config.ts

| Alias | Resolves to |
|---|---|
| `vue` | `apps/admin/node_modules/vue` |
| `pinia` | `apps/admin/node_modules/pinia` |
| `vue-router` | `apps/admin/test-utils/vue-router-stub.ts` |
| `#imports` | `apps/admin/test-utils/nuxt-imports-stub.ts` |
| `~` | `apps/admin` |
| `@fastio/shared` | `packages/shared/src` |
| `@fastio/ui` | `packages/ui/src` |
| `@fastio/icons` | `packages/icons/src` |
| `@fastio/kit` | `packages/kit/src` |
| `h3` | hardcoded pnpm store path (known tech debt, see `TECHDEBT.md`) |

### Nuxt stubs

Since Nuxt auto-imports are disabled and the Nuxt runtime is not available in Vitest, two stubs exist:

- `apps/admin/test-utils/nuxt-imports-stub.ts` — exports `useNuxtApp`, `useRuntimeConfig`, `navigateTo`, `defineNuxtPlugin`.
- `apps/admin/test-utils/vue-router-stub.ts` — exports `onBeforeRouteLeave` as a no-op.

For server-side tests (`apps/storefront/server/`), Nuxt's server globals (`defineEventHandler`, `readBody`, `createError`, `getQuery`, etc.) are attached to `globalThis` manually at the top of the test file.

## Test Structure

- Tests live in `__tests__/` subdirectories next to the code they test.
- File naming: `useFoo.test.ts` (mirrors the source file name).
- Test files are **not** co-located with source — they are always in a sibling `__tests__/` folder.

### Location by app/package

| Location | What's tested |
|---|---|
| `packages/shared/src/__tests__/` | Pure utility functions (scheduling, formatting, pricing, roles, menu, geo, etc.) |
| `apps/admin/composables/__tests__/` | Shared admin composables (plan features, gate, forms, loading, onboarding, terms) |
| `apps/admin/composables/services/__tests__/` | Services-vertical composables (timeline move blocker, appointment view scope) |
| `apps/admin/composables/services/appointmentEditor/__tests__/` | Appointment editor utilities |
| `apps/admin/utils/__tests__/` | Admin utility functions (module toggle checks, filterDefined) |
| `apps/admin/utils/api/retail/__tests__/` | API mapper functions (dishes, orders, promotions, modifiers, etc.) |
| `apps/admin/utils/api/__tests__/` | Branches API |
| `apps/admin/utils/retail/__tests__/` | Retail utils (promo status, order formatting) |
| `apps/admin/utils/services/__tests__/` | Services utils (schedule conflict check) |
| `apps/admin/config/__tests__/` | Team roles config |
| `apps/admin/__tests__/` | ESLint vertical isolation barrier |
| `apps/storefront/composables/__tests__/` | Storefront composables (dish customization) |
| `apps/storefront/stores/__tests__/` | Cart store |
| `apps/storefront/utils/__tests__/` | Storefront utilities (branch compat, delivery text, format) |
| `apps/storefront/server/__tests__/` | Cross-tenant isolation, bulk order handler |
| `apps/storefront/server/services/__tests__/` | Order calculation logic |
| `apps/storefront/server/utils/__tests__/` | Server utilities (tenantDb, telegramAuth, tenantTablesDrift) |
| `apps/backoffice/server/utils/__tests__/` | Billing utils |
| `packages/public-ui/src/composables/__tests__/` | Modal history composable |

Total: **68 test files** across the monorepo.

## What's Tested

### Well-covered areas

- **Pure utility functions** in `packages/shared` — most scheduling, pricing, formatting, date, timezone, phone, menu, geo, and domain logic utilities have dedicated test files with many cases each.
- **API mapper functions** — `mapDish`, `mapOrder`, `mapPromotion`, etc. tested for snake_case → camelCase conversion, null handling, and defaults.
- **Business logic composables** — `usePlanFeatures`, `useGate`, `useEditableForm`, `useFormDirty`, `useTimelineMoveBlocker`, `useAppointmentViewScope`, etc.
- **Cross-tenant security** — `apps/storefront/server/__tests__/cross-tenant.test.ts` is a comprehensive suite covering ~15 endpoints and the `getTenantDb` proxy mechanism.
- **Order calculation** — `apps/storefront/server/services/__tests__/order-calc.test.ts` covers subtotal, promo discounts (percent/fixed, winner logic), delivery fees (zones/fixed modes), and order total.
- **Cart store** — add, merge, update, clear, reconcile operations.
- **ESLint barriers** — `apps/admin/__tests__/eslint-barrier.test.ts` uses the ESLint programmatic API to verify vertical isolation rules fire correctly.
- **Auth/security utils** — `telegramAuth.test.ts` covers HMAC signature verification, expiry, and field validation.

## Mocking Patterns

### `vi.mock()` for module-level mocks

The most common pattern. Used to stub Pinia stores, UI libraries, and utilities:

```ts
vi.mock('~/stores/tenant', () => ({
  useTenantStore: () => mockStore,
}))

vi.mock('@fastio/ui', () => ({
  useMessage: () => ({ success: successMock, error: errorMock }),
}))

vi.mock('~/utils/reportError', () => ({
  reportError: reportErrorMock,
}))
```

### Mutable mock objects for state simulation

Stores are mocked as plain mutable objects; tests mutate them directly before each assertion:

```ts
const mockStore: { tenant: Record<string, unknown> | null } = { tenant: null }
vi.mock('~/stores/tenant', () => ({ useTenantStore: () => mockStore }))

// In test:
mockStore.tenant = { subscription: { plan: 'pro' } }
```

For more complex stores with multiple reactive refs:
```ts
const memberships = ref<...[]>([])
const currentTenantId = ref<string | null>(null)
vi.mock('~/stores/tenant', () => ({ useTenantStore: () => ({ memberships, currentTenantId }) }))
```

### Fluent Supabase chain mock

For server-side tests, a `mockChain` object mocks the Supabase query builder. Each method returns `mockChain` (fluent), and terminal methods (`single`, `maybeSingle`, `order`, etc.) are configured per-test:

```ts
const mockChain = { eq: vi.fn(), select: vi.fn(), single: vi.fn(), ... }
// Each method returns itself for chaining:
mockChain.eq.mockReturnValue(mockChain)
// Terminal methods return resolved values:
mockChain.single.mockResolvedValueOnce({ data: {...}, error: null })
```

### Dynamic import for module re-initialization

When mocks must be set up before a module loads (circular mock issues), dynamic imports are used:

```ts
vi.mock('../utils/supabase', () => ({ getServerSupabase: () => mockClient }))
// ...
const { getTenantDb } = await import('../utils/tenantDb')
```

### `globalThis` for Nitro server globals

Server API handlers use Nuxt/h3 auto-injected globals. Tests attach them manually:

```ts
;(globalThis as any).createError = createError
;(globalThis as any).defineEventHandler = (fn: Function) => fn
;(globalThis as any).readBody = vi.fn()
```

### Pinia with `setActivePinia`

Store tests create a fresh Pinia instance before each test:

```ts
beforeEach(() => {
  setActivePinia(createPinia())
  store = useCartStore()
})
```

### Host component pattern for composables requiring Vue context

When a composable needs to run inside a component's `setup()`:

```ts
const Host = defineComponent({
  setup() {
    api = useEditableForm({ source, build, save })
    return () => h('div', 'host')
  },
})
const wrapper = mount(Host)
```

## Test Examples

### 1. Pure unit test — composable with mocked store

`apps/admin/composables/__tests__/usePlanFeatures.test.ts`

A typical pattern for composables that read from a Pinia store. The store is mocked as a plain object, and state is mutated directly before each `it`. No async, no component mounting required.

### 2. Security integration test — cross-tenant isolation

`apps/storefront/server/__tests__/cross-tenant.test.ts`

The largest test file (~900 lines). Covers 15+ server handlers by mocking the Supabase fluent chain and verifying that `.eq('tenant_id', tenantId)` is called on every request. Also includes regression tests for the `db.raw` Proxy and `db.crossTenant` escape hatch.

### 3. Composable with complex domain logic

`apps/admin/composables/services/__tests__/useTimelineMoveBlocker.test.ts`

Tests a timeline drag-and-drop blocker. Uses a `buildBlocker()` factory that accepts partial overrides of the composable's inputs (`availability`, `resources`, `appointments`, `competencyByResource`). Covers 11 scenarios: same-slot no-op, past-time guard, working-hours check, disabled slots, competency check, capacity-1 conflict, capacity-N allowance, cancelled-record exclusion, and guard priority ordering.

### 4. ESLint as a test subject

`apps/admin/__tests__/eslint-barrier.test.ts`

Uses the `ESLint` programmatic API to lint synthetic code strings and assert that `no-restricted-imports` messages fire correctly. Verifies both alias (`~/composables/retail/...`) and relative (`../retail/...`) import patterns are caught.

## Coverage Gaps

- **Vue components** — zero component-level tests. No `@vue/test-utils` tests for any `.vue` file directly; only composables that happen to mount a minimal host component.
- **Pages** — `apps/admin/pages/` and `apps/storefront/pages/` have no tests at all. Page-level integration logic (scroll, lifecycle side effects, route guards) is untested.
- **Pinia stores** — only `useCartStore` has tests. `useTenantStore`, `useBranchStore`, `useAppointmentSettingsStore` are untested directly (covered indirectly via composable mocks).
- **Realtime composables** — `useRealtimeList`, `useRealtimeWatch`, channel composables in `composables/data/` have no tests.
- **Admin data composables** — `composables/data/useDatabase.ts`, `composables/data/useTenant.ts`, etc. have no unit tests.
- **Storefront server handlers** — only a subset of handlers are covered by `cross-tenant.test.ts`. Most POST/PATCH handlers (orders, Telegram auth flow, reservation creation) have no dedicated happy-path tests.
- **`apps/help`**, **`apps/landing`**, **`apps/backoffice`** (except billing utils) — essentially untested.
- **Migration SQL** — `supabase/migrations/` has no automated tests; schema correctness relies on the optional `tenantTablesDrift.test.ts` (skipped unless `RUN_TENANT_TABLES_DRIFT_CHECK=1`).
- **Edge Functions** — `supabase/functions/` (Deno) have no test files.
