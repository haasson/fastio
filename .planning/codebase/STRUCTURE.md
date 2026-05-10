---
focus: arch
mapped: 2026-05-10
---

# Directory Structure

## Root Layout

```
fastio/
├── apps/                  # Five Nuxt 3 applications
├── packages/              # Shared local packages (@fastio/*)
├── supabase/              # DB migrations, Edge Functions, seed data
├── scripts/               # Dev tooling (codemap scanner, pre-commit hooks)
├── docs/                  # Plans, code reviews, policy docs
├── memory-bank/           # AI persistent project context
├── .claude/codemap/       # JSON/MD maps of project symbols (auto-generated)
├── .planning/             # GSD planning artifacts
├── turbo.json             # Turborepo task pipeline
├── pnpm-workspace.yaml    # pnpm workspace: apps/* + packages/*
├── tsconfig.json          # Root TypeScript config (extended by each app)
└── vitest.config.ts       # Vitest root config
```

## apps/admin

Nuxt 3 SPA (`ssr: false`), port **4710**. Tenant management panel.

```
apps/admin/
├── pages/                 # File-based routing (Nuxt convention)
│   ├── index.vue          # Dashboard
│   ├── menu/              # Categories, dishes, modifiers, tags, combos
│   ├── services/          # Service categories, services, tags
│   ├── orders/            # Orders list, statuses, delivery settings
│   ├── kitchen/           # Queue, overlay, settings
│   ├── reservations/      # Bookings, settings
│   ├── appointments/      # Timeline, history, staff, objects, templates, settings
│   ├── tables/            # Tables layout, call management
│   ├── promotions/        # Promotions, promo codes
│   ├── appearance/        # Sections, pages, theme, SEO
│   ├── content/           # Banners, gallery, vacancies, reviews
│   ├── settings/          # Contacts, notifications, delivery zones, modules, addons
│   ├── team/              # Members, roles, branches
│   ├── account/           # Profile, billing
│   ├── help/              # Tours, support
│   ├── login.vue
│   ├── invite.vue
│   ├── set-password.vue
│   └── legal/
│
├── components/
│   ├── ui/                # Shared admin UI: ColorPicker, DishItemRow, AppPageActionBar,
│   │                      # AddressSuggestInput, ImageUploadModal, RichTextEditor, etc.
│   ├── layout/            # AppNav, BranchSelector, PastDueBanner
│   ├── menu/              # Dish/category/modifier/combo/tag components
│   ├── services/          # Services domain components
│   ├── appointments/      # Timeline grid, appointment form, inbox, etc.
│   ├── catalog/           # CategoryFormModal, shared catalog components
│   ├── orders/            # Order card, status badge, order events
│   ├── kitchen/           # Kitchen queue card, overlay
│   ├── reservations/      # Reservation form, table picker
│   ├── retail/            # Retail-specific components
│   ├── promotions/        # Promo form, promo code table
│   ├── gallery/           # Gallery manager
│   ├── billing/           # Plan cards, billing history
│   ├── appearance/        # Theme editor, section builder
│   ├── settings/          # Module toggle, delivery zone editor
│   ├── tables/            # Table grid, call alert
│   ├── ai/                # AI chat widget
│   ├── onboarding/        # Onboarding wizard components
│   ├── support/           # Support ticket components
│   └── legal/             # Legal document components
│
├── composables/
│   ├── data/              # Data layer: fetch + realtime subscriptions
│   │   ├── useDatabase.ts          # Aggregates all API modules, binds Supabase client
│   │   ├── useRealtimeList.ts      # Generic reactive list with Supabase Realtime
│   │   ├── useRealtimeWatch.ts     # Generic reactive single-object watcher
│   │   ├── useTenant.ts            # Tenant data, memberships, permissions, roles
│   │   ├── useBranches.ts          # Branch CRUD + realtime
│   │   ├── useBranch.ts            # Current branch selection logic
│   │   ├── useCategories.ts        # Menu categories
│   │   ├── useTeam.ts              # Members + invitations
│   │   ├── useTags.ts              # Dish/service tags
│   │   ├── useAddons.ts            # Dish addons
│   │   ├── useRoles.ts             # Role management
│   │   ├── useBanners.ts           # Content banners
│   │   ├── useGalleries.ts         # Photo galleries
│   │   ├── useAuditLog.ts          # Audit log viewer
│   │   ├── useSupportChannel.ts    # Support chat realtime
│   │   └── createRealtimeBus.ts    # Low-level realtime bus factory
│   ├── retail/            # Orders, dishes, reservations, kitchen, tables, promotions, delivery
│   ├── services/          # Appointments, resources, timeline, schedule, inbox
│   │   ├── timeline/              # Timeline layout composables
│   │   └── appointmentEditor/     # Appointment editor state/logic
│   ├── menu/              # Dish modifiers editor
│   ├── plan/              # Plan/billing/gate/module feature checks
│   │   ├── useGate.ts             # Route+feature permission check
│   │   ├── useGate.routes.ts      # Route → permission mapping
│   │   ├── useGate.types.ts
│   │   ├── useModules.ts
│   │   ├── usePlanFeatures.ts
│   │   └── usePlans.ts
│   ├── delivery/          # Delivery zone editor, polygon draw, Dadata
│   └── ui/                # UI utilities: useDrawer, useEditableForm, useFormDirty,
│                          # usePageForm, useItemManager, useDelayedLoading, etc.
│
├── stores/
│   ├── auth.ts            # Supabase User + loading
│   ├── tenant.ts          # Current tenant, permissions — delegates to useTenant
│   ├── branch.ts          # Branch list + current selection — delegates to useBranches/useBranch
│   ├── retail/            # deliveryZone.ts, order-statuses.ts, reservations.ts
│   └── services/          # appointmentSettings.ts
│
├── utils/
│   ├── api/               # Low-level CRUD: (sb: SupabaseClient, ...args) => Promise<T>
│   │   ├── retail/        # categories, dishes, orders, modifiers, tables, kitchen, etc.
│   │   ├── services/      # appointments, resources, schedule-templates, visits, etc.
│   │   ├── tenants.ts, members.ts, branches.ts, tags.ts, roles.ts, etc.
│   │   ├── realtime.ts    # Channel setup/teardown helpers
│   │   └── db-types.ts    # Supabase DB-level type assertions
│   ├── retail/            # Retail-specific business utils
│   └── services/          # Services-specific utils (timelineAvailability, etc.)
│
├── columns/               # DataTable column definitions (Naive UI format)
│   ├── team.ts, reservations.ts, promotions.ts, promo-codes.ts, addons.ts, modifiers.ts
│   └── _promo-shared.ts
│
├── config/
│   ├── modules.ts         # ModuleConfig[] — all toggleable features with plan/businessType gates
│   ├── onboarding.ts      # Onboarding steps config
│   ├── retail/            # Retail-specific configs
│   └── google-fonts.ts, theme-presets.ts, team-roles.ts
│
├── server/
│   ├── api/               # Admin server routes (H3)
│   │   ├── ai/chat.post.ts         # AI assistant endpoint
│   │   ├── telegram/               # Telegram bot webhook + notifications
│   │   ├── tel/[phone].get.ts      # Phone-based customer history lookup
│   │   ├── dadata/                 # Address suggestions proxy
│   │   ├── promo/                  # Promo validation endpoints
│   │   └── health.get.ts
│   ├── ai/                # AI knowledge base and tools
│   │   ├── knowledge/     # Markdown files loaded as AI context
│   │   ├── tools.ts       # AI function tools definitions
│   │   ├── loadKnowledge.ts
│   │   └── fetchContext.ts
│   ├── plugins/           # Server plugins
│   └── utils/             # Server-side utilities
│
├── plugins/
│   ├── supabase.client.ts          # Supabase client init, auth state, $supabase provide
│   ├── auth.client.ts              # Auth helpers
│   ├── vocab.client.ts             # Vocabulary init
│   └── yandex-maps.client.ts       # Yandex Maps lazy init
│
├── middleware/
│   ├── auth.global.ts     # Redirect unauthenticated → /login
│   └── gate.global.ts     # Route-level permission/module check
│
├── layouts/
│   └── default.vue        # Main shell: nav + content area
│
├── assets/css/            # Global SCSS (ui.scss, tour.scss)
├── public/                # Static assets + fonts
└── tours/                 # Driver.js tour definitions
```

