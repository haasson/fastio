# Codebase Structure

**Analysis Date:** 2026-05-20

## Directory Layout

```
fastio/                          # Monorepo root
├── apps/
│   ├── admin/                   # Admin SPA (Nuxt 3, SSR off, port 4710)
│   │   ├── features/            # Domain modules (one dir per feature)
│   │   │   ├── _manifest.ts     # FeatureManifest type + defineFeature helper
│   │   │   ├── auth/
│   │   │   ├── menu/
│   │   │   ├── orders/
│   │   │   ├── kitchen/
│   │   │   ├── reservations/
│   │   │   ├── appointments/    # services vertical
│   │   │   ├── services-catalog/# services vertical
│   │   │   ├── tables/
│   │   │   ├── promotions/
│   │   │   ├── catalog/         # tags shared between food/services
│   │   │   ├── appearance/
│   │   │   ├── content/
│   │   │   ├── billing/
│   │   │   ├── branches/
│   │   │   ├── onboarding/
│   │   │   ├── settings/
│   │   │   ├── team/
│   │   │   ├── support/
│   │   │   ├── audit-log/
│   │   │   ├── ai-assistant/
│   │   │   └── help/
│   │   ├── shared/              # Cross-feature infrastructure
│   │   │   ├── data/            # useDatabase, useTenant, useRealtimeList/Watch
│   │   │   ├── plan/            # useGate, useModules, usePlans
│   │   │   ├── stores/          # Global Pinia: auth, tenant, branch
│   │   │   ├── utils/           # Pure helpers
│   │   │   ├── composables/     # Cross-feature composables
│   │   │   ├── components/      # Layout components (AppNav, BranchSelector)
│   │   │   └── ui/              # Admin-only UI components + UI composables
│   │   ├── pages/               # Nuxt file-based routing
│   │   ├── config/              # modules.ts, team-roles.ts, theme-presets
│   │   ├── columns/             # DataTable column definitions
│   │   ├── components/retail/   # Vertical-specific components (dashboard)
│   │   ├── composables/retail/  # Vertical-specific composables
│   │   ├── assets/css/          # Global SCSS
│   │   ├── middleware/          # auth.global.ts, gate.global.ts
│   │   ├── plugins/             # supabase.client.ts, vocab.client.ts
│   │   ├── layouts/             # default.vue
│   │   ├── __tests__/           # App-level integration tests
│   │   └── nuxt.config.ts
│   ├── storefront/              # Public storefront (Nuxt 3, SSR on, port 4711)
│   │   ├── features/            # Storefront domain modules
│   │   │   ├── _manifest.ts     # StorefrontFeatureManifest type
│   │   │   ├── cart/
│   │   │   ├── checkout/
│   │   │   ├── menu-catalog/
│   │   │   ├── delivery/
│   │   │   ├── booking/         # retail: table reservation
│   │   │   ├── appointments/    # services: appointment booking
│   │   │   ├── services-catalog/
│   │   │   ├── auth/
│   │   │   ├── branch/
│   │   │   └── account/
│   │   ├── shared/              # Storefront cross-feature infra
│   │   │   ├── composables/     # useTheme, useToast, useCurrency, useCatalogMode
│   │   │   ├── utils/           # reportError, buildProduct, format utils
│   │   │   └── ui/              # Layout sections, domain components (SfCartFab etc)
│   │   ├── pages/               # SSR routes (hybrid + vertical-only)
│   │   ├── server/              # Nitro server
│   │   │   ├── api/             # REST endpoints (menu.get.ts, orders.post.ts…)
│   │   │   ├── middleware/      # tenant.ts (host→Tenant), security-headers
│   │   │   └── utils/           # tenantDb, tenantCache, supabase, authHelpers
│   │   ├── assets/styles/       # SCSS (main.scss)
│   │   ├── types/               # Storefront-local TS types
│   │   ├── plugins/             # supabase.client.ts
│   │   ├── middleware/          # Client-side route guards
│   │   ├── app/                 # Nuxt app config
│   │   └── nuxt.config.ts
│   └── help/                    # Help center (Nuxt 3, SSR on, port 4712)
│       ├── pages/
│       ├── components/
│       ├── server/
│       └── nuxt.config.ts
├── packages/
│   ├── shared/                  # @fastio/shared — domain types + cross-app utils
│   │   └── src/
│   │       ├── types/           # One file per domain entity (Dish, Order, Tenant…)
│   │       ├── utils/           # Shared pure functions
│   │       ├── composables/     # Shared composables
│   │       ├── observability/   # reportError (Sentry wrapper)
│   │       └── server/          # Server-side utilities
│   ├── ui/                      # @fastio/ui — Admin UI (Naive UI wrappers)
│   │   └── src/
│   │       ├── components/      # Ui* components
│   │       │   └── internal/    # Internal sub-components
│   │       └── composables/     # useConfirm, useModals, useApi, useBreakpoints
│   ├── public-ui/               # @fastio/public-ui — Storefront UI (Fs* components)
│   │   └── src/
│   │       ├── components/
│   │       │   ├── base/        # FsButton, FsBadge, FsSkeleton, FsSpinner…
│   │       │   ├── overlay/     # FsDialog, FsDrawer, FsToast…
│   │       │   ├── form/
│   │       │   ├── layout/
│   │       │   ├── nav/
│   │       │   └── typography/
│   │       └── composables/
│   ├── styles/                  # @fastio/styles — SCSS tokens + mixins
│   │   ├── variables/           # CSS custom properties
│   │   ├── mixins/              # media-queries, etc.
│   │   ├── reset/
│   │   ├── typography/
│   │   └── layout/
│   ├── icons/                   # @fastio/icons — IconName type enum
│   │   └── src/
│   ├── kit/                     # @fastio/kit — storefront-side kit utilities
│   │   └── src/
│   │       ├── composables/
│   │       ├── constants/
│   │       ├── types/
│   │       └── utils/
│   └── kb/                      # @fastio/kb — knowledge base content
│       ├── content/             # *.md files served via Nitro storage
│       └── src/
├── supabase/
│   ├── migrations/              # Numbered SQL DDL files (001–301+)
│   ├── functions/               # Deno edge functions
│   │   ├── _shared/             # Shared Deno utilities across functions
│   │   ├── accept-invite/
│   │   ├── invite-member/
│   │   ├── payment-webhook/
│   │   ├── proxy-image/
│   │   ├── dadata-suggest/
│   │   └── send-new-tenant-email/
│   ├── seed/                    # Seed SQL files
│   └── snippets/                # Reusable SQL snippets
├── templates/
│   ├── feature-crud/            # Admin feature scaffold template
│   │   └── __feature__/         # api/, composables/, components/, stores/, AGENTS.md, feature.manifest.ts
│   └── storefront-feature/      # Storefront feature scaffold template
│       └── __feature__/         # api/, composables/, stores/, AGENTS.md, feature.manifest.ts
├── scripts/
│   ├── codemap/                 # Codemap scanner (updates .claude/codemap/)
│   ├── features/                # validate-manifests.mjs
│   ├── storefront-features/     # validate storefront manifests
│   ├── db/                      # DB utility scripts
│   ├── e2e/                     # E2E test helpers
│   └── tg-webhook-relay/        # Telegram webhook relay (Vercel function)
├── tests/e2e/                   # Playwright E2E tests
├── docs/                        # Architecture docs, plans, code-reviews
│   ├── admin-arch.md
│   ├── storefront-arch.md
│   ├── feature-manifests.md
│   ├── vertical-isolation.md
│   └── plans/                   # YYYY-MM-DD-name.md planning docs
├── .claude/
│   ├── codemap/                 # Auto-generated index JSON files per app/package
│   └── worktrees/
├── .planning/
│   └── codebase/                # GSD codebase map documents (STACK.md, ARCHITECTURE.md…)
├── package.json                 # Root pnpm workspace config
├── pnpm-workspace.yaml          # Workspace packages: apps/* + packages/*
├── turbo.json                   # Turborepo task graph
├── vitest.config.ts             # Root vitest config
├── playwright.config.ts         # Playwright E2E config
└── tsconfig.json                # Root TypeScript config
```

