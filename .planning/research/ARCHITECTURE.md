# Architecture Patterns: Production Readiness

**Domain:** Nuxt 3 + Supabase multi-tenant SaaS (FastFood vertical)
**Researched:** 2026-05-20
**Scope:** Production hardening for a feature-complete system

---

## System Overview (Current State)

The codebase has a clearly defined three-tier topology:

```
Browser
  ├── apps/admin  (Nuxt 3 SPA, SSR off, anon key + RLS)
  └── apps/storefront  (Nuxt 3 SSR, Nitro server layer)
         └── server/api/* → service-role key → Supabase
                └── server/middleware/tenant.ts (host → Tenant, LRU cache)

Supabase
  ├── PostgreSQL (RLS enforced, 301+ migrations)
  ├── Auth (GoTrue, JWT)
  ├── Realtime (orders channel)
  ├── Storage (images via proxy-image function)
  └── Edge Functions (Deno): payment-webhook, invite-member, etc.
```

**Key constraint already in place:** Storefront never calls Supabase directly from client — all reads go through Nitro (`server/api/*.ts`). This is the correct architecture for production; hardening builds on top of it.

---

## Component Boundaries (Production View)

| Component | Responsibility | Security boundary | Production concern |
|-----------|---------------|-------------------|--------------------|
| `apps/admin` | Tenant management SPA | anon key + RLS via user JWT | Session expiry handling, RLS coverage audit |
| `apps/storefront/server` | Nitro SSR + API proxy | service-role key (server-only env var) | Tenant header spoofing, cache poisoning, key leakage |
| `apps/storefront/client` | Vue hydration, cart, checkout | No Supabase access (intentional) | Client-side state divergence after SSR |
| `supabase/migrations` | Schema + RLS policies | Postgres enforced | Policy correctness, index coverage on tenant_id |
| `supabase/functions` | Webhooks, invites, payment | service-role key in Deno env | Webhook signature verification, idempotency |
| Coolify | Container orchestration | Network isolation | Env var separation staging vs prod, secret rotation |
| CDN / reverse proxy | Static assets, TLS termination | Host header trust | Cache-Control headers, SWR for storefront pages |

---

## Deployment Architecture

### Environment Separation (Coolify)

Two isolated Coolify environments are required: **staging** and **production**.

```
Coolify (self-hosted)
  ├── staging environment
  │   ├── apps/storefront  (staging Supabase project)
  │   ├── apps/admin       (staging Supabase project)
  │   └── .env.staging     (separate DB URL, anon/service keys)
  └── production environment
      ├── apps/storefront  (prod Supabase project)
      ├── apps/admin       (prod Supabase project)
      └── .env.production  (prod credentials, never in Git)
```

**Critical:** Staging must connect to a separate Supabase project, not the same DB with a different schema. Sharing a DB between environments with tenant data creates cross-contamination risk.

Coolify supports per-environment variable groups. Build-time variables (NUXT_PUBLIC_*) and runtime variables (SUPABASE_SERVICE_ROLE_KEY) must be scoped separately. The service role key must exist only as a runtime env var — never baked into the Docker image.

### Nitro Server Start Command

Per Coolify docs, the correct start command for Nuxt 3 with Sentry server instrumentation:

```bash
node --import ./.output/server/sentry.server.config.mjs .output/server/index.mjs
```

Without the `--import` flag, Sentry server-side instrumentation does not load and Nitro errors are not captured.

### CDN / Caching Strategy

Nuxt 3 `routeRules` in `nuxt.config.ts` controls per-route rendering and cache headers. For this storefront (multi-tenant, content changes at menu-update frequency):

```typescript
// nuxt.config.ts (storefront)
routeRules: {
  // Public menu pages — SWR with short TTL, safe to cache at CDN
  '/': { swr: 60 },              // revalidate every 60s
  '/menu': { swr: 60 },
  '/category/**': { swr: 60 },

  // Order/checkout — never cache (user-specific, POST-heavy)
  '/checkout': { ssr: true, headers: { 'cache-control': 'no-store' } },
  '/orders/**': { ssr: true, headers: { 'cache-control': 'no-store' } },

  // Static-ish pages (about, contact)
  '/about': { swr: 3600 },

  // API routes — explicit no-cache on mutation endpoints
  '/api/orders': { headers: { 'cache-control': 'no-store' } },
}
```

**Cache poisoning risk:** Because the storefront is multi-tenant (one Nitro instance, many tenants resolved by host header), the CDN must vary cache by `Host`. Without this, tenant A's menu could be served to tenant B. Set `Vary: Host` on all SWR-cached routes, or use tenant-aware cache keys at the CDN layer.