## apps/storefront

Nuxt 3 SSR (`ssr: true`), port **4711**. Customer-facing branded storefront.

```
apps/storefront/
├── pages/
│   ├── index.vue          # Home / storefront landing
│   ├── menu.vue           # Full menu page
│   ├── cart.vue           # Cart page
│   ├── checkout.vue       # Checkout flow
│   ├── delivery.vue       # Delivery info
│   ├── booking.vue        # Table reservation
│   ├── category/          # Category-specific dish listing
│   ├── order/             # Order status/tracking
│   ├── appointments/      # Online appointment booking
│   ├── account/           # Customer account
│   ├── promotions/        # Active promotions
│   ├── table/             # QR-table ordering flow
│   └── other static pages (gallery, vacancies, privacy, about, ui)
│
├── components/
│   ├── sf/                # Storefront-specific components (SfDishCard, SfCartButton, etc.)
│   ├── layout/            # Header, footer, nav
│   ├── cart/              # Cart items, cart drawer
│   ├── checkout/          # Address form, delivery picker, payment
│   ├── sections/          # Configurable storefront sections
│   ├── appointments/      # Booking flow components
│   ├── booking/           # Table booking components
│   ├── branch/            # Branch selector
│   ├── delivery/          # Delivery zone map
│   ├── account/           # Account profile, orders history
│   ├── auth/              # Login/register modals
│   └── table/             # QR table session components
│
├── composables/
│   ├── useAnalytics.ts         # Event tracking
│   ├── useBooking.ts           # Table reservation flow
│   ├── useBranchSwitcher.ts    # Branch selection UX
│   ├── useCartEdit.ts          # Cart item manipulation
│   ├── useCartReconciler.ts    # Cart reconciliation with menu data
│   ├── useCatalogMode.ts       # Menu/catalog view mode
│   ├── useDishCustomization.ts # Modifier/addon selection
│   ├── useIsMobile.ts
│   ├── useModal.ts
│   ├── useTheme.ts             # Tenant CSS theme application
│   ├── useToast.ts
│   ├── useSupabaseClient.ts    # Anon Supabase client for customer auth
│   ├── useTableRealtime.ts     # Table order realtime subscription
│   └── others...
│
├── stores/
│   ├── menu.ts            # Menu catalog (categories + dishes + combos + modifiers)
│   ├── cart.ts            # Cart state
│   ├── checkout.ts        # Checkout form state
│   ├── auth.ts            # Customer auth session
│   ├── selectedBranch.ts  # Active branch
│   ├── services.ts        # Services catalog for appointments
│   ├── addresses.ts       # Saved delivery addresses
│   └── table.ts           # QR table session
│
├── server/
│   ├── middleware/tenant.ts    # Resolves tenant from host → event.context.tenant
│   ├── api/
│   │   ├── menu.get.ts         # Full menu: categories + dishes + combos + modifiers
│   │   ├── tenant.get.ts       # Tenant config
│   │   ├── branches.get.ts     # Branch list
│   │   ├── orders.post.ts      # Place order
│   │   ├── orders/[id].get.ts  # Order status
│   │   ├── reservations/       # Reservation create/check slots
│   │   ├── appointments/       # Appointment booking, slots, reminders
│   │   ├── customer/           # Customer profile, order history
│   │   ├── auth/               # Telegram auth flow
│   │   ├── delivery-zones.get.ts
│   │   ├── services-catalog.get.ts
│   │   ├── check-address.post.ts
│   │   ├── dadata/
│   │   ├── promo/
│   │   └── table/
│   ├── services/          # Shared server-side service helpers
│   └── utils/
│       ├── tenantDb.ts    # Tenant-scoped Supabase Proxy (auto tenant_id injection)
│       ├── supabase.ts    # Server Supabase client (service-role)
│       ├── authHelpers.ts
│       ├── customerAuth.ts
│       └── telegramAuth.ts
│
├── layouts/
│   ├── default.vue        # Standard storefront layout
│   └── table.vue          # QR table layout (minimal chrome)
│
├── plugins/               # Client plugins (analytics, Sentry, etc.)
├── middleware/
│   ├── auth.global.ts     # Customer auth guard
│   └── no-services.ts / no-promotions.ts   # Feature availability guards
│
└── assets/styles/         # Global SCSS + theme tokens
```