## Directory Purposes

**`apps/admin/features/<X>/`:**
- Purpose: Isolated domain module. Contains everything for one feature.
- Contains: `api/*.ts` (CRUD), `composables/use*.ts`, `components/*.vue`, `stores/*.ts`, `types.ts`, `index.ts` (barrel), `feature.manifest.ts`, `AGENTS.md`, optionally `__tests__/`
- Key files: `index.ts` (public API), `feature.manifest.ts` (machine-readable metadata)

**`apps/admin/shared/`:**
- Purpose: Infrastructure shared by all features. Dependency direction: features → shared (never reverse).
- Key files: `shared/data/useDatabase.ts`, `shared/data/useRealtimeList.ts`, `shared/stores/auth.ts`, `shared/stores/tenant.ts`, `shared/plan/useGate.ts`

**`apps/storefront/server/`:**
- Purpose: Nitro server — all DB access from the storefront goes here.
- Key files: `server/middleware/tenant.ts`, `server/utils/tenantDb.ts`, `server/utils/tenantCache.ts`

**`packages/shared/src/types/`:**
- Purpose: Canonical domain type definitions. Single source of truth for `Tenant`, `Dish`, `Order`, `Branch`, etc.
- Key files: `tenant.ts`, `menu.ts`, `order.ts`, `appointment.ts`