---

## Database Resilience

### Connection Pooling

Supabase Nitro server endpoints use the service-role client. In a serverless/multi-worker Nitro deployment, each worker maintains its own connection pool. Use **Supavisor** (Supabase's native pooler, port 6543) instead of the direct Postgres port (5432) for Nitro server connections.

```
# .env (production)
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

Supavisor supports transaction-mode pooling appropriate for short-lived Nitro request handlers. Session-mode is not suitable here.

### Backup Strategy

The codebase already has WAL-G continuous archiving and PITR (migrations 64cacf67 and f68cb372 from git history). For the production readiness phase:

- Daily backup verification via restore test (already implemented per commit history)
- Point-in-time recovery tested against staging before a production incident
- RTO/RPO documented: target RTO < 2h, RPO < 15min (WAL streaming achieves this)

### Migration Safety

With 301+ migrations, the production readiness phase must enforce:

1. Never run `supabase db reset` in production (already documented in CLAUDE.md)
2. Migrations run individually: `docker exec ... psql -f <migration>`
3. All new migrations must be backward-compatible (additive only: new columns nullable, new tables, no renames without aliases)
4. Test each migration on staging before applying to production

---

## Multi-Tenancy Security Boundaries

### Tenant Isolation Model

This app uses **shared-schema multi-tenancy** (single PostgreSQL instance, `tenant_id` column on every table). This is the Supabase-recommended pattern. The security boundary is enforced at two levels:

**Level 1 — Admin (browser → Supabase direct):**
- User authenticates via Supabase Auth → receives JWT with `sub` = user UUID
- RLS policies on every table check `auth.uid()` via membership table
- The admin never uses the service-role key; anon key + user JWT is the only credential in browser

**Level 2 — Storefront (Nitro server → Supabase via service-role):**
- Service-role key bypasses RLS — this is intentional for read performance
- Tenant isolation is enforced by the application: `getTenantDb(event)` builds a scoped query set that always filters by `event.context.tenant.id`
- **Risk:** If `event.context.tenant` is not set (middleware bug), service-role queries return unscoped data. Mitigation: hard-throw in `getTenantDb` if `tenant` is undefined, return 503 rather than unscoped data

### RLS Policy Audit Checklist

Before production, every table with tenant-scoped data must be verified:

```sql
-- Tables with RLS disabled (dangerous)
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename NOT IN (
  SELECT DISTINCT tablename FROM pg_policies
  WHERE schemaname = 'public'
);

-- Policies without indexes on filtering columns
-- Run EXPLAIN ANALYZE on representative queries per table
```

**Performance pattern:** All RLS policies using `auth.uid()` should use the cached form:

```sql
-- Slow (evaluates per-row):
CREATE POLICY "tenant_isolation" ON dishes
  USING (tenant_id IN (
    SELECT tenant_id FROM memberships WHERE user_id = auth.uid()
  ));

-- Fast (cached per-statement via initPlan):
CREATE POLICY "tenant_isolation" ON dishes
  USING (tenant_id IN (
    SELECT tenant_id FROM memberships WHERE user_id = (SELECT auth.uid())
  ));
```

Index requirements: B-tree index on `(tenant_id)` for every table, B-tree index on `memberships(user_id)` for the lookup.

### Custom Domain / Subdomain Tenant Resolution

The storefront resolves tenant from `Host` header in `server/middleware/tenant.ts`. Production hardening:

1. **Validate that Host is one of:** known subdomains (`*.fastio.ru`) OR stored custom domains in DB
2. **Rate-limit resolution:** unknown hosts that generate cache misses could be used for DoS; log and 404 fast
3. **Cache invalidation:** when a tenant changes their custom domain, the LRU cache must be invalidated. Implement a cache-bust endpoint or TTL-based expiry (currently LRU — verify TTL is set)
4. **Subscription re-check:** current architecture re-fetches subscription status fresh (per codebase comment). Confirm this does not create N+1 on high-traffic tenants

---

## Observability Stack

### Three Signal Types Required

| Signal | Tool | Where | What to capture |
|--------|------|--------|-----------------|
| Errors | Sentry (`@sentry/nuxt`) | Client + Nitro server | Unhandled exceptions, promise rejections, Nitro 5xx |
| Performance | Sentry Performance / OTel | Nitro server | Slow API routes, DB query latency, tenant resolution time |
| Uptime / SLO | External uptime monitor | Per-tenant domain + admin | Availability from outside (HTTP check every 1-5min) |

### Sentry Integration Architecture

`@sentry/nuxt` wraps `@sentry/vue` on client and `@sentry/node` on server. It auto-instruments Nitro via OpenTelemetry under the hood.

**Client (`sentry.client.config.ts`):**
```typescript
import * as Sentry from '@sentry/nuxt'
Sentry.init({
  dsn: useRuntimeConfig().public.sentryDsn,
  environment: useRuntimeConfig().public.environment, // 'staging' | 'production'
  tracesSampleRate: 0.1,  // 10% in production — tune down if volume high
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 0.5,
  integrations: [Sentry.replayIntegration()],
})
```

**Server (`sentry.server.config.ts`):**
```typescript
import * as Sentry from '@sentry/nuxt'
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.05,  // lower on server — high volume Nitro routes
})
```

**Source maps:** Must be uploaded during CI build. Add `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` to Coolify environment. Source maps are auto-uploaded by `@sentry/nuxt` vite plugin — do not commit `.sourcemap` files.

**Tenant context enrichment:** In Nitro middleware, after tenant resolution:
```typescript
Sentry.setTag('tenant_id', event.context.tenant?.id)
Sentry.setTag('tenant_slug', event.context.tenant?.slug)
```
This makes all Sentry issues filterable by tenant — critical for production debugging.

### Performance Budgets (Core Web Vitals)

For the SSR storefront (public menu pages), production targets:

| Metric | Target | Failing threshold |
|--------|--------|------------------|
| LCP | < 2.5s | > 4.0s |
| CLS | < 0.1 | > 0.25 |
| FID/INP | < 200ms | > 500ms |
| TTFB | < 800ms | > 1800ms |

Nuxt 3 SSR with SWR caching should hit these targets. Run Lighthouse CI in the build pipeline against staging after each deployment.

---

## E2E Test Architecture

### What to Test (Critical Flows Only)

Per PROJECT.md: "E2E для критических флоу достаточно для запуска." The critical flows are:

| Flow | App | Tenant context | Priority |
|------|-----|---------------|----------|
| Customer: view menu → add to cart → checkout | storefront | tenant-A host | P0 |
| Customer: create appointment (services vertical) | storefront | tenant-B host | P0 |
| Owner: receive order → change status → close | admin + storefront | same tenant | P0 |
| Owner: add menu item → appears on storefront | admin + storefront | same tenant | P1 |
| Staff invite: owner invites → staff logs in | admin | same tenant | P1 |
| Kitchen screen: order appears in realtime | admin kitchen page | same tenant | P1 |
| Subscription gate: feature blocked on free plan | admin | free-tier tenant | P2 |

### Playwright Project Structure for Tenant Isolation

```
tests/
  e2e/
    fixtures/
      auth.ts           # storageState per-worker, one state per role
      tenant.ts         # tenant context fixture (baseURL + headers)
    flows/
      order-flow.spec.ts
      appointment-flow.spec.ts
      kitchen-flow.spec.ts
      onboarding-flow.spec.ts
    playwright.config.ts