## packages/shared

`@fastio/shared` — zero-dependency package of domain types and pure utilities. Used by all apps and packages.

```
packages/shared/src/
├── types/                 # Domain TypeScript types (type, not interface)
│   ├── tenant.ts          # Tenant, TenantModules, BusinessType, MenuStyle, etc.
│   ├── menu.ts            # Category, Dish, Combo, MenuItem, DishTagDefinition, etc.
│   ├── order.ts           # Order, OrderItem, OrderStatus, etc.
│   ├── appointment.ts     # Appointment, AppointmentStatus, etc.
│   ├── appointmentInbox.ts
│   ├── appointmentRequest.ts
│   ├── service.ts         # Service, Resource, ScheduleTemplate
│   ├── branch.ts          # Branch, BranchFormData, DishBranchPrice
│   ├── member.ts          # TenantMember, Invitation
│   ├── role.ts            # TenantRole, RolePermissions
│   ├── reservation.ts     # Reservation
│   ├── customer.ts        # Customer, CustomerSession
│   ├── billing.ts         # Subscription, Plan, BillingTransaction
│   ├── kitchen.ts         # KitchenQueueItem
│   ├── table.ts           # Table, TableCall
│   ├── promotion.ts       # Promotion, PromoCode
│   ├── modifier.ts        # ModifierGroup, ModifierOption
│   ├── delivery-zone.ts
│   ├── audit-log.ts
│   ├── gallery.ts
│   ├── support.ts
│   ├── addon.ts
│   ├── visit.ts           # Visit/check-in record
│   └── scheduleTemplate.ts
│
├── utils/                 # Pure domain utilities (no Vue, no Supabase)
│   ├── menu.ts            # mapCategory, mapDish, mapCombo, etc.
│   ├── scheduling.ts      # Time slot generation, schedule helpers
│   ├── appointment.ts     # Appointment date/time utils
│   ├── appointmentSlots.ts
│   ├── appointmentEvents.ts
│   ├── scheduleTemplate.ts
│   ├── service.ts
│   ├── price.ts           # Price formatting, calculations
│   ├── phone.ts           # Phone number formatting/validation
│   ├── slugify.ts
│   ├── vocabulary.ts      # Pluralization, word forms
│   ├── planLevel.ts       # Plan tier comparisons
│   ├── planConstants.ts
│   ├── planResolve.ts
│   ├── resolveModules.ts  # Module availability from plan
│   ├── format.ts          # Date/number formatting
│   ├── date.ts            # Date utilities
│   ├── timezone.ts
│   ├── geo.ts             # Geolocation helpers
│   ├── workingHours.ts
│   ├── roles.ts           # Role permission checks
│   ├── reconcile-cart.ts  # Cart reconciliation logic
│   ├── orderItemKey.ts
│   ├── reservation.ts
│   ├── defaultTheme.ts    # Default tenant theme config
│   ├── defaultSiteContent.ts
│   ├── defaultSiteLayout.ts
│   ├── defaultSeo.ts
│   ├── themePresets.ts
│   ├── heroPresets.ts / heroGradients.ts / heroLayout.ts
│   ├── tagPresets.ts
│   ├── categoryColors.ts
│   ├── validateTenantConfig.ts
│   ├── rateLimit.ts
│   ├── deepMerge.ts
│   ├── branchAddress.ts
│   ├── siteFeatures.ts
│   ├── telegramReminderOptions.ts
│   └── planConstants.ts
│
└── composables/           # Two Vue composables usable in both admin and storefront
    ├── useSchedulingSlots.ts   # Slot availability for appointment booking
    └── useDadataSuggestions.ts # Dadata address autocomplete
```

