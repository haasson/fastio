# Domain Pitfalls: Nuxt 3 SaaS Launch Readiness

**Domain:** Multi-tenant SaaS (restaurants / salons), Nuxt 3 SSR storefront + SPA admin, Supabase backend
**Researched:** 2026-05-20
**Confidence:** HIGH (architecture-specific pitfalls verified against actual codebase)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, security incidents, or trust-destroying events.

---

### Pitfall 1: SSR Cross-Request State Pollution

**What goes wrong:** Module-level `ref()` in server-side composables creates shared state across all requests. User A's cart or profile data leaks to User B when concurrent requests hit the same Nitro worker.

**Why it happens:** Nuxt's server runs as a long-lived Node.js process. A `ref()` defined at module scope (not inside a function call) is shared across every incoming request. This is invisible in local development where requests are mostly sequential but explodes under concurrent production load.

**This codebase's exposure:** The storefront uses SSR with Pinia stores per feature (`features/cart/stores/cart.ts`, etc.). Stores correctly use `useState()` for SSR-safe state, but any new composable added during the launch-readiness phase that uses a module-level `ref()` for shared data will silently introduce cross-user data leakage.

**Consequences:** Cart items from one customer visible to another. Security-relevant: customer phone/name leaking in OTP auth flow. Extremely hard to reproduce in dev (requires concurrent traffic).

**Warning signs:** Reports of "I saw someone else's data" after traffic spikes. Intermittent wrong pre-filled values in forms. Data correct on reload but wrong on first hit.

**Prevention:**
- All SSR-shared state must use `useState()` with a unique key, never bare `ref()` at module level
- Pinia stores created inside composables are scoped per-request by Nuxt's `useNuxtApp()` — this is safe
- Add CI smoke test: fire 10 concurrent requests from two different "users" to `/api/menu`, assert no cross-contamination in response tenant fields

**Phase:** Launch readiness — E2E and security hardening phase

---

### Pitfall 2: Supabase service-role key leaking into browser bundle

**What goes wrong:** The service-role key bypasses all RLS. If it ends up in client-side Nitro output (via an import chain or misconfigured `runtimeConfig`), every visitor gets full admin DB access.

**Why it happens:** Nuxt `runtimeConfig` has two namespaces: `runtimeConfig.public.*` is embedded in the client bundle; `runtimeConfig.*` (non-public) is server-only. Developers under time pressure sometimes move the service-role key to `public` to "make a feature work." Vite's tree-shaking does not protect against accidental runtime bundle inclusion — only import isolation does.

**This codebase's exposure:** The storefront's `server/utils/supabase.ts` correctly holds the service-role client. The architectural constraint "no direct Supabase calls from storefront client" is documented and ESLint-enforced. The risk is a future developer adding a `plugins/supabase.client.ts` in storefront that pulls in the service role key, or a misconfigured Coolify env var with the wrong prefix.

**Consequences:** Complete database dump, full tenant impersonation, billing manipulation. This is catastrophic and irreversible without a key rotation.

**Warning signs:** Build output includes `supabaseServiceRoleKey` in `_nuxt/*.js` files. Checking: `grep -r "service_role" .output/public/` after a production build.

**Prevention:**
- Keep `supabaseServiceRoleKey` under `runtimeConfig` (non-public, never `runtimeConfig.public`)
- Add a post-build check in CI: `grep -r "service_role" .output/public/ && exit 1`
- Never add `supabase.server.ts` plugins in storefront that touch service-role key
- Review Coolify environment variable names — `NUXT_PUBLIC_` prefix exposes to client

**Phase:** Pre-launch security audit

---

### Pitfall 3: Tenant cache serving stale data after plan suspension

**What goes wrong:** The tenant LRU cache (`tenantCache.ts`) holds stable tenant data for 60 seconds. If a tenant is suspended mid-cycle (billing failure), orders can still come in for up to 60 seconds because the cached tenant passes the subscription check.

**Why it matters here:** The codebase already addresses this — `mergeFreshSubscription()` re-fetches `subscription.status` from DB on every cache-hit request. This is good. The risk is this logic being accidentally removed or circumvented by someone "optimizing" the tenant middleware, or the pattern not being followed when adding new suspension-related fields.

