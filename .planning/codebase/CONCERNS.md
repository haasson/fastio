---
focus: concerns
mapped: 2026-05-10
---

# Technical Concerns

## Known Tech Debt

### `processed_webhook_events` — no TTL / no cleanup
`supabase/migrations/235_processed_webhook_events.sql` creates a table for ЮKassa webhook idempotency. No `pg_cron` cleanup, no partitioning — the table grows unboundedly. Fix: add a cron job to delete rows older than N days.

### `vitest.config.ts` — hardcoded h3 path in pnpm store
`vitest.config.ts` has a hardcoded alias `'h3': resolve(__dirname, 'node_modules/.pnpm/h3@1.15.5/...')`. When `h3` is updated, the path must be manually updated or tests break with obscure errors. Needs dynamic `require.resolve` or equivalent.

### Telegram reminder reliability — unreliable storefront → TG → admin webhook → DB chain
`apps/storefront/server/api/appointments/remind-token.post.ts` sends Telegram inline buttons. When user taps, the callback goes to the admin webhook which upserts into `appointment_reminders`. If admin is down during the callback (deploy, restart), the user already saw "✅ sent" in Telegram but the reminder was not saved. Fix: write directly to `appointment_reminders` from storefront, removing dependency on admin webhook round-trip.

### `appointments` — `update_appointment` RPC does not write audit events
Migration 220 (`update_appointment`) does not insert into `appointment_events`. The event type for changes exists but the INSERT was never added. Tracked in `TECHDEBT.md`. Fix when audit trail becomes a requirement.

### `appointments` — `extend_appointment` RPC is missing
`actual_ends_at` field for extending an appointment is intentionally not touched by `update_appointment`. A dedicated `extend_appointment(p_id, p_actual_ends_at)` RPC is pending (deferred to "stage 0d").

### `appointments` — cancel/confirm as dedicated RPCs are missing
`update_appointment` does not change `status`, `cancelled_*`, `confirmed_*` fields — these are deferred to a future stage. Until then, cancellation/confirmation workflows are incomplete from the RPC layer.

### `useOrderCard` — per-card `useNow` timers
`apps/admin/composables/retail/useOrderCard.ts` uses `createSharedComposable(() => useNow({ interval: 30_000 }))` — this is already a shared composable so the concern is resolved. (Cross-verify if a kitchen screen still has a separate clock instance.)

### `apps/admin/utils/fastio-legal.ts` — placeholder legal data not filled
`apps/admin/utils/fastio-legal.ts` contains `[FILL_ME: ...]` placeholders for all legal entity fields (entity name, INN, OGRN, address, email, etc.). Must be filled before production launch.

### Vacancies feature — stubbed in multiple places
Four locations contain `TODO: vacancies` markers:
- `apps/admin/pages/content.vue` (tab hidden)
- `apps/admin/components/appearance/PageSettingsByKey.vue`
- `apps/admin/components/appearance/AppearancePreview.vue`
- `packages/shared/src/utils/siteFeatures.ts`

### ~261 migrations — no squash
~261 individual migration files have accumulated. A squash to a single clean baseline is needed **before the first real tenant is onboarded** (after that, squashing is destructive). Tracked in `TECHDEBT.md`.

### `count_pending_visits` — RPC on every realtime event
`useAppointmentInboxHandler.ts` calls `api.visits.countNew()` (a DB RPC) on every realtime event from `appointment_groups`, debounced at 300ms. At scale, active tenants will trigger many RPC calls. The `LATER.md` proposes denormalizing into `tenants.pending_visits_count` with a DB trigger.

### `TIMEZONE_OPTIONS` — only Russian timezones hardcoded
`packages/shared/src/utils/timezone.ts` has a TODO noting the list covers only Russian time zones. Multi-region branches will need the full IANA list.

### Soft delete missing for orders
Soft delete (`archived_at`) exists for dishes, categories, promotions, promo codes, modifiers, addons, and branches — but not for orders. Tracked in `TECHDEBT.md`.

---

## Security Concerns