## packages/ui

`@fastio/ui` — Naive UI wrapper components for `apps/admin`. All components are `Ui*` prefixed.

```
packages/ui/src/
├── components/
│   ├── UiAlert.vue, UiBadge.vue, UiButton.vue, UiCard.vue
│   ├── UiCheckbox.vue, UiChip.vue, UiCollapse.vue, UiCollapseItem.vue
│   ├── UiConfigProvider.vue    # Naive UI theme provider
│   ├── UiConfirmModal.vue      # Reusable confirm dialog
│   ├── UiDataTable.vue, UiDatepicker.vue, UiTimepicker.vue
│   ├── UiDivider.vue, UiDrawer.vue, UiEmpty.vue
│   ├── UiEditButton.vue, UiFilterReset.vue
│   ├── UiForm.vue, UiGrid.vue, UiInput.vue, UiInputNumber.vue
│   ├── UiMenu.vue, UiMenuDropdown.vue, UiModal.vue, UiBottomSheet.vue
│   ├── UiPagination.vue, UiPhotoPlaceholder.vue, UiPicture.vue
│   ├── UiPopover.vue, UiRadioGroup.vue, UiSectionHeader.vue
│   ├── UiSegmentedControl.vue, UiSelect.vue, UiSkeleton.vue
│   ├── UiSlider.vue, UiSpace.vue, UiStepper.vue, UiSwitch.vue
│   ├── UiTabs.vue, UiTag.vue, UiText.vue, UiTitle.vue
│   ├── UiTimeline.vue, UiTimelineItem.vue, UiTree.vue
│   └── internal/               # Internal sub-components
├── composables/
│   ├── useBreakpoints.ts       # Responsive breakpoint detection
│   ├── useConfirm.ts           # Programmatic confirm dialog
│   ├── useModals.ts            # Modal stack management
│   ├── useMutation.ts          # Async mutation with loading/error state
│   ├── useQuery.ts             # Async data fetch with loading state
│   ├── useResponsiveSize.ts    # Size tokens by breakpoint
│   └── useMessage.ts           # Naive UI message notification
└── config/
    └── naive-ui-theme-overrides.ts   # Naive UI theme customization
```

