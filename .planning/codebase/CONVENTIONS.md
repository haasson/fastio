# Coding Conventions

**Analysis Date:** 2026-05-20

## Naming Patterns

**Files:**
- Vue components: `PascalCase.vue` (e.g., `ModuleCard.vue`, `OrderContent.vue`)
- TypeScript modules: `camelCase.ts` (e.g., `useOrders.ts`, `order-events.ts`, `format-order.ts`)
- Feature API files: `kebab-case.ts` under `api/` (e.g., `orders.ts`, `order-events.ts`, `order-notes.ts`)
- Stores: `kebab-case.ts` under `stores/` (e.g., `order-statuses.ts`, `deliveryZone.ts`)
- Types files: `types.ts` per feature
- Manifests: `feature.manifest.ts` per feature
- Barrel: `index.ts` per feature

**Functions/Composables:**
- Composables: `useFoo` prefix (e.g., `useOrders`, `useDashboardStats`, `useOnboarding`)
- Arrow functions preferred for utilities: `const getDayKey = (iso: string) => iso.slice(0, 10)`
- Named exports for everything (`export function useOrders(...)`, `export const mapOrder = ...`)
- Private internals prefixed with `_` (e.g., `_orders = ref<Order[]>([])`)
- ESLint rule: `arrow-body-style: ['error', 'as-needed']` — no unnecessary braces in arrow functions

**Variables:**
- `camelCase` throughout
- Params to ignore in unused-vars: `^_` prefix (e.g., `_data`, `_cb`)

**Types:**
- `type` keyword universally — `interface` is forbidden in application code (only used in `.d.ts` augmentation files like `server/types/h3-context.d.ts`)
- PascalCase for type names (e.g., `OrderUpdateData`, `DashboardPeriod`, `UseOrdersOptions`)
- Domain types in `packages/shared/src/types/` (e.g., `menu.ts`, `appointment.ts`)
- Local types defined at top of file before the composable/function

**Vue Components:**
- PascalCase in templates enforced by ESLint: `vue/component-name-in-template-casing: ['error', 'PascalCase']`
- `defineProps<{...}>()` with generic syntax (no runtime validators)
- `defineEmits<{ toggle: [value: boolean] }>()` with generic event object
- Props: no default values required (`vue/require-default-prop: 'off'`)
- Block order enforced: `template` → `script` → `style`

**CSS Classes:**
- Short, non-BEM class names (`.module-card`, `.top`, `.icon`, `.meta`, `.footer`)
- Root element class has component-relevant name (not `-root` suffix; e.g., `.module-card` for `ModuleCard.vue`)
- Modifier classes via `&.locked`, `&--locked` in SCSS nesting

## Code Style

**Formatting (via `@stylistic/eslint-plugin`):**
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

**Vue HTML:**
- Indent: 2 spaces
- Self-closing for all elements: `<Component />`, `<input />`
- Max 3 attributes on single line, 1 per line when multiline
- HTML closing bracket on new line for multiline

**Linting:**
- ESLint flat config (`eslint.config.mjs`) per app, extending `@fastio/shared/configs/eslint`
- TypeScript: `typescript-eslint` recommended
- `@typescript-eslint/no-explicit-any: 'warn'` (not error)
- `@typescript-eslint/no-unused-vars: ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]`
- `no-debugger: 'error'`

**Style linting (Stylelint):**
- Config: `/.stylelintrc.cjs`
- Extends: `stylelint-config-standard-scss` + `stylelint-config-recommended-vue/scss`
- Plugin: `stylelint-declaration-strict-value` enforces `var(--...)` tokens for colors, spacing, typography, border-radius (severity: warning currently)
- Storefront/landing/public-ui are exempt from strict-value rules (semantic tokens used there)

## Import Organization

**Order (enforced implicitly by project convention):**
1. Node built-ins (`node:fs`, `node:path`)
2. External packages (`vue`, `pinia`, `@supabase/supabase-js`, `@vueuse/core`)
3. Monorepo packages (`@fastio/shared`, `@fastio/shared/observability`, `@fastio/ui`, `@fastio/icons`, `@fastio/kit`)
4. Internal app imports via `~/` alias (e.g., `~/shared/stores/tenant`, `~/features/orders`)
5. Relative imports (avoided for cross-feature; used within a feature)

**Path Aliases:**
- `~/` → app root (e.g., `~/shared/stores/auth` in admin)
- `@fastio/shared` → `packages/shared/src`
- `@fastio/shared/server` → `packages/shared/src/server/index.ts`
- `@fastio/shared/observability` → `packages/shared/src/observability/index.ts`
- `@fastio/ui` → `packages/ui/src`
- `@fastio/icons` → `packages/icons/src`
- `@fastio/kit` → `packages/kit/src`

**Auto-imports:** DISABLED in all Nuxt apps (`imports: { autoImport: false }` in `nuxt.config.ts`). All imports must be explicit including Vue primitives (`ref`, `computed`, `watch`) and Nuxt composables (`useState`, `useRoute`).

**Cross-feature imports:**
- Cross-module TS imports only through barrel `~/features/<X>` (index.ts), never deep paths
- Vue components from other modules allowed via deep path: `~/features/<X>/components/Foo.vue`
- Vertical isolation (services ↔ retail) enforced by ESLint `no-restricted-imports` — full rules in `apps/admin/eslint.config.mjs`