**Consequences:** Suspended tenants accept real orders. Business processes orders they have no obligation to fulfill (subscription lapsed). Potential legal/chargeback risk.

**Warning signs:** Orders appearing in admin for tenants with `subscription.status = 'suspended'`. Billing tests showing orders accepted after suspension event.

**Prevention:**
- Protect the `mergeFreshSubscription()` call with a comment explaining WHY it must stay
- Add E2E test: trigger suspension → immediately place order → assert HTTP 503
- Add unit test for `assertNotSuspended()` guard covering all `/api/*` paths including new endpoints added during launch-readiness phase
- When adding new Nitro endpoints, explicitly verify they are either: (a) in the whitelist, or (b) blocked by `assertNotSuspended`

**Phase:** Billing / suspension E2E tests

---

### Pitfall 4: Realtime channel leak — admin tabs accumulate dead subscriptions

**What goes wrong:** Each admin tab that opens and closes without proper `removeChannel()` cleanup leaves orphaned WebSocket subscriptions. With Supabase self-hosted, the connection pool is limited. At scale (multiple admins per tenant, multiple tabs), the channel count explodes. At 50+ concurrent subscriptions from one tenant's admin users, the Supabase Realtime server starts rejecting new connections.

**Why it happens:** `useRealtimeChannels.ts` registers 7+ channels (orders, table calls, kitchen queue, reservations, support, appointments, visits). If the channel composables don't call `removeChannel` in `onUnmounted` or if the Nuxt plugin lifecycle doesn't clean up, every page navigation accumulates connections.

**This codebase's exposure:** `useRealtimeList.ts` and `useRealtimeWatch.ts` are generic — they must call `supabase.removeChannel()` in their cleanup. If any feature's channel composable uses `onMounted` without a paired `onUnmounted` cleanup, or if the admin SPA hot-reloads reset the Pinia store but not the WebSocket subscriptions, channels pile up.

**Consequences:** New orders stop appearing on kitchen screen. Admin UI freezes on realtime data. Self-hosted Supabase Realtime process hits connection limits and crashes.

**Warning signs:** `supabase.getChannels().length` growing over time in browser DevTools. Kitchen screen stops updating after 30+ minutes of admin use.

**Prevention:**
- Audit every `supabase.channel(...)` call: ensure `removeChannel` is paired and called in `onUnmounted`
- Add a dev-mode channel counter: `console.warn('active channels:', supabase.getChannels().length)` on route change
- Unit test for `useRealtimeList` / `useRealtimeWatch`: verify channel is removed when composable is unmounted (using `@vue/test-utils`)
- Monitor channel count via Supabase Grafana dashboard post-launch

**Phase:** Observability setup + pre-launch audit

---

## Moderate Pitfalls

---

### Pitfall 5: Payment webhook not idempotent under retry storms

**What goes wrong:** YooKassa retries webhooks on 5xx responses (up to 24 hours). The current `payment-webhook` function correctly uses `processed_webhook_events` for idempotency, but the table has no TTL index. Over time (months of production), this table grows unboundedly and the idempotency check `SELECT ... WHERE event_id = ?` degrades.

**This codebase's exposure:** The TECHDEBT.md notes `processed_webhook_events` has no TTL. The webhook is also gated behind `YOOKASSA_INTEGRATION_ENABLED` (currently returning 410), so this is a pre-launch concern before the gate is opened.

**Consequences:** As the table grows to millions of rows, idempotency check latency spikes. Under a retry storm (payment provider retrying 1000 events), the function times out, returns 5xx, and YooKassa retries again — creating a feedback loop.

**Warning signs:** `processed_webhook_events` table growing past 100k rows. Function execution time approaching timeout limit.

**Prevention:**
- Add a `created_at` column and a scheduled Postgres job to delete events older than 90 days
- Add an index on `(event_id, created_at)` for fast lookups
- Before enabling `YOOKASSA_INTEGRATION_ENABLED`, run the cleanup migration
- Add Edge Function execution time monitoring in Sentry