### In-memory rate limiter — not multi-instance safe
`packages/shared/src/utils/rateLimit.ts` uses a module-level `Map`. When Nitro (storefront SSR) runs multiple instances (horizontal scaling), each instance has its own counter — a client can multiply the limit by the number of instances. Rate limiting currently applied to: `orders.post.ts`, `reservations/index.post.ts`, `appointments/bulk.post.ts`, `auth/telegram/login.post.ts`. Fix: Redis or a Supabase table-based limiter for production.

### Edge Functions `invite-member` and `add-custom-domain` — no rate limiting
`supabase/functions/invite-member/index.ts` and `supabase/functions/add-custom-domain/index.ts` authenticate via Supabase JWT but have no per-IP or per-user rate limiting. An authenticated attacker could spam invites or domain-add calls. Tracked in `LATER.md`.

### `proxy-image` Edge Function — wildcard CORS (`Access-Control-Allow-Origin: *`)
`supabase/functions/proxy-image/index.ts` returns `Access-Control-Allow-Origin: *`. The SSRF mitigations (private IP regex blocklist, `https`-only, 10 MB limit, 10s timeout) are in place, but CORS wildcard means any origin can use this as an open image proxy to Supabase's Function URL. Consider restricting to known storefront/admin origins.

### `AppearancePreview.vue` — unsanitized `v-html` from user-controlled `content.hero.text`
`apps/admin/components/appearance/AppearancePreview.vue:44` renders `v-html="content.hero.text"` directly without DOMPurify sanitization. `content` comes from `SiteContent` props which originate from tenant-controlled DB data. An admin user with write access could inject arbitrary HTML. Lower risk (requires authenticated admin), but worth sanitizing for defense-in-depth.

### `apps/admin` — no Sentry server-side config
`apps/admin/sentry.client.config.ts` exists, but there is no `sentry.server.config.ts`. Server-side errors in admin's Nuxt server routes will not be captured by Sentry.

### `tenantDb.ts` — `TENANT_TABLES` set is a manual allowlist
`apps/storefront/server/utils/tenantDb.ts` maintains a hardcoded `TENANT_TABLES` Set. If a new tenant-scoped table is added to the DB without updating this set, `db.raw.from('new_table')` will bypass the auto-injected tenant filter and the service-role client will return cross-tenant data. An integration test (`tenantTablesDrift.test.ts`) guards this, but it only runs with `RUN_TENANT_TABLES_DRIFT_CHECK=1` against a live Supabase — it does not run in the default CI suite.

### `pending_telegram_auths` — cleanup is pg_cron, not a TTL constraint
Migration 175 uses `pg_cron` to delete expired rows daily at 03:23. If pg_cron is not enabled on the Supabase project, expired nonces are never deleted. No hard DB constraint enforces expiry — the poll endpoint checks `expires_at` in application code, which is correct, but stale rows accumulate silently.

---

## Performance Concerns

### `buildTimelineAvailability` — called on every date/resource change
`apps/admin/utils/services/timelineAvailability.ts` recomputes full per-resource availability bundles on each timeline reload. With many resources and complex schedule templates, this is a potentially expensive synchronous computation. No memoization by date or resource.

### `AppointmentTimelineGrid.vue` — 622 lines, many computed props cascading
`apps/admin/components/appointments/AppointmentTimelineGrid.vue` (622 lines) and `apps/admin/pages/appointments/timeline.vue` (554 lines) together form a tightly coupled pair with cascading `computed` chains. Any reactive dependency change triggers re-layout of the entire grid.

### `appointments/bulk.post.ts` — 567 lines, sequential DB calls inside a loop
`apps/storefront/server/api/appointments/bulk.post.ts` (567 lines) processes each appointment item with individual DB lookups inside the request handler. No batch query for availability validation — N items → N round-trips to Supabase.

### `reservations/index.post.ts` — two sequential DB calls before insert
`apps/storefront/server/api/reservations/index.post.ts` fetches `tenants` then `reservation_settings` in separate sequential queries. These could be parallelized with `Promise.all`.

### `useAppointmentInboxCounter` — RPC call on every realtime event (300ms debounce)
Each change to `appointment_groups` triggers a `count_pending_visits` RPC. At high booking volume, this generates continuous round-trips. Proposed fix (LATER.md): denormalize to `tenants.pending_visits_count` with a DB trigger.

