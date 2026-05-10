---
focus: quality
mapped: 2026-05-10
---

# Coding Conventions

## TypeScript

- **`type` over `interface`** — the codebase consistently uses `type` for all domain types, function signatures, and option bags. `interface` is not used.
- **Strict mode enabled** — root `tsconfig.json` sets `"strict": true`. All apps extend their `.nuxt/tsconfig.json` which inherits this.
- **No `any` in production code** — ESLint rule `@typescript-eslint/no-explicit-any` is set to `warn`. The `@ts-expect-error` / `as unknown as X` pattern is used sparingly and only in test utilities.
- **Generics** — used in composables for type-safe data containers: `useRealtimeList<T extends { id: string }>`, `useEditableForm<S, F extends object>`. Generic parameters are named conventionally (`T`, `S`, `F`).
- **Explicit nullability** — `null` is used over `undefined` for optional values in domain types (e.g., `branchId: string | null`).
- **camelCase in TS, snake_case in DB** — all domain types are camelCase; DB rows are snake_case. Conversion happens in mapper functions (e.g., `mapDish(raw)` in `apps/admin/utils/api/retail/dishes.ts`).
- **Unused vars** — `_` prefix convention for intentionally unused params: `argsIgnorePattern: '^_'`.

## Vue / Nuxt

- **`<script setup lang="ts">`** — all components use the Composition API with `<script setup>` and TypeScript.
- **Block order enforced by ESLint** — `vue/block-order: ['error', { order: ['template', 'script', 'style'] }]`. Template always first.
- **Auto-imports disabled** — Nuxt auto-imports are turned off in all apps. Every Vue primitive (`ref`, `computed`, `watch`, `onMounted`…), Nuxt utility (`useRouter`, `useRuntimeConfig`…), and composable must be explicitly imported. There is a `#imports` stub in `apps/admin/test-utils/nuxt-imports-stub.ts` to handle this in tests.
- **Component names in PascalCase** — `vue/component-name-in-template-casing: ['error', 'PascalCase']` is enforced. In templates: `<UiButton>`, `<AppointmentTimelineGrid>` — never kebab-case.
- **Self-closing tags** — all components and void HTML elements must be self-closing: `<UiButton />`, `<br />`.
- **Props via `defineProps<{...}>()`** — typed generics syntax, no runtime validators. `withDefaults` is used when defaults are needed.
- **Emits via `defineEmits<{...}>()`** — always typed with tuple syntax: `'update:modelValue': [value: string]`.
- **`storeToRefs`** — used to destructure reactive refs from Pinia stores without losing reactivity.
- **`#imports`** — Nuxt's virtual import module alias is used for router composables: `import { useRouter } from '#imports'`.

## Naming

| Entity | Convention | Example |
|---|---|---|
| Vue components | PascalCase `.vue` | `AppointmentTimelineGrid.vue`, `ColorPicker.vue` |
| Composables | `useXxx.ts`, camelCase | `useEditableForm.ts`, `useTimelineMoveBlocker.ts` |
| Pinia stores | `useXxxStore` (setup API) | `useTenantStore`, `useBranchStore` |
| API utils | `xxxApi` objects | `dishesApi`, `categoriesApi` |
| Type mappers | `mapXxx(raw)` functions | `mapDish`, `mapOrder` |
| DB row types | `XxxRow` suffix | `DishRow`, `CategoryRow` |
| Domain types | PascalCase, no suffix | `Dish`, `Category`, `Appointment` |
| Form data types | `XxxFormData` | `DishFormData`, `CategoryFormData` |
| Pages (Nuxt) | kebab-case directories + `index.vue` | `pages/appointments/timeline.vue` |
| Test files | `__tests__/` subdirectory | `composables/__tests__/usePlanFeatures.test.ts` |
| Constants / configs | camelCase object or `UPPER_SNAKE` for truly static sets | `TENANT_TABLES`, `DEFAULT_TIMEZONE` |

## Code Style

- **Arrow functions preferred** — ESLint `arrow-body-style: ['error', 'as-needed']` enforces concise bodies where possible. Named exports from composables and utils are `export const foo = () => ...`.
- **No `console.log`** — blocked by ESLint `no-restricted-syntax`. Only `console.warn()` and `console.error()` are allowed.
- **No debugger** — `no-debugger: 'error'`.
- **Single quotes** — `@stylistic/quotes: 'single'`.
- **No semicolons** — `@stylistic/semi: false`.
- **2-space indent** everywhere.
- **Trailing commas** in multi-line structures: `commaDangle: 'always-multiline'`.
- **1TBS brace style** — `{ braceStyle: '1tbs' }`.
- **Blank line before `return`** — enforced by `@stylistic/padding-line-between-statements`.
- **Blank line between variable declarations and other statements** — enforced; consecutive `const`/`let` can group without blank lines.
- **Arrow parens always** — `(x) => x`, never `x => x`.
- **`export const` for public API** — composables export a single default function or named exports from the same file. No default exports from stores or utils.

## CSS / Styles

