# Codebase Concerns

**Analysis Date:** 2026-05-20

## Tech Debt

**processed_webhook_events — no TTL or cleanup:**
- Issue: Table `processed_webhook_events` (migration `supabase/migrations/235_processed_webhook_events.sql`) stores ЮKassa `payment.id` for idempotency with no TTL, partitioning, or cleanup job. Table grows unbounded.
- Files: `supabase/migrations/235_processed_webhook_events.sql`
- Impact: Unbounded disk growth; index scans will degrade over time proportional to all-time payment volume.
- Fix approach: Add a `pg_cron` job (`DELETE FROM processed_webhook_events WHERE processed_at < now() - interval '90 days'`), similar to the `audit_logs_cleanup` cron in migration 300.

**vitest.config.ts — hardcoded h3 path in pnpm store:**
- Issue: `h3` is aliased to a hardcoded pnpm store path `node_modules/.pnpm/h3@1.15.11/node_modules/h3/dist/index.mjs`. When `h3` is updated, the version number must be updated manually or tests fail with confusing resolution errors.
- Files: `vitest.config.ts` (line with `'h3': resolve(...)` comment references TECHDEBT.md)
- Impact: Silent breakage on `h3` patch/minor upgrades until someone notices failing tests.
- Fix approach: Replace with `require.resolve('h3')` or use a Vite plugin alias that resolves dynamically.

**Telegram appointment reminder — unreliable via admin webhook:**
- Issue: When a TG-authenticated customer accepts a reminder offer in the storefront, `remind-offer.post.ts` sends buttons to Telegram. The callback lands in admin's `auth-webhook.post.ts`, which then upserts into `appointment_reminders`. If admin is down (deploy, restart) at the moment the user taps the button, the reminder is silently lost — the user already saw "✅ отправлено".
- Files: `apps/storefront/server/api/appointments/remind-offer.post.ts`, `apps/admin/server/api/telegram/auth-webhook.post.ts` (lines ~302, ~400), `apps/admin/server/api/telegram/send-appointment-reminders.post.ts`
- Impact: Reminder loss during admin deploys; no retry or error surfacing to user.
- Fix approach: Direct upsert to `appointment_reminders` from the storefront when the user taps "remind me", eliminating the admin webhook dependency.

**Reservations Pinia store — realtime handler leak on remount:**
- Issue: `useReservations` registers `onInsert`, `onUpdate`, `onDelete`, `onReconnect` handlers from `useReservationsChannel` but never unregisters them. The composable is called from a Pinia store (`useReservationsStore`), so in practice it is a singleton and does not remount — but the FIXME comment acknowledges this as a pre-existing pattern that would leak on any future non-singleton usage.
- Files: `apps/admin/features/reservations/composables/useReservations.ts` (lines 50–80), `apps/admin/features/reservations/stores/reservations.ts`
- Impact: Low risk now (Pinia store is effectively a singleton), but dangerous if composable is ever used directly in a component. Pattern diverges from `useOrders` which correctly calls `onUnmounted(offReconnect)`.
- Fix approach: Follow the `useOrders` pattern — return `off` callbacks from each `on*` registration and call them in `onUnmounted`.

**FASTIO_LEGAL — placeholder legal data in production code:**
- Issue: `apps/admin/features/legal/utils/fastio-legal.ts` is entirely placeholder `[FILL_ME: ...]` values. If any legal page (offer, privacy policy) renders these, users see raw placeholder strings.
- Files: `apps/admin/features/legal/utils/fastio-legal.ts`
- Impact: Compliance risk; broken legal documents exposed to end users.
- Fix approach: Fill in actual legal entity data before any public launch or disable the legal pages until data is available.

**Vacancy feature — half-implemented dead code:**
- Issue: The "vacancies" page/tab is planned but not implemented. Multiple TODO comments gate it behind commented-out code. The `feature.manifest.ts` declares `/content/vacancies` route. The page tab, preview, settings, and `siteFeatures.ts` entry are all commented out or guarded by `TODO`.
- Files: `apps/admin/pages/content.vue` (line 15–16), `apps/admin/features/appearance/components/AppearancePreview.vue` (lines 98, 469), `apps/admin/features/appearance/components/PageSettingsByKey.vue` (lines 82–83), `packages/shared/src/utils/siteFeatures.ts` (line 23), `apps/admin/features/content/feature.manifest.ts`
- Impact: Dead code and manifest declarations for a non-existent feature increase maintenance surface.
- Fix approach: Either remove all vacancies references and the manifest path until implementation begins, or create a proper feature flag behind `siteFeatures`.

**Reservation cron — single timezone per tenant, no per-branch timezone:**
- Issue: `supabase/migrations/092_reservation_cron_timezone.sql` has a `TODO` noting that when branches get their own timezone, the cron must `JOIN branches` and use `COALESCE(b.timezone, t.timezone)`. Currently all branches of a multi-timezone tenant fire autocomplete based on the tenant's timezone.
- Files: `supabase/migrations/092_reservation_cron_timezone.sql` (line 6)
- Impact: Reservations in branches outside the tenant timezone auto-complete at the wrong UTC time.
- Fix approach: Add `timezone` column to `branches` table and update the cron query with the documented `COALESCE(b.timezone, t.timezone)` pattern.