### No CDN for images
The `proxy-image` Edge Function has no caching headers beyond `Cache-Control: public, max-age=3600` in its own response. There is no CDN (Cloudflare R2, etc.) in front. Every request for the same image goes through Supabase Edge. Noted in `LATER.md`.

### `apps/admin/utils/api/services/resources.ts` — 587 lines
The resources API util is the largest single utility file. It aggregates all resource-related DB operations, making it hard to tree-shake and creating a hot import path.

---

## Fragile Areas

### Storefront `tenantDb.ts` Proxy pattern
`apps/storefront/server/utils/tenantDb.ts` wraps the Supabase client with a JavaScript `Proxy` that intercepts `.from(table)` calls and auto-injects tenant filters. This is clever but fragile: any new Supabase client API surface (e.g., `.schema()`, batch operations) that routes through non-intercepted paths silently bypasses the tenant filter. The coverage test only runs manually.

### Timeline drag-and-drop (`useTimelineDrag.ts` + `AppointmentTimelineGrid.vue`)
The drag system spans `apps/admin/composables/services/timeline/useTimelineDrag.ts` (184 lines), `useTimelineLayout.ts` (250 lines), and `AppointmentTimelineGrid.vue` (622 lines). The geometry calculations for overnight windows (`wrapToWindowMin`) and the drag ghost positioning are tightly coupled to pixel-per-minute math. Any change to slot step, window boundaries, or overnight handling risks breaking drag alignment.

### `useAppointmentEditorState.ts` — 562 lines, 15+ imports
`apps/admin/composables/services/useAppointmentEditorState.ts` is the central appointment editor orchestrator. It depends on 15+ composables and stores (`useEditorCompetencies`, `useAppointmentViewScope`, `useEditorSnapshot`, `useEditorSave`, `useEditorSlotApply`, `useServiceSlots`, `useGroupSlotSearch`, etc.). Changing any of these propagates risk back to the editor.

### `appointments` — branch-awareness partially implemented
The admin sidebar branch selector filters the timeline page but **not** `pages/appointments/objects.vue`, `pages/appointments/settings.vue`, and `pages/appointments/templates.vue`. These pages show global data regardless of selected branch. Tracked in `LATER.md` as "Branch-awareness in appointments".

### Schedule template system
`apps/admin/components/appointments/TemplateDrawer.vue` (696 lines) and `apps/admin/utils/api/services/schedule-templates.ts` implement a multi-step shift cycle with day overrides. The `resolveResourceWorkingHours` logic in `packages/shared` walks override → shift cycle → weekly schedule → branch schedule → tenant schedule in priority order. Any change to priority logic affects all timeline availability calculations.

### `apps/admin/layouts/default.vue` — 542 lines
The root admin layout is 542 lines and initializes many stores, channels, and app-level state. It is the single mount point for `useRealtimeChannels`, making it a system-wide dependency.

---

## Missing Coverage

### Storefront server API routes — no unit tests
`apps/storefront/server/api/orders.post.ts`, `appointments/bulk.post.ts`, `reservations/index.post.ts` have no unit tests. The only server tests are integration-level (`__tests__/bulk.post.test.ts`, `cross-tenant.test.ts`) and the drift check.

### Timeline geometry and drag logic — not tested
`useTimelineLayout.ts`, `useTimelineDrag.ts`, `useScrollToNow.ts` have no test files. Bugs in overnight window math or pixel-per-minute calculations are caught only visually.

### Edge Functions — no automated tests
All `supabase/functions/` (payment-webhook, invite-member, add-custom-domain, proxy-image, etc.) have no test suite. The payment webhook processes financial operations with no automated verification.

### `useAppointmentEditorState.ts` — no tests
The 562-line editor state composable orchestrating all appointment creation/edit logic has no test coverage.

### Promo code and promotion logic — limited coverage
`apps/admin/utils/retail/__tests__/promoStatus.test.ts` covers promo status display. The server-side `apps/storefront/server/services/order-promo.ts` (discount application, free item logic, scheduled delivery time validation) has no unit tests.

