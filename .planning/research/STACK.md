# Technology Stack: Launch Readiness

**Project:** Fastio SaaS — Launch Readiness Milestone
**Researched:** 2026-05-20
**Scope:** E2E testing, error monitoring, observability, Core Web Vitals, SEO for Nuxt 3 + Supabase + Vue 3

---

## Context

The existing stack already has Playwright 1.60 installed and a `playwright.config.ts` configured at the monorepo root. E2E tests live in `tests/e2e/` with a `global-setup.mjs` that handles tenant DB seeding. The config already handles multitenant subdomain routing (`e2e-retail.localhost:4711`), `workers: 1` to avoid shared-DB conflicts, and retries on CI. This is a solid foundation — the launch readiness milestone adds tooling around this core.

Production runs on Timeweb Cloud VPS (Coolify v4), self-hosted Supabase stack, Traefik reverse proxy. **No managed cloud services in scope** — all tooling must be self-hostable or have a meaningful free tier for a bootstrapped SaaS.

---

## Recommended Stack by Area

### 1. E2E Testing — Playwright (already installed)

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| `@playwright/test` | 1.60 (already installed) | E2E browser automation | HIGH |
| Page Object Model (POM) | n/a pattern | Test organization, reduce duplication | HIGH |
| `@nuxt/test-utils` | NOT recommended here | Overkill for standalone Playwright; adds Vitest runner coupling | MEDIUM |

**Why Playwright and not Cypress/Selenium:** Already installed, has first-class TypeScript support, runs in CI without display server, handles multitenant subdomain routing with custom `baseURL` per test (already configured). Nuxt officially supports Playwright for E2E.

**Why NOT `@nuxt/test-utils` Playwright integration:** The project uses standalone `@playwright/test` runner with a custom global-setup for DB seeding. `@nuxt/test-utils` wraps Playwright inside Vitest which forces a different runner model and would require rewriting the existing config. Keep standalone Playwright.

**POM rationale:** Current tests likely use inline selectors. POM pattern centralizes selectors in TypeScript classes — when a button label changes, one file changes, not 12 test files. TypeScript types catch locator typos at compile time.

**What to add:**
```
tests/e2e/
  pages/            # Page Object classes (e.g., CheckoutPage, AdminOrdersPage)
  fixtures/         # Custom Playwright fixtures (e.g., authenticated session)
  global-setup.mjs  # already exists
```

**Do NOT add:** Cypress (different runner, conflict), TestCafe (dead), Nightwatch (Vue-specific but inferior DX to Playwright).

---

### 2. Error Monitoring — GlitchTip (self-hosted, Sentry-compatible SDK)

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| `@sentry/nuxt` | ~9.x (latest stable) | Client + server error capture, SDK | HIGH |
| GlitchTip | 6.x (Feb 2026) | Self-hosted error tracking backend | HIGH |

**Why GlitchTip instead of Sentry self-hosted:** Sentry self-hosted requires 32+ GB RAM and runs Kafka + ClickHouse. GlitchTip runs in 512 MB RAM on the existing Coolify VPS. GlitchTip is Sentry API-compatible — the application code uses `@sentry/nuxt` SDK unchanged; you only swap the DSN URL to point at GlitchTip. GlitchTip 6 (released Feb 2026) added improved stacktraces.

**Why NOT Sentry cloud (managed):** Bootstrapped SaaS — avoid SaaS bills before revenue. GlitchTip is already deployable as a Coolify service (first-class in Coolify docs).

**Why NOT Highlight.io:** Good product but adds another SaaS dependency with session replay that isn't needed for launch. Adds payload/cost overhead.

**SDK setup for Nuxt 3:** `@sentry/nuxt` wraps `@sentry/node` on the server and `@sentry/vue` on the client. Creates `sentry.client.config.ts` and `sentry.server.config.ts`. Source maps are uploaded via Vite plugin at build time. Works with SSR (storefront) and SPA (admin) mode.

**What to configure:**
```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nuxt'
Sentry.init({
  dsn: process.env.SENTRY_DSN, // points to GlitchTip
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% for production — keep data volume low
  replaysSessionSampleRate: 0, // no session replay needed for launch
})
```

**Do NOT add:** Rollbar, Bugsnag (SaaS-only pricing), LogRocket (session replay bloat).

---

### 3. Uptime Monitoring — Uptime Kuma

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| Uptime Kuma | 2.1 (Feb 2026) | HTTP/HTTPS uptime checks, status page, alerts | HIGH |

**Why Uptime Kuma:** v2.0 (Oct 2025) + v2.1 (Feb 2026) added MariaDB support, rootless Docker, worldwide probes (Globalping), and refreshed UI. 20-second check intervals. 95+ notification channels (Telegram, Slack, email). Already deployable on Coolify. Free, self-hosted, no SaaS dependency.

**What to monitor:** storefront health endpoint, admin login page, Supabase API endpoint, Edge Functions health, each tenant's subdomain (spot-check).