**Phase:** Billing integration activation

---

### Pitfall 6: Sentry server-side errors not captured in Nitro

**What goes wrong:** `@sentry/nuxt` requires the Node process to be started with `--import ./.output/server/sentry.server.config.mjs`. Without this flag, server-side errors (Nitro API handler crashes, tenant middleware failures, DB query errors) go unreported. Only client-side errors reach Sentry.

**This codebase's exposure:** The `reportError()` from `@fastio/shared/observability` wraps Sentry throughout admin plugins and storefront server middleware. But if the Coolify `start command` is `node .output/server/index.mjs` without the `--import` flag, all server errors are silent.

**Consequences:** Production crashes in tenant middleware, orders API failures, DB errors — all invisible. Teams diagnose from customer complaints, not proactive alerts.

**Warning signs:** Sentry shows client-side errors only. Server `console.error` visible in Coolify logs but not in Sentry.

**Prevention:**
- Set Coolify start command to: `node --import ./.output/server/sentry.server.config.mjs .output/server/index.mjs`
- Also: set `sourceMapsUploadOptions` in `nuxt.config.ts` with Sentry auth token, org, and project — without this, Sentry stack traces are minified and unreadable
- Delete source maps after upload (security): `sourcemaps.filesToDeleteAfterUpload: ['.output/**/*.map']`
- Verify: trigger a deliberate server error in a test tenant, confirm it appears in Sentry with readable stack trace

**Phase:** Observability setup

---

### Pitfall 7: E2E tests using shared DB state without isolation

**What goes wrong:** The Playwright config uses `fullyParallel: false` and `workers: 1` because tests share DB state. This is correct but fragile — any test that mutates shared records (order status, customer profile) will cause subsequent tests to fail intermittently based on run order.

**This codebase's exposure:** `global-setup.mjs` does a cleanup+upsert for the test customer before all tests. If tests themselves create orders, reservations, or appointments and don't clean up after themselves, over time the test suite accumulates state that causes false failures.

**Consequences:** CI becomes unreliable ("red on Monday, green on retry"). Teams start ignoring test failures. Critical bugs ship.

**Warning signs:** Tests pass locally but fail in CI second run. Tests fail on specific order IDs that change. Need for `retries: 1` to mask flakiness.

**Prevention:**
- Every E2E test that creates a DB record must delete it in an `afterEach` or `afterAll` hook
- Use unique identifiers (timestamp-based) for test data to avoid conflicts
- For the critical order flow test: place order → verify it arrives → delete it via admin API, not DB
- Add a `globalTeardown` that verifies test DB is clean after the suite (count test orders, assert 0)
- Consider using Supabase's `begin`/`rollback` RPC pattern for read-heavy tests that don't need persistence

**Phase:** E2E test implementation

---

### Pitfall 8: Kitchen screen order alerting depends on browser tab being active