## Security Considerations

**TENANT_TABLES manually maintained — security gap on new migrations:**
- Risk: `apps/storefront/server/utils/tenantDb.ts` maintains `TENANT_TABLES` as a hardcoded `Set`. When a new table with `tenant_id` is added via migration and the developer forgets to add it to `TENANT_TABLES`, `db.raw.from('new_table')` bypasses the auto-injected tenant filter. Since the server uses a service-role key (bypasses RLS), this leaks all tenants' data.
- Files: `apps/storefront/server/utils/tenantDb.ts` (line 19), `supabase/migrations/` (any new tenant table)
- Current mitigation: A drift-check test exists in `apps/storefront/server/utils/__tests__/tenantTablesDrift.test.ts` that compares `TENANT_TABLES` against the live DB `information_schema`. However, this test only runs when `RUN_TENANT_TABLES_DRIFT_CHECK=1` AND `SUPABASE_URL` AND `SUPABASE_SERVICE_ROLE_KEY` are set — i.e., only in the nightly e2e workflow against a live DB. Regular CI does not run it with a live database.
- Recommendations: Add the drift check to the `migrate.yml` workflow after applying migrations, using the live prod DB credentials. Alternatively, generate `TENANT_TABLES` automatically from the schema at build time.

**Internal API secret — exposure window on misconfiguration:**
- Risk: `apps/admin/server/utils/auth.ts` `requireInternalSecret()` throws 500 if `NUXT_INTERNAL_API_SECRET` is not set. This is "secure by default" but means a misconfigured deploy rejects all cron-triggered endpoints, potentially causing silent feature loss (reminders, queue updates).
- Files: `apps/admin/server/utils/auth.ts`
- Current mitigation: The 500 path is handled; the error is explicit. Not a data-leak risk.
- Recommendations: Add deployment health-check that verifies the secret is configured, and alert on 500s from internal endpoints.

**Storefront Supabase client is untyped:**
- Risk: `apps/storefront/server/utils/supabase.ts` instantiates `createClient` without the `Database` generic (`SupabaseClient` not `SupabaseClient<Database>`). Queries return `any`-typed rows, forcing `as unknown as SomeType` casts throughout (`apps/storefront/server/api/menu.get.ts` has 7+ such casts; `apps/storefront/server/services/order-items.ts` has 4+). Type errors in query results are invisible to TypeScript.
- Files: `apps/storefront/server/utils/supabase.ts`, `apps/storefront/server/api/menu.get.ts`, `apps/storefront/server/services/order-items.ts`, `apps/storefront/server/services/order-delivery.ts`
- Current mitigation: Manual type assertions everywhere; server-side logic is tested via integration tests.
- Recommendations: Add `Database` type to storefront Supabase client (same `database.types.ts` is available via `apps/admin/shared/data/database.types.ts` — either symlink or move to `packages/shared`).

## Performance Bottlenecks

**menu.get.ts — multiple sequential Supabase queries:**
- Problem: `apps/storefront/server/api/menu.get.ts` fires multiple sequential queries (dishes, combos, addon bindings, option groups, modifier groups) for every menu page request. No caching layer exists between Supabase and the SSR endpoint.
- Files: `apps/storefront/server/api/menu.get.ts`
- Cause: Each category of data requires a separate PostgREST call; results are assembled in-process.
- Improvement path: Consider a server-side cache (e.g., LRU with TTL keyed by `tenantId`) for menu responses, or a denormalized RPC that returns the full menu structure in one call.

**group-week.get.ts — 470-line appointment aggregation:**
- Problem: `apps/storefront/server/api/appointments/group-week.get.ts` (470 lines) aggregates a week's slots in TypeScript after fetching from the DB. For tenants with many resources/slots this is CPU-heavy per request.
- Files: `apps/storefront/server/api/appointments/group-week.get.ts`
- Cause: Slot logic lives in `packages/shared/src/utils/appointmentSlots.ts` (806 lines) and runs server-side on each request.
- Improvement path: Cache aggregated slot availability per `(tenantId, week, resourceId)` with invalidation on appointment write, or move aggregation to a DB function.

## Fragile Areas

**tenantDb.ts Proxy — insert() is blocked but workaround is footgun:**
- Files: `apps/storefront/server/utils/tenantDb.ts`
- Why fragile: The Proxy blocks `db.from('x').insert()` with a runtime 500, requiring callers to use `db.crossTenant.from('x').insert({..., tenant_id})` explicitly. If a developer uses `db.crossTenant` for reads on tenant tables (not just inserts), the tenant filter is not applied and cross-tenant data is returned without any warning.
- Safe modification: Only use `db.crossTenant` for inserts that explicitly include `tenant_id` in payload. Never use `db.crossTenant` for select/update/delete on tenant tables.
- Test coverage: `apps/storefront/server/utils/__tests__/tenantDb.test.ts` covers the Proxy behavior.