## Error Handling

**Primary pattern — `reportError` from `@fastio/shared/observability`:**
```typescript
import { reportError } from '@fastio/shared/observability'

try {
  await someOperation()
} catch (e) {
  reportError(e)
}

// Or for fire-and-forget promises:
someApi.call().catch(reportError)
```

**`reportError` routes to Sentry** via `captureException` from `@sentry/nuxt`. Called in every catch block or after async failures. Accepts optional `context: Record<string, unknown>` for extra Sentry payload.

**Async API calls in composables:**
```typescript
const fetchOrders = async () => {
  loading.value = true
  try {
    const result = await api.orders.list(...)
    _orders.value = result.orders
  } finally {
    loading.value = false
  }
}
```
`loading` flag always in `finally`, not in `try`.

**Non-fatal logging (allowed):**
- `console.warn(...)` — for unexpected but recoverable states (e.g., `[useOrders] order not found`)
- `console.error(...)` — for Supabase/API errors in lower-level api functions
- `console.log()` is **banned** by ESLint rule (`no-restricted-syntax`)

## Logging

**Framework:** `@sentry/nuxt` via `reportError()` wrapper at `packages/shared/src/observability/reportError.ts`

**Patterns:**
- `reportError(error)` — catch blocks in composables, stores, and API functions
- `reportError(error, { orderId, context })` — when additional context needed for Sentry
- `console.warn('[composableName] message')` — dev-time warnings with composable name prefix
- `console.error('[ScopeTag]', error.message, error)` — in lower-level API files (e.g., Supabase query errors)
- `import.meta.dev` guard for dev-only logging: `if (import.meta.dev) console.warn(...)`

## Comments

**When to Comment:**
- Architecture decisions and non-obvious rationale (e.g., PREPROD-NNN issue references in code)
- WHY something is done a certain way, not what it does
- Workaround explanations (e.g., Nuxt 3.21 bug workaround in `nuxt.config.ts`)
- Russian language used in comments throughout (the project codebase uses Russian for inline comments and test descriptions)

**JSDoc/TSDoc:** Not used for regular functions. Types are self-documenting via TypeScript. Complex functions have explanatory prose comments above them.

**Issue references:** `PREPROD-NNN:` prefixes in comments link to specific bug/feature context (e.g., `// PREPROD-110: после disconnect могли пропасть INSERT/UPDATE/DELETE события`).

## Function Design

**Size:** Composables can be large (100-300+ lines) when orchestrating state. Pure utility functions are small and focused.

**Parameters:**
- Options bags via typed object for composable options: `options: UseOrdersOptions = {}`
- Reactive refs passed directly: `tenantId: Ref<string>`, not raw values
- Default parameters via `??`: `options.branchId?.value ?? null`

**Return Values:**
- Composables return plain objects (not reactive wrappers): `return { orders, loading, updateStatus, page, total }`
- Store actions return void or primitive (no reactive objects from actions)
- Mapper functions return the domain type directly

## Module Design

**Exports:** Named exports only. No default exports from composables, stores, or type files. Exception: Vue components use `<script setup>` so no explicit export needed.

**Barrel Files:** Every feature module has `index.ts` that re-exports all public API:
```typescript
// Public barrel of the orders module.
export * from './api/orders'
export * from './composables/useOrders'
export { useOrderStatusesStore } from './stores/order-statuses'
```
Stores use named re-export (not `export *`) to avoid accidental exposure.

**Feature Manifests:** Every feature directory requires `feature.manifest.ts` and `AGENTS.md`. Pre-commit hook validates their presence. `feature.manifest.ts` declares routes, permissions, DB tables, realtime subscriptions, and `dependsOn` graph.

## Vue Component Structure

**Template → Script → Style block order** (enforced by `vue/block-order`).

**Props/Emits:**
```vue
<script setup lang="ts">
import { UiCard, UiIcon, UiText } from '@fastio/ui'
import type { IconName } from '@fastio/icons'

defineProps<{
  name: string
  icon: IconName
  active: boolean
  locked?: boolean      // optional with ?
}>()

defineEmits<{ toggle: [value: boolean] }>()
</script>
```

**Styles:** Always `<style scoped lang="scss">`. No global styles. Tokens via `var(--color-*)`, `var(--space-*)`, `var(--radius-*)`, `var(--font-*)`. Media query mixins: `@use '@fastio/styles/mixins/media-queries' as mq`.

## UI Component Library

Use `@fastio/ui` components — never raw HTML equivalents:
- Text/Headings: `UiText`, `UiTitle` (not `<p>`, `<span>`, `<h*>`)
- Cards: `UiCard` (not `<div class="card">`)
- Buttons: `UiButton`, `UiEditButton`
- Lists: `UiDraggableList` + `UiListRow`, or `UiDataTable`
- Tags/chips: `UiTag`, `UiChip`
- Overlays: `UiDrawer` (complex forms >5 fields), `UiModal` (1-3 fields), `useConfirm()` (confirmation only)
- States: `UiEmpty`, `UiSkeleton`
- Layout: `UiPageHeader`, `UiFormSection`, `UiKeyValue`, `UiStatBlock`, `UiSectionHeader`

Always read component source at `packages/ui/src/components/UiFoo.vue` before use — do not guess props.

---

*Convention analysis: 2026-05-20*