**What goes wrong:** Supabase Realtime WebSocket connections are throttled or paused by the browser when the tab is in the background (Chrome's tab throttling for background tabs). Kitchen staff who lock their screen or switch to another app will miss order notifications if relying solely on Realtime.

**Why this matters for SMB restaurants:** The kitchen screen is a locked-down tablet. Staff may interact with other apps. A missed order that sat for 10 minutes before someone noticed is a trust-destroying event for the first paying customer.

**Consequences:** Orders silently pile up. Kitchen misses the incoming order sound/alert. First customer experience is broken.

**Warning signs:** Occasional "we didn't see the order come in" reports from kitchen staff.

**Prevention:**
- Implement Web Push Notifications as a backup to Realtime for new orders (service worker-based, works even when tab is backgrounded)
- OR implement a polling fallback: if the Realtime channel status is `CLOSED`, fall back to polling `/api/orders` every 30s
- Add a connection status indicator on the kitchen screen: green = Realtime active, yellow = degraded (polling), red = offline
- The order alert sound should replay if the tab was hidden for >30s since the last check, not just on Realtime INSERT

**Phase:** Kitchen/orders reliability hardening

---

### Pitfall 9: Nitro memory growth under Coolify single-instance deployment

**What goes wrong:** Nuxt 3 SSR Nitro has documented memory growth patterns in production. On a single-instance VPS (the current Coolify setup on 109.71.242.205), memory grows gradually and the process is never restarted by default. After days of traffic, the Node process may OOM and crash silently, with Coolify restarting it (cold start latency for first user after restart).

**Why it happens:** Several sources: un-GC'd closures in Nitro plugins, LRU cache growing to `MAX_ENTRIES` (10,000 × ~5KB = ~50MB for tenant cache alone), Vite's dev HMR not being an issue in prod but other module-level singletons may accumulate.

**Consequences:** Periodic silent crashes. Users hit 502 during restart. Memory threshold alerts trigger at 3AM.

**Warning signs:** Coolify container memory usage chart shows sawtooth pattern (grows then drops on restart). Occasional 502 errors with no corresponding Sentry errors.

**Prevention:**
- Set memory limit on the Coolify container (e.g., 512MB) so OOM kills the process fast rather than slowly degrading it
- Configure Coolify health checks to restart the container if memory exceeds 80% of limit
- Monitor RSS memory via Prometheus/Grafana (`process_resident_memory_bytes` from Node.js default metrics)
- Add a `/api/health/memory` endpoint that returns current RSS for Coolify health probes
- Keep `MAX_ENTRIES = 10_000` in tenantCache — this is already bounded, which is good

**Phase:** Observability + production hardening

---

### Pitfall 10: Missing SEO metadata causing storefront pages to be invisible to Google

**What goes wrong:** SSR renders correct HTML but without proper `<title>`, `<meta name="description">`, OpenGraph tags, and canonical URLs, pages don't index. For SMB clients, discoverability via "кафе [название] меню" is a key value driver.

**This codebase's exposure:** The storefront is SSR but the current focus is on correctness, not SEO. Multi-tenant canonical URLs are non-trivial: `tenant-slug.fastio.ru/menu` and a custom domain `pizzaplace.ru/menu` are the same page, and Google may split link equity or mark one as duplicate without explicit canonicals.

**Consequences:** Restaurant's online ordering page doesn't appear in search results. SMB client sees no organic traffic. Churn risk if they expected SEO benefit.

**Warning signs:** Google Search Console shows pages not indexed. `curl https://tenant.fastio.ru/` shows `<title>` as app name, not tenant name. No OG image for social sharing.

**Prevention:**
- Every storefront page must set `useHead({ title, meta })` with tenant-specific data from the server-fetched tenant object
- Add canonical URLs: `<link rel="canonical" href="https://[custom_domain_or_default]/[path]">` using the tenant's preferred domain
- Implement `sitemap.xml` and `robots.txt` Nitro endpoints per tenant
- Use `nuxt-og-image` or equivalent for dynamic OG images (restaurant name + logo on the card)
- Validate: run PageSpeed Insights against a staging storefront and verify title/description in report

**Phase:** Storefront performance and SEO phase

---

### Pitfall 11: LCP regression from unoptimized hero images on storefront

**What goes wrong:** Restaurants upload high-resolution photos via the admin. These images are served from Supabase Storage without transformation. The storefront hero image (typically 1800px+ JPEG at 2-5MB) becomes the LCP element and destroys Core Web Vitals on mobile.

**This codebase's exposure:** There's a `proxy-image` Edge Function. If it's being used for image optimization/resizing in the storefront, this is addressed. If storefront just uses raw Supabase Storage URLs, it's not.

**Consequences:** LCP score of 8-12 seconds on mobile. Google demotes the storefront in mobile search. SMB client complains their site is slow.

**Warning signs:** Lighthouse audit shows `<img>` as LCP element with size >500KB. No `width`/`height` attributes causing CLS. No `loading="lazy"` on below-fold images.

**Prevention:**
- All storefront images should use `<NuxtImg>` from `@nuxt/image` with explicit `width`, `height`, and `format="webp"`
- Configure the image provider to point to either: (a) `proxy-image` Edge Function with resize params, or (b) Supabase Storage's built-in image transformation API (`/render/v1/storage/v1/object/...?width=800&quality=75`)
- LCP image (first visible dish/hero photo) must NOT have `loading="lazy"` — it should be preloaded or be the initial render
- Add `fetchpriority="high"` to the LCP image element

**Phase:** Storefront performance phase

---

## Minor Pitfalls

---

### Pitfall 12: SMB owner onboarding stops at "add your menu" without hand-holding

**What goes wrong:** Restaurant owners sign up, enter basic info, then stall at menu creation because: (a) they don't understand category hierarchy, (b) they photograph the wrong thing, or (c) they're overwhelmed by all settings (branches, hours, delivery zones, promo codes, all visible at once).

**Consequences:** Activation rate collapse. Trial-to-paid conversion fails because the owner never set up a working storefront.

**Warning signs:** Accounts created but menu empty after 48 hours. Help requests about "where do I add dishes."

**Prevention:**
- Implement a forced onboarding checklist for new tenants (can be driver.js — already in the stack)
- Sequence: tenant name → logo → at least one category → at least one dish → preview storefront link
- Gate the "go live" / storefront URL share until the minimum viable menu exists
- For the first paying customer: do a white-glove setup call, not just self-serve

**Phase:** First-customer launch preparation

---

### Pitfall 13: Custom domain SSL provisioning fails silently

**What goes wrong:** The `add-custom-domain` Edge Function validates the domain but Traefik/Coolify's cert provisioning (Let's Encrypt) is separate. If the DNS A record isn't pointing to the VPS yet, the cert challenge fails. Traefik retries for a limited period; after that, the domain stays without SSL. The tenant's custom domain shows a browser security warning.