## Other packages

### packages/public-ui (`@fastio/public-ui`)
UI library for `apps/storefront`. Components prefixed `Fs*`. Built on Reka UI + vaul-vue (drawer). Mobile-first, CSS custom property tokens, no dependency on Naive UI.

```
packages/public-ui/src/
├── components/
│   ├── base/        # FsAlert, FsBadge, FsButton, FsDivider, FsDropdownList,
│   │                # FsIconButton, FsSkeleton, FsSpinner, FsTag
│   ├── form/        # FsCheckbox, FsField, FsForm, FsInput, FsLabel,
│   │                # FsRadioGroup, FsSelect, FsSwitch, FsTextarea
│   ├── overlay/     # FsDialog, FsDrawer, FsToast, FsToastProvider, FsTooltip
│   ├── layout/      # Layout primitives
│   ├── nav/         # Navigation components
│   └── typography/  # Text components
├── composables/     # Public-UI-specific composables
└── styles/          # Component SCSS
```

### packages/kit (`@fastio/kit`)
Runtime kit shared between `storefront` and `public-ui`. No Naive UI dependency.

```
packages/kit/src/
├── composables/
│   ├── useBreakpoints.ts    # Responsive breakpoints
│   ├── useModals.ts         # Modal management
│   ├── useConfirm.ts        # Confirm dialog
│   ├── useMutation.ts       # Async mutation
│   └── useQuery.ts          # Async data fetch
├── utils/
│   ├── layers.ts            # CSS layer stack utilities
│   ├── throttle.ts
│   ├── validators.ts        # Form field validators
│   └── validation-rules.ts
├── types/
│   ├── form.ts, modals.ts, responsive.ts
└── constants/
    ├── colors.ts            # Color tokens
    └── form-size.ts
```

### packages/icons (`@fastio/icons`)
```
packages/icons/src/
├── UiIcon.vue     # Universal icon component (size prop, color prop)
├── icons.ts       # Lucide icon registry (name → component map)
└── index.ts       # Re-exports
```

### packages/styles (`@fastio/styles`)
Global SCSS design system. Used via `@use '@fastio/styles/...'`.