```

**playwright.config.ts — Project per tenant role:**
```typescript
projects: [
  {
    name: 'storefront-tenant-a',
    use: {
      baseURL: 'http://tenant-a.localhost:4711',
      storageState: 'playwright/.auth/customer-a.json',
    },
    testMatch: /storefront-\w+\.spec\.ts/,
  },
  {
    name: 'admin-owner',
    use: {
      baseURL: 'http://localhost:4710',
      storageState: 'playwright/.auth/owner.json',
    },
    testMatch: /admin-\w+\.spec\.ts/,
  },
]
```

### Auth Isolation: Per-Worker storageState

```typescript
// fixtures/auth.ts
export const test = base.extend<{ userPage: Page }, { workerStorageState: string }>({
  workerStorageState: [async ({ browser }, use, workerInfo) => {
    const stateFile = `playwright/.auth/worker-${workerInfo.parallelIndex}.json`
    
    // Re-use if exists (within this worker's run)
    if (existsSync(stateFile)) {
      await use(stateFile)
      return
    }
    
    // Authenticate fresh: use API directly, not UI login
    const context = await browser.newContext()
    const { data } = await supabaseAdminClient.auth.signInWithPassword({
      email: `test-worker-${workerInfo.parallelIndex}@fastio.test`,
      password: process.env.TEST_USER_PASSWORD!,
    })
    await context.addCookies(sessionToCookies(data.session))
    await context.storageState({ path: stateFile })
    await context.close()
    await use(stateFile)
  }, { scope: 'worker' }],

  page: async ({ browser, workerStorageState }, use) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
})
```

**Critical:** Use a separate Supabase project (or schema) for E2E tests, never against the production DB. Each E2E run should either:
- Use pre-seeded test tenants with known data (deterministic assertions)
- Or create tenant + teardown in `beforeAll`/`afterAll` via Supabase admin API

### Cross-Tenant Isolation Test (Security-Critical)

A dedicated spec must verify the tenant boundary:

```typescript
// security/cross-tenant.spec.ts
test('tenant A cannot access tenant B orders via API', async ({ request }) => {
  // Authenticate as tenant-A customer
  const tokenA = await getCustomerToken('tenant-a')
  
  // Attempt to fetch tenant-B orders directly
  const res = await request.get('/api/orders', {
    headers: {
      Authorization: `Bearer ${tokenA}`,
      Host: 'tenant-b.fastio.ru',  // spoof host
    },
  })
  
  // Must return empty array or 403, never tenant-B's data
  expect(res.status()).not.toBe(500)
  const body = await res.json()
  expect(body.orders ?? []).toHaveLength(0)
})
```

### Realtime Test Pattern

Testing Supabase Realtime (orders channel, kitchen screen) requires special handling:

```typescript
test('kitchen screen shows new order in realtime', async ({ page: kitchenPage, browser }) => {
  await kitchenPage.goto('/kitchen')
  
  // Open a separate context for the ordering customer
  const customerCtx = await browser.newContext({
    storageState: 'playwright/.auth/customer.json',
    baseURL: 'http://tenant-a.localhost:4711',
  })
  const customerPage = await customerCtx.newPage()
  
  // Customer places order
  await customerPage.goto('/checkout')
  await customerPage.click('[data-testid="submit-order"]')
  
  // Kitchen screen should show within 3s (Realtime latency budget)
  await expect(kitchenPage.locator('[data-testid="order-card"]').first())
    .toBeVisible({ timeout: 5000 })
  
  await customerCtx.close()
})
```

---

## Data Flow (Production Hardening View)

### Storefront Request Path (Hardened)

```
Client HTTP request
  → CDN (Vary: Host)
      → Cache HIT: return cached SSR HTML
      → Cache MISS:
          → Nitro server
              → security-headers middleware (CSP, HSTS, X-Frame-Options)
              → tenant middleware:
                  LRU cache hit → event.context.tenant set
                  LRU cache miss → DB query → tenant set → cache populated
                  tenant not found → 404 (no unscoped fallthrough)
              → API handler:
                  getTenantDb(event)  ← throws if tenant undefined
                  Supabase query with explicit tenant_id filter
                  ← JSON response
              ← SSR HTML rendered with tenant data
          ← HTTP response with SWR cache headers
      ← CDN stores response keyed by Host + path
  ← Browser receives HTML