**Consequences:** Restaurant's custom domain (`pizzaplace.ru`) shows "Not Secure." Customers don't trust it. SMB client blames the platform.

**Warning signs:** `add-custom-domain` function returns 200 but HTTPS doesn't work within an hour. Traefik logs show ACME challenge failures.

**Prevention:**
- In the `add-custom-domain` function, validate DNS resolution (A/CNAME record points to VPS IP) BEFORE accepting the domain
- Show a clear UI state: "Waiting for DNS propagation → SSL certificate being issued → Active" (3-step status)
- Add a backend job that polls cert status and updates `tenants.custom_domain_status` field
- Document the expected DNS setup with exact record values in the admin onboarding flow

**Phase:** Custom domain feature hardening

---

### Pitfall 14: Playwright tests in CI use dev server instead of production build

**What goes wrong:** The current config uses `reuseExistingServer: !process.env.CI`, so CI starts fresh servers with `pnpm dev:storefront` (dev mode). Dev mode uses Vite with HMR, different module resolution, and no production optimizations. Bugs that only appear in production builds (e.g., SSR hydration mismatches, source-map-related crashes, env var issues) are never caught by CI E2E.

**Consequences:** Tests pass in CI on dev build; production build has a hydration mismatch that breaks the checkout page. Only discovered after deploy.

**Warning signs:** Different behavior when running `pnpm build && node .output/server/index.mjs` vs `pnpm dev`.

**Prevention:**
- Change CI `webServer.command` to `pnpm build && node .output/server/index.mjs` (preview mode)
- This will slow CI but catch a class of bugs invisible in dev mode
- Alternative: keep dev for fast PR checks, add a nightly E2E run against production build
- Add `nuxt build` to the CI pipeline before E2E runs at minimum

**Phase:** E2E CI setup

---

### Pitfall 15: Pinia store hydration mismatch with setup stores in SSR

**What goes wrong:** Pinia setup stores (using the setup API with `ref`/`computed` returned directly) have known hydration issues in Nuxt SSR. Specifically, if a store only returns functions and not the underlying refs, the Vue hydration mismatch warning appears in production. With `@pinia/nuxt` 0.11.3 (current), setup stores that are populated server-side but use computed properties in templates can cause "Hydration node mismatch" warnings — which are silent in production but indicate the client re-rendered something the server already rendered differently.

**This codebase's exposure:** The admin is `ssr: false` so this doesn't affect admin. The storefront uses Pinia stores for cart, checkout, etc. Any storefront Pinia store that is populated during SSR (`useAsyncData`) and then accessed in templates via computed properties is at risk.