### `buildTimelineAvailability` — no tests
`apps/admin/utils/services/timelineAvailability.ts` which computes disabled slots, absence info, and working hours has no test file. The only related tests are for `useTimelineMoveBlocker`.

---

## Dependencies

### Supabase Cloud — blocked in Russia
The project currently runs on Supabase Cloud which is inaccessible from Russian IP addresses. Migration to Coolify + self-hosted Supabase is listed as a **critical pre-production blocker** in `LATER.md`. A migration plan exists at `MIGRATION_COOLIFY.md` (referenced in LATER.md, not confirmed present).

### `vue-yandex-maps ^3.0.3` — used in both admin and storefront
Yandex Maps SDK is present in both apps. Any Yandex service disruption or API deprecation affects delivery zone maps and address suggestions (`dadata-suggest` Edge Function also in play).

### `@ai-sdk/openai ^3.0.52` and `ai ^6.0.141` in admin
The admin app depends on Vercel AI SDK and OpenAI. The AI chat (`components/ai/AiChat.vue`, 489 lines) creates a hard dependency on OpenAI availability. No fallback or graceful degradation if OpenAI is unavailable.

### `naive-ui ^2.42.0` — UI library with many transitive dependencies
The admin app wraps Naive UI in `@fastio/ui`. Naive UI is a large library; all components are available globally via plugin, which may impact initial bundle size despite tree-shaking.

### `nuxt ^3.15.0` — pinned minor, not latest
Both apps use Nuxt 3.15.0. Nuxt 3 has had active releases; keeping up with security patches requires periodic updates.

### `tiptap ^3.20.1` — rich text editor (admin only)
TipTap v3 is relatively new; the admin uses it for rich text in appearance settings (`components/ui/RichTextEditor.vue`, 580 lines). The v3 API is still evolving.

---

## Architecture Concerns

### Flat file structure — no feature isolation
All composables, components, and utils are organized by type (`composables/data/`, `composables/services/`, `components/appointments/`, etc.) rather than by feature. This makes it easy to create cross-feature dependencies without enforcement. The `LATER.md` documents a planned migration to feature-based modules (8 phases, ~6 weeks). Until then, import boundaries are informal.

### `useDatabase()` aggregator — single large import surface
`apps/admin/composables/data/useDatabase.ts` aggregates all API modules into one object. Every component that needs any data operation imports the entire aggregated API. This works but makes it impossible to tree-shake individual modules and creates a single point of coupling.

### No structured server-side logging
`apps/storefront/server/` uses `console.error` and `reportError` (Sentry) but no structured logging with `tenantId`, `requestId`, or `orderId` context. Debugging production issues requires log scanning without correlation IDs. Noted in `LATER.md`.

### `TENANT_TABLES` set is hand-maintained
As noted in Security Concerns, the allowlist of tenant-scoped tables in `tenantDb.ts` must be kept in sync manually with DB migrations. The guard test is not part of the default CI run.

### Appointment reminder architecture — two-hop write path
The Telegram reminder flow (`remind-token.post.ts` → Telegram bot → admin webhook → `appointment_reminders` DB) adds latency and a reliability gap. See Telegram reliability entry in Tech Debt.

### Admin is SPA (SSR off) — all data fetched client-side
`apps/admin` is a Nuxt 3 SPA with SSR disabled. All data is loaded via Supabase client on the browser. This simplifies auth but means initial page load can be slow on cold starts (large JS bundle + data fetches after hydration).

### Supabase Realtime channels initialized in root layout
`apps/admin/layouts/default.vue` initializes all realtime channels via `useRealtimeChannels`. If the layout re-renders (route changes that re-mount the layout), channels could be re-subscribed. The composable lifecycle management relies on `onMounted`/`onUnmounted` in child composables, which is correct but adds coupling between channel lifecycle and layout component lifecycle.

### `packages/shared/src/index.ts` — single barrel re-export (67 export statements)
All shared utilities, types, and composables are re-exported from a single `index.ts`. This works fine but means any consumer gets the full shared package in their import graph. With `~40 files` and `~180 symbols`, this is manageable today but will grow.