**useReservationsChannel / useOrdersChannel — reconnect handler accumulation:**
- Files: `apps/admin/features/reservations/composables/useReservationsChannel.ts`, `apps/admin/features/orders/composables/useOrdersChannel.ts`
- Why fragile: Reconnect handlers are pushed into an array (`reconnectHandlers.push(handler)`) with no deduplication. If `onReconnect` is called multiple times for the same logical handler (e.g., HMR or future non-singleton use), handlers accumulate and fire multiple times per reconnect.
- Safe modification: Add a `Map` keyed by handler reference or a `Set` to prevent duplicate registration.
- Test coverage: No tests for channel composables.

**database.types.ts — manually regenerated, not CI-enforced:**
- Files: `apps/admin/shared/data/database.types.ts` (4377 lines, auto-generated by `pnpm db:gen-types`)
- Why fragile: The file is generated by `supabase gen types` but the drift check script (`scripts/db/check-types-drift.mjs`) is not wired into any CI workflow. A migration that adds/changes a table without regenerating types causes silent TypeScript drift — callers may reference non-existent columns with `any` fallback.
- Safe modification: Run `pnpm db:gen-types && git add apps/admin/shared/data/database.types.ts` after every migration. Document this in migration checklist.
- Fix approach: Add `db:gen-types:check` to the `migrate.yml` workflow step after applying migrations.

**TablesCanvas.vue — 734-line visual canvas component:**
- Files: `apps/admin/features/tables/components/TablesCanvas.vue`
- Why fragile: A single Vue SFC managing drag/drop table layout, resize, collision detection, and persistence. No unit tests. Any refactor risks visual regressions.
- Safe modification: Treat as a black box. Test via E2E (playwright). Do not extract sub-components without covering the drag/drop event loop.
- Test coverage: No unit tests; covered only by nightly E2E if at all.

## Missing Critical Features

**DB types drift not enforced in CI:**
- Problem: `pnpm db:gen-types:check` exists but is not run in any GitHub Actions workflow (not in `ci.yml`, not in `migrate.yml`, not in `e2e-nightly.yml`). DB schema and TypeScript types can diverge silently.
- Blocks: Type safety for any new DB column or table; storefront is already untyped.

**No retry mechanism for Telegram notification failures:**
- Problem: Telegram notification endpoints (`notify.post.ts`, `notify-reservation.post.ts`, `telegramBroadcast.ts`) log errors with `console.error` and `reportError` but do not retry. A Telegram API outage or RKN block silently drops all notifications.
- Files: `apps/admin/server/utils/telegramBroadcast.ts`, `apps/admin/server/api/telegram/notify.post.ts`, `apps/admin/server/api/telegram/notify-reservation.post.ts`
- Note: `NUXT_TELEGRAM_PROXY_URL` partially mitigates RKN blocks for outbound requests but does not add retry logic.

## Test Coverage Gaps

**admin/features — zero unit tests across 22 business feature modules:**
- What's not tested: All business logic in `apps/admin/features/` (reservations, appearance, catalog, settings, services-catalog, tables, team, support, audit-log, promotions, legal, billing, onboarding, help, ai-assistant, branches, content, kitchen). The 0 test files in `apps/admin/features/**/__tests__/` means composables, API modules, and stores go entirely untested.
- Files: `apps/admin/features/reservations/`, `apps/admin/features/appointments/api/`, `apps/admin/features/orders/api/orders.ts`, `apps/admin/features/appearance/composables/useAppearanceForm.ts`
- Risk: Regressions in core reservation, order, and appointment flows are invisible until E2E or user reports.
- Priority: High

**Storefront Vue components — no component-level tests:**
- What's not tested: All `.vue` files in `apps/storefront/features/` (cart, checkout, menu-catalog, booking, auth, delivery, account, appointments, branch). Tests exist only for server-side utilities and store logic.
- Files: `apps/storefront/features/checkout/pages/checkout.vue`, `apps/storefront/features/cart/stores/cart.ts` (partially tested), `apps/storefront/features/menu-catalog/` (only `useDishCustomization.test.ts`)
- Risk: UI interaction bugs (form submission, branch switching, cart manipulation) are invisible to unit test suite.
- Priority: Medium

**Appointments feature — no API layer tests:**
- What's not tested: `apps/admin/features/appointments/api/` (resources.ts at 587 lines, visits.ts at 520 lines, schedule-templates.ts). These contain complex Supabase query builders.
- Files: `apps/admin/features/appointments/api/resources.ts`, `apps/admin/features/appointments/api/visits.ts`
- Risk: Silent breakage of appointment scheduling and resource management.
- Priority: High

---

*Concerns audit: 2026-05-20*
