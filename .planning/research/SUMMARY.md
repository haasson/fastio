# Research Summary: Fastio Launch Readiness

**Synthesized:** 2026-05-21
**Research files:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md
**Project:** Fastio SaaS — Production Launch Milestone

---

## Executive Summary

Fastio is a feature-complete multi-tenant SaaS platform (Nuxt 3 SSR storefront + SPA admin, Supabase backend) that requires a production hardening pass before the first paying customer goes live. The codebase is architecturally sound — SSR storefront with server-side tenant isolation, RLS on the admin path, Playwright E2E infrastructure already in place, WAL-G backups with PITR operational. The launch readiness milestone is not about building features: it is about closing the gap between "works in development" and "safe to run with real customer money."

The recommended approach is a five-phase sequential execution: security foundation first (because observability is meaningless if the tenant isolation has holes), then observability (so failures are visible), then E2E tests against a stable staging environment, then storefront performance and SEO (so the first customer's customers can find and load the storefront), and finally operational features (transactional email, print-friendly views, basic analytics) that make the first week of real orders manageable. This ordering is driven by dependency: you cannot diagnose E2E failures without error monitoring, and you cannot tune performance without a CI measurement baseline.

The key risks are concentrated in two areas: security (service-role key leakage, RLS gaps, tenant isolation in Nitro middleware) and reliability (Realtime channel leaks, Nitro memory growth on a single VPS, E2E test state pollution making CI unreliable). Both are preventable with targeted audits and defensive code patterns — no architectural rewrites required.

---

## Key Findings

### From STACK.md

| Technology | Role | Rationale |
|------------|------|-----------|
| `@playwright/test` 1.60 | E2E testing | Already installed; standalone runner correct — do not couple to `@nuxt/test-utils` |
| `@sentry/nuxt` + GlitchTip | Error monitoring | GlitchTip is Sentry API-compatible, runs in 512MB RAM vs 32GB for self-hosted Sentry |
| Uptime Kuma v2.1 | Uptime alerting | Self-hosted, 20s check intervals, 95+ notification channels, deployable on Coolify |
| Grafana + Loki + Prometheus | Observability | Only viable self-hosted log/metrics stack on single VPS (Loki ~256MB vs ELK 4-8GB) |
| `@lhci/cli` 0.15.x | CWV lab testing | Pin to 0.15.x — Lighthouse 13 requires Node 22.19+ which LHCI does not yet support |
| `@nuxtjs/web-vitals` | CWV field data | Real user monitoring from actual devices, complements lab Lighthouse data |
| `@nuxtjs/seo` 5.1.3 | SEO meta-package | `nuxt-site-config` has first-class multi-tenancy support impossible to replicate with bare `useSeoMeta` |
| `pino` + `pino-loki` | Structured logging | Structured JSON request logs from Nitro shipped to Loki |

**Critical version constraint:** Do NOT upgrade LHCI past 0.15.x until LHCI officially supports Lighthouse 13.

**Self-hosted constraint:** Everything must run on Coolify (single VPS). All tooling selections reflect this — no managed SaaS dependencies at launch.

### From FEATURES.md

**Must ship before first paid customer (table stakes):**

1. **Transactional email** — order/appointment confirmations to customers, failsafe owner alert. 75%+ of orders happen on mobile; customers close the tab; without email they file support tickets.
2. **Error monitoring in production** — GlitchTip DSN must be configured. Production bugs are invisible without this.
3. **Legal pages** — Privacy Policy + Terms of Service. Required for billing. YooKassa requires ToS.
4. **SEO metadata + OG tags** — WhatsApp/Telegram link previews are the primary sharing mechanism in CIS. Blank preview signals a broken product to the venue owner.
5. **Core Web Vitals audit + targeted fixes** — not perfection, baseline competence. LCP < 2.5s, CLS < 0.1.
6. **Uptime monitoring** — 1 hour of setup, Uptime Kuma on Coolify.

**Ship in first sprint after launch (week 1-2):**

7. **Basic sales analytics** — revenue, order count, top items. Owners ask on day 2.
8. **Order status page** — unique token per order, Realtime updates. Reduces "where is my order" calls 30-50%.
9. **Print-friendly order view** — CSS `@media print` + `window.print()`. Kitchen staff cannot stare at screens.

**Defer to month 1+ (differentiators, valuable but not blocking):**

- Telegram order notifications (Telegram Edge Function infrastructure already exists)
- QR code generation for tables (2-hour feature, high demo value)
- Onboarding wizard (after first 5 customers reveal where they get stuck)

**Deliberately skip for v2:** Native mobile apps, loyalty program, POS/fiscal integration, full BI/custom report builder.

### From ARCHITECTURE.md

**Architecture is correct; hardening is additive.** Storefront never calls Supabase from the client — all reads go through Nitro. Shared-schema multi-tenancy with RLS on admin path and application-level enforcement on storefront path is the Supabase-recommended pattern.

**Key actions required for production:**

1. **Env separation:** Two Supabase projects (staging vs production) — sharing a DB creates cross-contamination risk.
2. **Nitro start command:** `node --import ./.output/server/sentry.server.config.mjs .output/server/index.mjs` — without `--import`, Sentry captures zero server-side errors.
3. **Cache poisoning prevention:** CDN must set `Vary: Host` on all SWR routes — without this, tenant-A menu can be served to tenant-B users.
4. **Supavisor connection pooler:** Port 6543 (transaction mode) for Nitro → Supabase; not direct Postgres port 5432.
5. **RLS audit:** Find tables with RLS disabled; optimize policies using `(SELECT auth.uid())` pattern (cached per-statement, not per-row).
6. **`getTenantDb` defensive throw:** If `event.context.tenant` is undefined, throw 503 rather than falling through to unscoped service-role queries.

**E2E critical flows (P0):** customer order flow, customer appointment flow, owner order management. **P1:** menu propagation, staff invite, kitchen screen Realtime. **Security spec:** cross-tenant data isolation.

### From PITFALLS.md

| # | Pitfall | Severity | Prevention |
|---|---------|----------|------------|
| 1 | SSR cross-request state pollution (`ref()` at module level in composables) | CRITICAL | All SSR-shared state must use `useState()` with unique key |
| 2 | Service-role key in browser bundle | CRITICAL | Post-build CI check: `grep -r "service_role" .output/public/ && exit 1` |
| 3 | Realtime channel leak — orphaned WebSocket subscriptions accumulate | HIGH | Audit every `supabase.channel()` call; ensure `removeChannel()` in `onUnmounted` |
| 4 | Sentry `--import` flag missing → zero server-side error capture | HIGH | Set correct Coolify start command before any production traffic |
| 5 | E2E tests share DB state → flaky CI → ignored failures | HIGH | Per-test teardown for created records; `globalTeardown` verifies DB is clean |

**Additional phase-specific pitfalls:**

- Tenant cache serving suspended tenants: `mergeFreshSubscription()` re-fetch must not be removed — add comment + E2E test for suspension gate.
- Webhook idempotency table without TTL: add cleanup migration before enabling `YOOKASSA_INTEGRATION_ENABLED`.
- Hero images at full resolution: use `<NuxtImg>` with explicit dimensions; LCP image must have `fetchpriority="high"` and no `loading="lazy"`.
- E2E running against dev build in CI: change `webServer.command` to preview build to catch SSR hydration mismatches.
- Kitchen screen Realtime pauses when tab backgrounded: add polling fallback or Web Push.
- Nitro memory growth on single VPS: set container memory limit in Coolify; monitor RSS via Prometheus.

---

## Implications for Roadmap

### Recommended Phase Structure (5 phases)

**Phase 1 — Security Foundation**
*Do first. Security before observability — if tenant isolation has holes, no other work matters.*

- RLS policy audit (tables without RLS; RLS performance optimization with `(SELECT auth.uid())`)
- Env var audit (service-role key not in `runtimeConfig.public`, not in client files)
- Post-build CI check: `grep service_role .output/public/`
- Security headers audit (`0-security-headers.ts`: CSP, HSTS, X-Frame-Options)
- `getTenantDb` defensive throw if tenant is undefined → 503
- Staging/production environment separation (two Supabase projects in Coolify)
- Cross-tenant security E2E spec

*Research flag: Standard patterns. No deep research needed during planning.*

---

**Phase 2 — Observability Setup**
*Depends on Phase 1. Cannot debug what you cannot see; must be operational before E2E tests surface issues.*

- GlitchTip deployment on Coolify
- `@sentry/nuxt` setup (client + server config, source maps upload, `--import` flag in start command)
- Tenant context enrichment in Sentry scope (`tenant_id`, `tenant_slug` tags)
- Uptime Kuma on Coolify (storefront, admin, Supabase health)
- Grafana + Loki + Prometheus deployment
- Structured request logs via `pino-http` → `pino-loki`
- Memory monitoring: `/api/health/memory` + Coolify container memory limits

*Research flag: Coolify service deployment details for GlitchTip and Uptime Kuma may benefit from a brief research pass during planning.*

---

**Phase 3 — E2E Test Infrastructure**
*Depends on Phases 1-2. E2E tests are only trustworthy with stable staging and visible errors.*

- Playwright POM structure (`tests/e2e/pages/`, `tests/e2e/fixtures/`)
- Per-worker auth fixtures (storageState via API auth, not UI login)
- Playwright project config: `storefront-tenant-a` + `admin-owner` projects
- Dedicated E2E Supabase project
- Critical flow specs: order (P0), appointment (P0), owner management (P0)
- P1 specs: menu propagation, staff invite, kitchen screen Realtime
- Cross-tenant security spec
- CI: `webServer.command` → preview build (not dev)
- Realtime channel audit (`removeChannel` paired with every `supabase.channel()`)
- `globalTeardown` to verify test DB is clean

*Research flag: No deep research needed. ARCHITECTURE.md has concrete code examples.*

---

**Phase 4 — Storefront Performance and SEO**
*Depends on Phase 2 (observability provides measurement baseline).*

- `@nuxtjs/seo` 5.1.3 (storefront only)
- Per-page `useSeoMeta()` with tenant-specific data from SSR context
- Canonical URLs via `nuxt-site-config` per-tenant hostname
- Structured data: `LocalBusiness` / `Restaurant` / `Menu` JSON-LD
- `sitemap.xml` and `robots.txt` Nitro endpoints per tenant
- `routeRules` SWR config (menu pages: `swr: 60`, checkout/orders: `no-store`)
- `Vary: Host` header on all SWR-cached routes
- `@lhci/cli` 0.15.x in CI pipeline (against staging preview build)
- `@nuxtjs/web-vitals` for real user monitoring
- `<NuxtImg>` with explicit dimensions + WebP; `fetchpriority="high"` on LCP image
- Supavisor connection pooler migration (port 6543)
- Pinia setup store SSR hydration audit

*Research flag: `@nuxtjs/seo` multi-tenancy implementation (multi-sitemap, per-tenant site config) may benefit from a focused research pass during planning.*

---

**Phase 5 — Operational Features**
*Can begin in parallel with Phase 3-4 for items with no storefront dependencies.*

- Legal pages (Privacy Policy + ToS) — static pages linked from storefront footer and admin onboarding
- Transactional email: Resend + Edge Function trigger on `orders` INSERT (customer confirmation + owner alert)
- Customer order status page (unique token, Realtime, no auth)
- Print-friendly order view (CSS `@media print`)
- Basic sales analytics (revenue, order count, top items — PostgreSQL aggregate queries)
- Webhook idempotency TTL cleanup migration (before enabling YooKassa)
- Kitchen screen: polling fallback for backgrounded-tab Realtime gaps
- Forced post-registration onboarding checklist

*Research flag: Resend + Supabase Edge Functions is well-documented. Standard patterns throughout.*

---

### Feature Priority Matrix

| Feature | Phase | Blocker for Launch? |
|---------|-------|---------------------|
| RLS audit + env var audit | 1 | YES — security |
| Service-role key CI check | 1 | YES — security |
| GlitchTip + Sentry + source maps | 2 | YES — blind production |
| Uptime Kuma | 2 | YES — downtime invisible |
| E2E critical flows | 3 | YES — regressions undetected |
| SEO metadata + OG tags | 4 | YES — blank social previews |
| Core Web Vitals audit + image opt | 4 | YES — mobile UX |
| Legal pages | 5 | YES — billing requires ToS |
| Transactional email | 5 | YES — customer expectation |
| Sales analytics | 5 | Strong expectation, week 1 |
| Order status page | 5 | Strong expectation, week 1 |
| Telegram notifications | post-launch | Differentiator, month 1 |
| QR code generation | post-launch | Differentiator, month 1 |
| PWA | v2 | Valuable, not blocking |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack selection | HIGH | All tools stable, versions verified. Self-hosting constraint well-researched against Coolify docs. |
| Feature priorities | HIGH | Table stakes from restaurant SaaS benchmarks + Baymard UX research. |
| Architecture patterns | HIGH | Pitfalls verified against actual codebase (specific file names, middleware paths, composable names). |
| Pitfall prevention | HIGH | All critical pitfalls are codebase-specific with concrete mitigations. |
| Phase ordering | HIGH | Dependencies explicit and justified. Security → observability → testing → performance → operations is universally correct for production hardening. |
| CIS market specifics | MEDIUM | Telegram-as-primary-tool claim supported by Restik feature set, not primary market research. |
| PWA conversion numbers | MEDIUM | Starbucks case study real; specific conversion improvement claims vary by source. |

**Gaps to address during planning:**

1. **RLS coverage:** Actual count of tables without RLS policies unknown — needs a migration audit query before Phase 1 scope is final.
2. **`proxy-image` Edge Function usage:** Whether storefront currently uses it for image optimization or passes raw Supabase Storage URLs is unconfirmed — determines Phase 4 image work scope.
3. **`processed_webhook_events` TTL:** Confirmed as TECHDEBT; specific cleanup migration not yet written — needs scoping into Phase 5.
4. **Telegram Edge Function readiness:** Function exists; current state (functional vs stub) unconfirmed — determines Phase 5 Telegram effort.
5. **Resend account availability:** FEATURES.md recommends Resend (Supabase partnership); confirm API key availability before Phase 5 planning.

---

## Sources (Aggregated)

**High confidence:** Playwright docs (POM, auth patterns), Sentry for Nuxt official docs, GlitchTip on Coolify official docs, `@nuxtjs/seo` 5.1.3 + nuxtseo.com announcement, Nuxt SEO multi-tenancy docs, Supabase RLS performance docs (official), Uptime Kuma v2.1 release, GDPR official text, Baymard Institute food delivery UX research.

**Medium confidence:** GlitchTip vs Sentry comparison (2026-03, third-party), Grafana + Loki self-hosted guide, `pino-loki` GitHub, `@nuxtjs/web-vitals` module, LHCI 0.15.x guide, Nuxt 3 Nitro memory discussions (GitHub), Pinia SSR hydration issues (GitHub), CIS Telegram claim (inferred from Restik feature set).

---

*Research synthesis complete. Ready for roadmap planning.*