**`packages/ui/src/components/`:**
- Purpose: All `Ui*` admin components. Must be read before use — never guess props.
- Key files: `UiCard.vue`, `UiDrawer.vue`, `UiModal.vue`, `UiDataTable.vue`, `UiPageHeader.vue`, `UiFormSection.vue`

**`packages/public-ui/src/components/`:**
- Purpose: All `Fs*` storefront components.
- Key files: `base/FsButton.vue`, `overlay/FsDialog.vue`, `overlay/FsDrawer.vue`

**`supabase/migrations/`:**
- Purpose: Versioned PostgreSQL DDL. Sequential numeric filenames (e.g., `301_audit_logs_retention_fix.sql`).
- Generated: No (hand-authored)
- Committed: Yes

**`.claude/codemap/`:**
- Purpose: Auto-generated JSON index files per app/package. Used by AI to navigate codebase without reading all files.
- Generated: Yes (by `scripts/codemap/`, triggered at pre-commit)
- Committed: Yes

**`templates/`:**
- Purpose: Scaffold templates for new features. Used by `pnpm new:feature` and `pnpm new:storefront-feature` generators.
- Not production code — these are template stubs.

## Key File Locations

**Entry Points:**
- `apps/admin/plugins/supabase.client.ts`: Admin bootstrap — creates Supabase client, sets auth state
- `apps/admin/middleware/auth.global.ts`: Admin auth enforcement + tenant init
- `apps/storefront/server/middleware/tenant.ts`: Storefront tenant resolution per request
- `apps/storefront/pages/index.vue`: Storefront home (hybrid aggregator)

**Global Stores:**
- `apps/admin/shared/stores/auth.ts`: Auth user state
- `apps/admin/shared/stores/tenant.ts`: Current tenant + permissions
- `apps/admin/shared/stores/branch.ts`: Current branch

**Data Access:**
- `apps/admin/shared/data/useDatabase.ts`: Admin DB aggregator (single import point for all CRUD)
- `apps/admin/shared/data/useRealtimeList.ts`: Generic realtime list composable
- `apps/admin/shared/data/useRealtimeWatch.ts`: Generic realtime single-object composable
- `apps/admin/shared/data/useTenant.ts`: Tenant composable (used by `tenant.ts` store)

**Feature Access Control:**
- `apps/admin/shared/plan/useGate.ts`: Full gate registry (all verticals)
- `apps/admin/shared/plan/useGate.retail.ts`: Retail-only gates (strict typing)
- `apps/admin/shared/plan/useGate.services.ts`: Services-only gates (strict typing)

**Configuration:**
- `apps/admin/config/modules.ts`: `ModuleKey` type + `ModuleConfig` registry
- `apps/admin/config/team-roles.ts`: Role permissions definition
- `packages/shared/src/types/tenant.ts`: `TenantModules`, `BusinessType`, `Tenant` type

**Domain Types:**
- `packages/shared/src/types/menu.ts`: `Dish`, `Category`, `Combo`, `Modifier`
- `packages/shared/src/types/order.ts`: `Order`, `OrderItem`, `OrderStatus`
- `packages/shared/src/types/tenant.ts`: `Tenant`, `TenantModules`, `BusinessType`
- `packages/shared/src/types/appointment.ts`: `Appointment`, `Resource`, `ScheduleTemplate`

**Testing:**
- `vitest.config.ts`: Root vitest config (unit/integration tests)
- `playwright.config.ts`: E2E test config
- `tests/e2e/`: Playwright E2E specs
- Per-feature `__tests__/`: Unit tests co-located with feature code

## Naming Conventions