**Why NOT Better Uptime / Betteruptime.com:** Paid SaaS. **Why NOT Grafana for uptime:** Grafana is metrics visualization, not uptime alerting — wrong tool for this specific job. Use Uptime Kuma for alerting, Grafana for metrics visualization (see observability section).

---

### 4. Observability (Logs + Metrics) — Grafana + Loki + Prometheus

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| Grafana | OSS latest | Dashboard visualization | HIGH |
| Prometheus | OSS latest | Metrics scraping + storage | HIGH |
| Loki | OSS latest | Log aggregation (label-indexed, low RAM) | HIGH |
| Promtail | OSS latest | Log shipping agent (files → Loki) | HIGH |
| `pino` | 9.x | Structured JSON logger for Nitro server | MEDIUM |
| `pino-loki` | 1.x | Pino transport → Loki | MEDIUM |

**Why Grafana + Loki over ELK stack:** ELK (Elasticsearch + Logstash + Kibana) requires 4–8 GB RAM minimum. Loki indexes only labels (not log content), uses object storage or local filesystem, and runs in ~256 MB RAM. For a single-VPS setup this is the only viable self-hosted log aggregation option.

**Why Prometheus:** De-facto standard for Node.js metrics. `prom-client` library is battle-tested. Coolify already exposes Docker metrics that Prometheus can scrape.

**Server logging strategy:** Nuxt/Nitro uses `consola` internally (cannot easily swap). Add `pino` as a parallel HTTP middleware logger (`pino-http`) for request/response logs with structured JSON. Pipe via `pino-loki` transport to Loki. Application-level logs (domain events, order created, payment failed) use `consola` with JSON formatter in production.

**Do NOT add:** Datadog (expensive), New Relic (expensive), Jaeger/Tempo for traces — traces are premature for launch readiness, add if bottlenecks are found post-launch.

---

### 5. Core Web Vitals — Lighthouse CI + @nuxtjs/web-vitals

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| `@lhci/cli` | 0.15.x | Lab performance audits in CI (Lighthouse 12.6.1) | HIGH |
| `@nuxtjs/web-vitals` | latest | Real User Monitoring — collects field data in browser | MEDIUM |

**Why both lab and field data:** Lighthouse CI catches regressions in CI (before deploy). `@nuxtjs/web-vitals` collects real user data (actual devices, real network). Lab scores can differ significantly from field scores — both signals are needed.

**Lighthouse CI setup:**
- `@lhci/cli` 0.15.x requires Node 18+. Lighthouse 13 (Node 22.19+) not yet supported by LHCI, so stay on 0.15.x.
- Run `lhci autorun` in GitHub Actions against `preview` build URL.
- Set budget: LCP < 2.5s, INP < 200ms, CLS < 0.1.
- Only audit the storefront (`apps/storefront`) — it's SSR with SEO impact. Admin is SPA, CWV less relevant.

**`@nuxtjs/web-vitals` setup:**
```typescript
// nuxt.config.ts (storefront only)
modules: ['@nuxtjs/web-vitals'],
webVitals: {
  provider: 'log', // or custom API endpoint → store in Supabase table
}
```

**Why NOT Vercel Speed Insights:** Vercel-only. **Why NOT Datadog RUM:** Paid SaaS.

---

### 6. SEO — @nuxtjs/seo (nuxt-seo meta-package)

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| `@nuxtjs/seo` | 5.1.3 (stable, May 2026) | Meta-package bundling all SEO sub-modules | HIGH |

**What `@nuxtjs/seo` includes:**
- `@nuxtjs/robots` ≥ 6.0 — robots.txt generation, per-route noindex control
- `@nuxtjs/sitemap` ≥ 8.0 — dynamic sitemap with multi-sitemap support, zeroRuntime mode, definePageMeta() integration
- `nuxt-og-image` ≥ 6.2 — server-rendered OG images
- `nuxt-schema-org` ≥ 6.0 — JSON-LD structured data (Restaurant, Menu, LocalBusiness schemas relevant for Fastio)
- `nuxt-seo-utils` ≥ 8.1 — breadcrumbs, canonical URLs, trailing slash normalization
- `nuxt-site-config` ≥ 4.0 — per-tenant site config (critical for multitenant storefront)

**Why `@nuxtjs/seo` and not manual `useSeoMeta`:** The multitenant storefront has per-tenant hostnames. `nuxt-site-config` has first-class multi-tenancy support — each tenant gets its own canonical URL, sitemap, and robots configuration derived from runtime hostname. Per Nuxt SEO docs, multi-tenancy is handled via `defineNuxtConfig` `multiTenancy` option and runtime `updateSiteConfig()`. This is impossible to replicate cleanly with just `useSeoMeta`.

**Why `@nuxtjs/sitemap` specifically:** Supports dynamic URL endpoints for menu items, storefront pages, content pages — all of which are tenant-specific and fetched from Supabase at request time. The `zeroRuntime` mode (v3.4+) generates sitemaps at build time for performance when content is static.