**Warning signs:** `[Vue warn]: Hydration node mismatch` in browser console on first page load. Cart showing 0 items on SSR render then flickering to correct count after hydration.

**Prevention:**
- Always return the raw `ref` alongside any computed in setup stores: `return { items, itemCount }` not just `{ itemCount }`
- Wrap client-only store access in `if (process.client)` for values that can't be SSR-populated
- Test storefront pages with `nuxt build` + `node .output/server/index.mjs` and check browser console for hydration warnings

**Phase:** Storefront correctness audit

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| E2E test implementation | Tests share DB state, become flaky over time | Global setup + per-test teardown for created records |
| E2E test CI | Tests run against dev build, miss production hydration bugs | Use preview build in CI for E2E |
| Observability setup | Sentry misses all Nitro server errors without `--import` flag | Set correct Coolify start command |
| Observability setup | Self-hosted Supabase has no built-in dashboards | Set up Grafana + supabase-grafana for DB metrics |
| Billing integration (YooKassa activation) | `processed_webhook_events` table grows unboundedly | Add TTL cleanup before enabling `YOOKASSA_INTEGRATION_ENABLED` |
| Storefront performance | Hero images at full resolution destroy LCP | Use `@nuxt/image` with `proxy-image` or Supabase Storage transforms |
| Storefront SEO | Missing per-tenant `<title>`, canonical, OG tags | Add `useHead()` in all storefront pages with server-fetched tenant data |
| Kitchen/orders reliability | Realtime pauses when browser tab backgrounded | Add Web Push or polling fallback for order notifications |
| First customer launch | Owner stuck at menu setup, never activates | White-glove onboarding + forced checklist flow |
| Custom domain feature | SSL cert fails silently after domain added | DNS validation + async cert status tracking |
| Production hardening | Nitro memory grows on single-instance VPS | Set container memory limits + RSS monitoring |
| Any new Nitro endpoint | Endpoint bypasses `assertNotSuspended` for suspended tenants | Verify every new `/api/*` endpoint is in the suspension whitelist or blocked |
| Security audit | service-role key accidentally exposed in client bundle | CI post-build check: `grep service_role .output/public/` |

---

## Sources

- [Supabase Realtime Limits](https://supabase.com/docs/guides/realtime/limits)
- [Stop Using ref() in Nuxt SSR — Cross-Request State Pollution](https://masteringnuxt.com/blog/stop-using-ref-in-nuxt-why-usestate-is-critical-for-ssr)
- [Scaling E2E Tests for Multi-Tenant SaaS with Playwright](https://medium.com/cyberark-engineering/scaling-e2e-tests-for-multi-tenant-saas-with-playwright-c85f50e6c2ae)
- [Sentry for Nuxt — Server-Side Setup](https://docs.sentry.io/platforms/javascript/guides/nuxt/)
- [Supabase Service Role Key Security](https://securie.ai/guides/supabase-service-role-key)
- [Self-Hosting Supabase — Missing Features](https://www.supascale.app/blog/what-features-are-missing-in-selfhosted-supabase)
- [Playwright Authentication Pitfalls](https://playwright.dev/docs/auth)
- [Nuxt 3 Nitro Memory Leak Discussion](https://github.com/nuxt/nuxt/discussions/23553)
- [Supabase Realtime Memory Leak](https://drdroid.io/stack-diagnosis/supabase-realtime-client-side-memory-leak)
- [Optimizing Nuxt SSR for Core Web Vitals](https://www.debugbear.com/blog/nuxt-ssr-performance)
- [Building Reliable Stripe/YooKassa Webhook Handling](https://dev.to/aniefon_umanah_ac5f21311c/building-reliable-stripe-subscriptions-in-nestjs-webhook-idempotency-and-optimistic-locking-3o91)
- [Pinia SSR Hydration Issues](https://github.com/vuejs/pinia/discussions/2441)
- [SaaS Onboarding Mistakes](https://www.whatastory.agency/blog/saas-onboarding-mistakes)