- **Scoped styles only** — `<style scoped lang="scss">` in every component. Global styles are forbidden.
- **No BEM** — simple, short class names without block/element/modifier notation.
- **`-root` suffix for component root** — the root element of every component gets a class with `-root` suffix: `.color-picker-root`, `.timeline-root`, `.services-root`.
- **CSS custom properties for all values** — spacing: `var(--space-8)`, colors: `var(--color-text)`, `var(--color-border)`. Never hardcode pixel values or color literals in component styles.
- **`@fastio/styles` for global tokens and mixins** — imported via `@use '@fastio/styles/mixins/media-queries' as mq`. Always use existing tokens over hardcoded values.
- **Mobile-first responsive** — media queries written mobile-first using `mq` mixins from `@fastio/styles`.
- **SCSS nesting** — nesting used for state modifiers (`&:hover`, `&.selected`, `&.used`) and BEM-free sub-elements.

## Component Patterns

- **Template → Script → Style block order** (enforced by ESLint).
- **`defineProps` + `withDefaults`** for optional props with defaults.
- **`defineEmits` with typed tuples** — avoids runtime overhead.
- **Emit naming** — `update:modelValue` for v-model, verb-noun kebab-case for custom events: `appt-click`, `appt-move`, `cell-click`.
- **Props destructuring** — use `props.xxx` inside `<script setup>`, not destructured (to keep reactivity). Exception: `const { field } = toRefs(props)` when needed in computed.
- **UiCard for card-like containers** — any block with border + padding + border-radius must use `<UiCard>`, not a custom `<div>`.
- **UiText / UiTitle for typography** — never raw `<p>`, `<span>`, `<h1>`–`<h6>` for content text.
- **UiIcon for icons** — inline SVGs are forbidden. Always use `<UiIcon name="..." />`.
- **Read component source before use** — never guess props; read `packages/ui/src/components/UiFoo.vue` before using any UI lib component.

## Composable Patterns

- **One composable per file** — each file exports exactly one `useXxx` function.
- **Named export** — `export const useXxx = (...) => { ... }`. No default exports for composables.
- **Return an object** — always return a named-property object, never a tuple.
- **`ref` + explicit typing** — `const items = ref<T[]>([]) as Ref<T[]>` for non-inferred generics.
- **Cleanup in `onUnmounted`** — composables that subscribe (realtime channels, timers) clean up in `onUnmounted`. Checked via `getCurrentInstance()` guard when called outside component context.
- **Stores delegate to composables** — Pinia setup stores wrap a data composable and re-export its refs/methods. Example: `useTenantStore` wraps `useTenant()`.
- **`useDatabase()`** — the canonical way to access all API modules in the admin. Never import API utils directly in pages/components; go through `useDatabase()`.
- **Data composables vs service composables** — `composables/data/*` handles fetch + realtime; `composables/services/*` handles domain logic for the services vertical; `composables/retail/*` for the retail vertical.

## Error Handling

- **`query()` utility** (`apps/admin/utils/query.ts`) — wraps every Supabase promise: checks for `error`, shows a Naive UI toast via `message.error(error.message)`, and throws. All API utils in admin use this.
- **`reportError(e)`** (`apps/admin/utils/reportError.ts`) — sends errors to Sentry via `captureException`. Called in composables after any unexpected throw (e.g., in `useEditableForm` `submit` handler).
- **Server-side: `createError({ statusCode, message })`** — all Nitro/h3 handlers throw `createError` for business rule violations (400 Bad Request, 404 Not Found, 429 Too Many Requests). Never throw raw `Error` objects.
- **Cancelled operations pattern** — `cancelSubmit()` returns `new Error('cancelled')`. The `isCancelled(e)` check suppresses toast and `reportError` when a user intentionally aborts (e.g., closes a confirm modal).
- **User feedback** — success/error toasts via `useMessage()` from `@fastio/ui`. Error messages are user-facing strings in Russian.
- **Rate limiting on public endpoints** — `createRateLimiter(maxRequests, windowMs)` from `@fastio/shared` applied at the handler level (e.g., reservations, orders POST).

## Security Patterns

- **Supabase RLS** — all DB tables have Row Level Security. The admin uses a privileged client; the storefront uses an anon/user-scoped client.
- **`getTenantDb(event)`** (`apps/storefront/server/utils/tenantDb.ts`) — mandatory wrapper for all server handlers. Automatically injects `.eq('tenant_id', tenantId)` on every `from()` call via Proxy. Throws `400` if `tenantId` is absent from `event.context`.
- **Junction tables via `db.junction()`** — tables without `tenant_id` (e.g., `service_resources`) accessed via `db.junction()`, which skips the auto-filter. Use `db.crossTenant` only as an intentional escape hatch.
- **Cross-tenant tests** — `apps/storefront/server/__tests__/cross-tenant.test.ts` verifies that every public endpoint applies the tenant filter. Any bypass causes test failure.
- **Input validation in handlers** — body fields validated with explicit checks (`!body.field?.trim()`, `Number.isInteger(...)`) before any DB queries. Errors thrown immediately as `createError` with descriptive messages.
- **Auth checks via `getAuthenticatedCustomerId()`** — all customer-facing endpoints verify the session token before processing. No unauthenticated writes.
- **Vertical isolation (ESLint)** — `apps/admin/eslint.config.mjs` enforces that `services` code cannot import `retail` modules and vice versa. Aggregator files (`useDatabase.ts`, `useGate.ts`) are explicitly allow-listed. Tested by `apps/admin/__tests__/eslint-barrier.test.ts`.
- **SSRF protection on proxy endpoints** — image proxy validates and limits outbound URLs (committed in `fix(no-refs): SSRF-защита proxy-image`).