**Important:** Apply only to `apps/storefront` and `apps/landing`. Admin (`apps/admin`) is SPA with `ssr: false` — SEO modules are irrelevant there.

**Schema.org rationale:** JSON-LD for `LocalBusiness`, `Restaurant`, `Menu`, `FoodEstablishment` schemas directly maps to Fastio's domain. Google uses these for rich results (restaurant hours, menu cards). Structured data is injected in SSR HTML, visible to crawlers without JS execution.

**Do NOT add:** `next-seo` (Next.js only), manual `vue-meta` (deprecated), raw `<head>` manipulation.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Error tracking | GlitchTip + `@sentry/nuxt` | Sentry self-hosted | 32+ GB RAM required, not viable on single VPS |
| Error tracking | GlitchTip + `@sentry/nuxt` | Highlight.io | SaaS cost, session replay overhead at launch |
| Log aggregation | Loki + Promtail | ELK stack | ELK requires 4–8 GB RAM, Loki needs ~256 MB |
| Log aggregation | Loki + Promtail | Axiom | Paid SaaS beyond free tier |
| Uptime monitoring | Uptime Kuma | Better Uptime | Paid SaaS |
| Uptime monitoring | Uptime Kuma | Grafana | Wrong tool — Grafana visualizes, doesn't alert on uptime |
| CWV lab testing | Lighthouse CI 0.15.x | Lighthouse 13 | LHCI doesn't support Lighthouse 13 yet (Node 22.19+ required) |
| CWV field data | `@nuxtjs/web-vitals` | Vercel Speed Insights | Vercel platform lock-in |
| SEO | `@nuxtjs/seo` | Manual `useSeoMeta` | No multi-tenancy support, no sitemap, no structured data |
| E2E test isolation | Standalone Playwright | `@nuxt/test-utils` Playwright | Forces Vitest runner, incompatible with existing global-setup |

---

## Installation

```bash
# Error monitoring (SDK only — GlitchTip backend deployed via Coolify)
pnpm --filter apps/storefront add @sentry/nuxt
pnpm --filter apps/admin add @sentry/nuxt

# SEO (storefront only)
pnpm --filter apps/storefront add @nuxtjs/seo

# Core Web Vitals RUM (storefront only)
pnpm --filter apps/storefront add @nuxtjs/web-vitals

# Lighthouse CI (dev/CI tooling — monorepo root or separate CI config)
pnpm add -D @lhci/cli -w

# Structured logging (storefront server + admin server)
pnpm --filter apps/storefront add pino pino-http pino-loki
pnpm --filter apps/admin add pino pino-http pino-loki
```

Uptime Kuma and Grafana/Loki/Prometheus are deployed as Docker services via Coolify — no npm packages needed.

---

## Sources

- [Playwright docs — page object models](https://playwright.dev/docs/pom) — HIGH confidence
- [Nuxt testing docs (v3)](https://nuxt.com/docs/3.x/getting-started/testing) — HIGH confidence
- [Sentry for Nuxt (official)](https://docs.sentry.io/platforms/javascript/guides/nuxt/) — HIGH confidence
- [@sentry/nuxt Nuxt modules page](https://nuxt.com/modules/sentry) — HIGH confidence
- [GlitchTip vs Sentry comparison (2026-03)](https://earezki.com/ai-news/2026-03-14-glitchtip-vs-sentry/) — MEDIUM confidence
- [GlitchTip on Coolify docs](https://coolify.io/docs/services/glitchtip) — HIGH confidence
- [Nuxt SEO announcement (stable March 2025)](https://nuxtseo.com/announcement) — HIGH confidence
- [@nuxtjs/seo npm (v5.1.3, May 2026)](https://www.npmjs.com/package/@nuxtjs/seo) — HIGH confidence
- [Nuxt SEO multi-tenancy docs](https://nuxtseo.com/docs/site-config/guides/multi-tenancy) — HIGH confidence
- [Nuxt Sitemap multi-sitemaps](https://nuxtseo.com/docs/sitemap/guides/multi-sitemaps) — HIGH confidence
- [Lighthouse CI complete guide](https://unlighthouse.dev/learn-lighthouse/lighthouse-ci) — MEDIUM confidence (LHCI 0.15.x / Lighthouse 12.6.1)
- [@nuxtjs/web-vitals Nuxt module](https://nuxt.com/modules/web-vitals) — MEDIUM confidence
- [Grafana + Prometheus + Loki stack guide](https://blog.elest.io/grafana-prometheus-loki-build-a-complete-observability-stack/) — MEDIUM confidence
- [pino-loki transport](https://github.com/Julien-R44/pino-loki) — MEDIUM confidence
- [Uptime Kuma v2 (Oct 2025 release)](https://github.com/louislam/uptime-kuma) — HIGH confidence
- [Core Web Vitals in Nuxt — nuxtseo.com](https://nuxtseo.com/learn-seo/nuxt/launch-and-listen/core-web-vitals) — MEDIUM confidence

---

*Stack research: 2026-05-20*