**Files:**
- Feature composables: `use<EntityName>.ts` — e.g., `useOrders.ts`, `useOrderCard.ts`
- Feature API modules: `<entity>.ts` (plural noun) — e.g., `dishes.ts`, `orders.ts`
- Admin UI components: `Ui<Name>.vue` — e.g., `UiCard.vue`, `UiDataTable.vue`
- Storefront UI components: `Fs<Name>.vue` — e.g., `FsButton.vue`, `FsDialog.vue`
- Admin shared components: `App<Name>.vue` for layout (e.g., `AppNav.vue`), descriptive names for domain (e.g., `ImageUploadModal.vue`)
- Storefront domain components: `Sf<Name>.vue` — e.g., `SfCartFab.vue`, `SfProductCard.vue`
- Pinia stores: `use<Entity>Store` — e.g., `useTenantStore`, `useBranchStore`
- Feature manifests: `feature.manifest.ts` (fixed name)
- Feature barrels: `index.ts` (fixed name)

**Directories:**
- Feature modules: `kebab-case` — e.g., `services-catalog/`, `audit-log/`, `ai-assistant/`
- Composable subdirs: camelCase matching composable grouping — e.g., `appointmentEditor/`, `timeline/`
- Test dirs: `__tests__/` (double underscores)

## Where to Add New Code

**New admin feature:**
1. Run scaffold: `pnpm new:feature <name> --vertical=<retail|services|shared> --purpose="..."`
2. Or manually copy `templates/feature-crud/__feature__/` → `apps/admin/features/<name>/`
3. Required files: `feature.manifest.ts`, `AGENTS.md`, `index.ts` (barrel)
4. API functions: `apps/admin/features/<name>/api/<entity>.ts` (pure functions, first arg `SupabaseClient`)
5. Register API in: `apps/admin/shared/data/useDatabase.ts` (add `import` + `bindAll` entry)
6. Pages: `apps/admin/pages/<name>/` or `apps/admin/pages/<name>.vue`

**New storefront feature:**
1. Run scaffold: `pnpm new:storefront-feature <name> --vertical=<retail|services|shared> --purpose="..."`
2. Or manually copy `templates/storefront-feature/__feature__/` → `apps/storefront/features/<name>/`
3. Server API (if DB access needed): `apps/storefront/server/api/<name>.get.ts` (or `.post.ts`)
4. Barrel: `apps/storefront/features/<name>/index.ts`

**New Nitro endpoint (storefront):**
- Location: `apps/storefront/server/api/<resource>.<method>.ts`
- Must use: `getTenantDb(event)` from `server/utils/tenantDb.ts` for DB access
- Tenant available: `event.context.tenant as Tenant`

**New shared domain type:**
- Location: `packages/shared/src/types/<entity>.ts`
- Export from: `packages/shared/src/types/index.ts`

**New admin UI component:**
- Add to: `packages/ui/src/components/Ui<Name>.vue`
- Export from: `packages/ui/src/index.ts`

**New storefront UI component:**
- Shared storefront (layout/sections): `apps/storefront/shared/ui/`
- Reusable public package: `packages/public-ui/src/components/<category>/Fs<Name>.vue`

**New shared utility:**
- Cross-all-apps pure util: `packages/shared/src/utils/`
- Admin-only shared util: `apps/admin/shared/utils/`
- Storefront-only shared util: `apps/storefront/shared/utils/`

**New migration:**
- Location: `supabase/migrations/<next-number>_<description>.sql`
- Number must be sequential; run via `docker exec ... psql -f <file>` (never `supabase db reset`)

**New Supabase edge function:**
- Location: `supabase/functions/<name>/index.ts`
- Shared utilities: `supabase/functions/_shared/`

## Special Directories

**`.claude/codemap/`:**
- Purpose: Auto-generated JSON index files for AI navigation (what exists and why)
- Generated: Yes, by `scripts/codemap/` pre-commit hook
- Committed: Yes; must not have `purpose: null` entries (blocks commit)
- Manual update: `pnpm codemap:scan --all`

**`.planning/`:**
- Purpose: GSD planning artifacts — HANDOFF.json, codebase maps
- Generated: Partially (HANDOFF.json by GSD commands, *.md by map-codebase agent)
- Committed: No (`.gitignore`)

**`.worktrees/`:**
- Purpose: Git worktrees for parallel work
- Generated: Yes
- Committed: No

**`supabase/.branches/`:**
- Purpose: Supabase local branch state
- Generated: Yes
- Committed: No

**`apps/admin/.nuxt/` and `.output/`:**
- Purpose: Nuxt build artifacts
- Generated: Yes
- Committed: No

---

*Structure analysis: 2026-05-20*