```

### Admin Request Path (Hardened)

```
Browser (SPA)
  → Supabase Auth (JWT refresh on expiry — must handle 401 gracefully)
  → Supabase REST (anon key + JWT in Authorization header)
      → PostgreSQL + RLS:
          auth.uid() resolved from JWT
          RLS policy checks memberships table
          Row returned only if user belongs to tenant
  ← Data returned to composable

Realtime channel:
  → Supabase Realtime WebSocket
      → Channel filter: tenant_id = {tenantId} (server-side filter)
      ← Event pushed to client
  → useRealtimeList updates reactive array
```

### Edge Function Path (Hardened)

```
External webhook (Stripe, Telegram)
  → Supabase Edge Function
      → Verify webhook signature (STRIPE_WEBHOOK_SECRET)
      → Idempotency check: processed_webhook_events table
          Event already processed → return 200 (no duplicate)
      → Process event (update subscription, send notification)
      → Insert into processed_webhook_events (with TTL — see TECHDEBT)
  ← 200 OK
```

---

## Build Order Implications

The production readiness work has natural dependency ordering:

**Phase 1 — Security foundation (no dependencies, do first):**
- RLS policy audit + index verification
- Env var audit (no secrets in Git, no service-role key on client)
- Security headers audit (`server/middleware/0-security-headers.ts` — verify CSP, HSTS)
- Tenant boundary hardening (`getTenantDb` defensive throw)

**Phase 2 — Observability (depends on Phase 1 infra being stable):**
- Sentry integration (client + server config, source maps upload in CI)
- Tenant context enrichment in Sentry scope
- Uptime monitoring setup per production tenant domain

**Phase 3 — E2E test infrastructure (depends on staging environment from Phase 1):**
- Playwright setup with per-worker auth fixtures
- Test tenant seeding (separate Supabase project)
- Critical flow specs: order, appointment, kitchen, onboarding
- Cross-tenant security spec

**Phase 4 — Performance (depends on observability from Phase 2 to measure):**
- `routeRules` SWR configuration for storefront
- Core Web Vitals baseline measurement
- Lighthouse CI in pipeline
- LRU cache TTL tuning for tenant resolution

**Phase 5 — Resilience (can run in parallel with Phase 3-4):**
- Supavisor pooler migration (staging first, then prod)
- Processed webhook events TTL (TECHDEBT item)
- Staging → production migration runbook validation

---

## Anti-Patterns for Production Readiness Phase

### CDN Cache Without Host Vary Header
**What happens:** Multi-tenant storefront caches menu pages without `Vary: Host`. CDN returns tenant-A's menu to tenant-B users.
**Prevention:** Set `Vary: Host` header on all SWR/ISR routes at the CDN config level.

### Service-Role Key in Client Bundle
**What happens:** Nitro environment variable accidentally accessed in client-side composable, bundled into hydration JS.
**Prevention:** All `process.env.SUPABASE_SERVICE_ROLE_KEY` references must be in `server/` directories only. Add a build-time check / ESLint rule for `SUPABASE_SERVICE_ROLE_KEY` in client-side files.

### Sentry Without `--import` Flag
**What happens:** Sentry `@sentry/nuxt` server config not loaded because Node process started without `--import` flag. Server errors (Nitro 5xx, DB failures) never appear in Sentry.
**Prevention:** Start command must be `node --import ./.output/server/sentry.server.config.mjs .output/server/index.mjs`.

### Shared DB Between Staging and Production
**What happens:** Staging migrations run against prod DB. Test data pollutes production.
**Prevention:** Two separate Supabase projects. Staging Supabase project URL must not appear in production Coolify environment.

### Playwright Tests Against Production DB
**What happens:** E2E tests create orders, users, tenants in production. Cleanup failures leave garbage data.
**Prevention:** Dedicated E2E Supabase project with seed data. CI env points to E2E project, never production.

### RLS Disabled on a Table
**What happens:** New migration adds a table without `ALTER TABLE x ENABLE ROW LEVEL SECURITY`. Any authenticated user can read all rows via the Supabase REST API using their anon key + JWT.
**Prevention:** Add a CI check (or migration linter) that asserts RLS is enabled on every public-schema table before applying migrations.

---

## Sources

- [Playwright Auth Docs — storageState pattern](https://playwright.dev/docs/auth)
- [Scaling E2E Tests for Multi-Tenant SaaS with Playwright — CyberArk Engineering](https://medium.com/cyberark-engineering/scaling-e2e-tests-for-multi-tenant-saas-with-playwright-c85f50e6c2ae)
- [Sentry for Nuxt — Nitro Server Features](https://docs.sentry.io/platforms/javascript/guides/nuxt/features/nitro-server-features/)
- [Sentry for Nuxt — Manual Setup (--import flag)](https://docs.sentry.io/platforms/javascript/guides/nuxt/manual-setup/)
- [Sentry for Nuxt — Source Maps](https://docs.sentry.io/platforms/javascript/guides/nuxt/sourcemaps/)
- [Supabase RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Supabase Row Level Security Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Secure Data Guide](https://supabase.com/docs/guides/database/secure-data)
- [RLS Multi-Tenant Deep Dive — DEV Community](https://dev.to/blackie360/-enforcing-row-level-security-in-supabase-a-deep-dive-into-lockins-multi-tenant-architecture-4hd2)
- [RLS Optimization — AntStack Medium](https://medium.com/@antstack/optimizing-rls-performance-with-supabase-postgres-fa4e2b6e196d)
- [Supavisor — Supabase Connection Pooler](https://supabase.com/blog/supavisor-postgres-connection-pooler)
- [Nuxt Rendering Modes & routeRules](https://nuxt.com/docs/guide/concepts/rendering)
- [Self-Host Nuxt on Coolify — Michael Hoffmann](https://mokkapps.de/blog/self-host-your-nuxt-app-with-coolify)
- [Coolify Environment Variables Docs](https://coolify.io/docs/knowledge-base/environment-variables)
- [Multi-Tenant Applications with Nuxt — Adam DeHaven](https://www.adamdehaven.com/articles/powering-multi-tenant-applications-with-nuxt)
- [OpenTelemetry with Nuxt 3 — Simform Engineering](https://medium.com/simform-engineering/leveraging-opentelemetry-with-nuxt-3-guide-to-application-observability-643157dffa86)