```
packages/styles/
├── variables/
│   ├── index.scss       # Main token entry
│   ├── colors.scss      # Color tokens (--color-*, semantic colors)
│   ├── breakpoints.scss # Breakpoint values
│   ├── fonts.scss       # Font stacks
│   ├── shapes.scss      # Border radius tokens
│   └── sizes.scss       # Spacing/size tokens
├── mixins/
│   ├── media-queries.scss  # @mixin sm/md/lg/xl/xxl
│   ├── surface.scss        # Surface/card mixins
│   ├── layout.scss         # Flex/grid helpers
│   ├── form.scss           # Form field mixins
│   ├── typography.scss     # Text style mixins
│   └── safe-area.scss      # iOS safe area helpers
├── reset/          # CSS reset
├── typography/     # Base typography styles
├── layout/         # Base layout utilities
└── libs/           # Third-party lib style patches
```

### packages/kb (`@fastio/kb`)
Knowledge base content for the help app and admin AI assistant.

```
packages/kb/
├── content/        # 50+ Markdown articles organized by feature module (01-xx to 14-xx)
└── src/
    └── index.ts    # TypeScript structure map: article metadata + category groupings
```

## supabase

```
supabase/
├── migrations/     # 261 sequential SQL migration files (NNN_description.sql)
│   └── (numbered 001..261 — each file is atomic, applied in order)
├── functions/      # Deno Edge Functions
│   ├── accept-invite/          # Accept team invitation
│   ├── add-custom-domain/      # Custom domain provisioning
│   ├── dadata-suggest/         # Address autocomplete proxy (server-side key)
│   ├── get-invite/             # Retrieve invitation details
│   ├── invite-member/          # Send team invitation email
│   ├── list-team/              # Admin team listing
│   ├── payment-webhook/        # Payment provider webhook handler
│   ├── proxy-image/            # SSRF-safe image proxy with size/timeout limits
│   ├── send-new-tenant-email/  # Welcome email on tenant creation
│   ├── send-order-email/       # Order confirmation email
│   └── send-recovery-email/    # Password recovery email
├── seed/           # Seed SQL files (applied manually via docker exec)
├── templates/      # Email HTML templates
└── snippets/       # Reusable SQL snippets
```

Migration naming: `NNN_short_description.sql`. Each migration is idempotent or one-way. Never run `supabase db reset` — apply individual files via `docker exec ... psql -f`.

## Naming Conventions

### Files
- **Pages**: `kebab-case.vue` or `[param].vue` for dynamic routes
- **Components**: `PascalCase.vue` — domain prefix for feature components (e.g., `AppointmentTimelineGrid.vue`, `OrderCard.vue`)
- **Composables**: `camelCase.ts` with `use` prefix (`useOrders.ts`, `useRealtimeList.ts`)
- **Stores**: `camelCase.ts` matching store name (`tenant.ts` → `useTenantStore`)
- **API utils**: `kebab-case.ts` matching domain (`order-statuses.ts`, `schedule-templates.ts`)
- **Types**: `camelCase.ts` matching domain (`appointment.ts`, `menu.ts`)

### Components
- `Ui*` — `@fastio/ui` components (Naive UI wrappers for admin)
- `Fs*` — `@fastio/public-ui` components (storefront)
- `App*` — generic admin UI atoms (`AppPageActionBar`, `AppDraggableList`)
- Domain-prefixed feature components (`AppointmentEditor`, `OrderCard`, `KitchenQueueCard`)

### Composables
- `use[Domain][Feature]` — scoped composables (`useOrderStatuses`, `useAppointmentInboxCounter`)
- `useGate` — permission checks (appears in both admin and storefront)
- `useRealtimeList` / `useRealtimeWatch` — generic realtime patterns

### Types
- `type` keyword only (no `interface`)
- PascalCase for domain types: `Tenant`, `Order`, `Appointment`, `Branch`
- Suffix `FormData` for form state: `BranchFormData`, `DishFormData`
- Suffix `Row` for raw DB row shapes in server code

### Stores (Pinia)
- File: `camelCase.ts`
- Export: `useXxxStore = defineStore('xxx', () => { ... })` (setup API)
- Convention: store delegates logic to composables, thin wrapper for global access

### CSS / Styles
- Scoped `<style scoped>` in all `.vue` files — no global styles in components
- No BEM — short flat class names with `-root` suffix for component root
- Tokens: `var(--color-*)`, `var(--size-*)` from `@fastio/styles`
- Responsive: `@include mq.sm {}` via `@use '@fastio/styles/mixins/media-queries' as mq`
- Mobile-first breakpoints
