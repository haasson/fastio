# Feature Landscape: SaaS Launch Readiness

**Domain:** Multi-tenant SaaS for SMB restaurants and service businesses
**Researched:** 2026-05-20
**Scope:** What does a feature-complete platform still need to be production launch-ready?

---

## Context

The application already has: menu/catalog, orders, kitchen screen, appointments, reservations, team management, billing/subscriptions, brand customization, multi-branch support, audit log, AI assistant, promotions, and a branded SSR storefront. This document covers what is still missing before the first paying customer goes live — operational glue, customer-facing polish, and platform health.

---

## Table Stakes

Features customers expect. Their absence causes churn or blocks going live at all.

### 1. Transactional Email Notifications

| Recipient | Event | What They Expect |
|-----------|-------|-----------------|
| Customer (end user) | Order placed | Immediate confirmation with order summary, estimated time, venue contact |
| Customer | Appointment booked | Confirmation with date/time/address, cancellation link |
| Customer | Reservation confirmed | Confirmation with date/party size/venue address |
| Owner/staff | New order received | Alert email if audio notification is missed (failsafe) |
| Owner | Daily/weekly summary | Optional digest (low priority but expected in month 2) |

**Why expected:** 75%+ of online orders happen on mobile. Customers close the tab. If they don't get a confirmation email they open a support ticket or call the restaurant. This is non-negotiable.

**Current state:** Supabase has a 2/hour email limit in free tier; production requires Resend or SendGrid via Edge Functions. The payment-webhook Edge Function exists — same pattern applies to order notifications.

**Complexity:** Medium. Resend API + Edge Function trigger on `orders` INSERT. HTML email template needed.

**Dependencies:** Email provider setup (Resend recommended given Supabase partnership), Edge Function for order events.

---

### 2. Customer-Facing Order Status Page

After checkout, the customer needs a way to check order status without calling the restaurant.

| Feature | Detail |
|---------|--------|
| Order status URL | Unique per order, accessible without login |
| Status progression | Accepted → In preparation → Ready / On the way |
| Realtime updates | Supabase Realtime already used in admin; same channel can push to storefront |

**Why expected:** Reduces inbound calls to the venue by 30-50%. Competitors (Restik, QR-Cafe) all have this. Without it, the restaurant staff fields "where's my order?" calls constantly.

**Complexity:** Medium. Nitro endpoint (no auth, order token in URL) + Realtime subscription on storefront.

**Dependencies:** Order token generation at checkout (needs schema addition if not present).

---

### 3. Basic Sales Analytics / Reporting Dashboard

Restaurant owners need at minimum a daily snapshot of:

| Metric | Frequency | Format |
|--------|-----------|--------|
| Total revenue | Daily / weekly | Number + trend vs prior period |
| Order count | Daily / weekly | Number + trend |
| Top-selling items | Weekly | Ranked list (top 5-10) |
| Revenue by category | Weekly | Simple breakdown |
| Orders by time-of-day | Weekly | Heatmap or bar chart |

**Why expected:** Without basic reporting, owners have no visibility into business performance. SMB owners check this daily. "Missing features" is the 4th most common churn reason in SMB SaaS exit surveys. Analytics is the feature category most mentioned alongside churn.

**Anti-pattern to avoid:** Full BI suite, cohort analysis, inventory analytics — these belong in v2.

**Complexity:** Medium. All data exists in PostgreSQL. Requires aggregate SQL queries + a reporting page in admin. No external BI tool needed at launch.

**Dependencies:** Orders data schema (already exists). Requires read-optimized queries or materialized views if order volume grows.

---

### 4. Print-to-Kitchen / Receipt Printing

Owners of physical venues expect new orders to print automatically on a thermal receipt printer.

| Approach | Notes |
|----------|-------|
| Browser print (CSS @media print) | Zero infrastructure, works today, lowest reliability |
| Star WebPRNT / CloudPRNT | Best DX, works over WiFi, requires Star hardware |
| Generic ESC/POS over network | Broader compatibility, more complex integration |
| Dedicated Android app (BizPrint/PrinterCo) | Third-party bridge, no code needed from our side |

**Recommendation:** At launch, provide browser `window.print()` with a print-optimized order template. Document the third-party BizPrint bridge for owners who want automatic printing. Full thermal integration is post-launch.

**Why expected:** Kitchen staff cannot stare at a screen. Paper is the operational backbone of most small venues.

**Complexity:** Low (browser print). Medium-High (WebPRNT integration).

**Dependencies:** Order detail view must render cleanly in print media query.

---

### 5. Mobile-First Storefront: Core Web Vitals

75%+ of food orders are placed on mobile. The storefront must pass:

| Metric | Target | Why |
|--------|--------|-----|
| LCP (Largest Contentful Paint) | < 2.5s | Google ranking factor; slow = abandoned cart |
| CLS (Cumulative Layout Shift) | < 0.1 | Menu items jumping during load = misclicks |
| FID / INP | < 200ms | Touch response on mobile |
| TTFB | < 800ms | SSR is already enabled, Nitro caching critical |

**Current state:** SSR is on for the storefront, which is correct. The LRU tenant cache in `tenantCache.ts` helps TTFB. Image optimization via `proxy-image` Edge Function exists. Gaps likely in: image sizing/lazy loading, font loading strategy, and render-blocking scripts.

**Complexity:** Medium. Audit with Lighthouse, fix per finding. No architectural changes needed.

**Dependencies:** None. Pure optimization work.

---

### 6. SEO Metadata for Storefront

Every public page needs:

| Element | Scope | Notes |
|---------|-------|-------|
| `<title>` | Per page | "[Venue name] — [Page type]" |
| `meta description` | Per page | Venue tagline or category description |
| Open Graph tags | Per page | For WhatsApp/Telegram link previews (critical in CIS market) |
| Canonical URL | Per page | Prevent duplicate content across subdomains |
| Structured data (JSON-LD) | Menu/restaurant | Google rich results for restaurant menus |

**Why expected:** WhatsApp/Telegram link previews are how venues share their storefront link with customers. Without OG tags the preview is blank — looks broken. Restaurant owners notice this immediately.

**Complexity:** Low-Medium. Nuxt `useHead()` + `useSeoMeta()` in storefront pages. Data already available from tenant SSR context.

**Dependencies:** Tenant data available in SSR context (already is via middleware).

---

### 7. Legal Pages

| Page | Requirement |
|------|-------------|
| Privacy Policy | Required by GDPR/Russian law (152-FZ) for any data collection |
| Terms of Service | Required before billing customers |
| Cookie consent | Required if using analytics cookies |

**Why expected:** Billing customers without Terms of Service is legally problematic. Payment processors (Stripe, YooKassa) may require ToS to be in place.

**Complexity:** Low. Static pages. Can use a generator for initial draft.

**Dependencies:** Must be linked from storefront footer and admin onboarding.

---

### 8. Error Monitoring in Production (Sentry)

| Capability | Detail |
|-----------|--------|
| Error capture | `reportError()` from `@fastio/shared/observability` already wraps Sentry — needs production DSN |
| Performance monitoring | Storefront response times, slow DB queries |
| Alerting | Slack/email alert on new error spikes |
| Source maps | Upload during build for readable stack traces |

**Why expected:** Without this, the first customer's broken checkout is a mystery. Production bugs are invisible.

**Current state:** `reportError()` exists. Sentry DSN may not be configured for production environment.

**Complexity:** Low. Sentry project creation + environment variable + source map upload step in CI/CD.

**Dependencies:** Sentry account, CI/CD build step.

---

### 9. Uptime Monitoring + Status Page

| Component | Tool | Effort |
|-----------|------|--------|
| Uptime monitor | BetterUptime, UptimeRobot, or Sentry Uptime | 1 hour setup |
| Status page | BetterUptime hosted page | 1 hour setup |
| Incident communication | Email alert to owner on downtime | Automated |

**Why expected:** When the storefront is down, the restaurant loses orders. Owner needs to know immediately, not when customers call. A status page lets the team communicate during incidents without scrambling.

**Complexity:** Low. Third-party service, no code changes.

**Dependencies:** Production URLs confirmed.

---

### 10. Account Deletion / Data Export for Tenants

| Capability | GDPR/152-FZ Requirement |
|-----------|------------------------|
| Tenant can export their data (orders, customers, menu) | Right to portability |
| Tenant can request account deletion | Right to erasure |
| Customer (end user) can request their data deleted | Right to erasure |

**Why expected:** GDPR (for EU customers) and Russian 152-FZ (for domestic customers) both mandate this. B2B buyers check for this before committing.

**Current state:** Unknown — needs verification. Audit log exists which is a good foundation.

**Complexity:** Medium. Export = CSV download endpoint. Deletion = admin script + documented process initially.

**Dependencies:** Supabase RLS must allow cascading deletes cleanly.

---

## Differentiators

Features that provide competitive advantage. Not universally expected, but drive conversion and retention.

### 1. Telegram/WhatsApp Order Notifications (Owner-Side)

| Feature | Detail |
|---------|--------|
| Owner connects a Telegram bot | Receives each new order as a Telegram message |
| One-tap status update | Reply "2" to mark order as preparing, etc. |

**Why valuable:** In the CIS market, Telegram is the primary business communication tool. Restaurant owners manage everything in Telegram. Email notifications feel formal; Telegram feels operational. Restik already offers this. Being second is fine — not having it is a gap.

**Current state:** `supabase/functions/` has a Telegram webhook — the infrastructure exists.

**Complexity:** Medium. Telegram Bot API + webhook → Edge Function → update order status.

**Dependencies:** Existing Telegram Edge Function, bot registration per tenant.

---

### 2. QR Menu / Table QR Code Generation

| Feature | Detail |
|---------|--------|
| Generate a QR code per table or branch | Links to branded storefront |
| Print-ready PDF export | A4 or A5 with venue branding |

**Why valuable:** QR menus became standard post-2020. Venues expect to print QR codes for tables. The storefront already exists — generating a QR pointing to it is a thin feature with high perceived value.

**Complexity:** Low. QR code generation library (qrcode.js) + PDF export.

**Dependencies:** Storefront URL structure per branch/tenant.

---

### 3. Storefront PWA (Progressive Web App)

| Capability | Benefit |
|-----------|---------|
| Add to home screen | Customer keeps venue on their phone |
| Offline menu browsing | Menu visible even with poor connection |
| Push notifications | Notify customer when order is ready |

**Why valuable:** Starbucks, AliExpress, and food platforms all ship PWAs. Add-to-home-screen is a viral distribution mechanism — customers who install the storefront as an app are 2-3x more likely to reorder.

**Complexity:** Medium. Service worker + Web App Manifest. SSR complicates service worker registration — needs careful implementation.

**Dependencies:** HTTPS required (already is). Nuxt PWA module or manual manifest.

---

### 4. Onboarding Wizard (First-Run Experience)

| Step | Content |
|------|---------|
| 1 | Add your first menu category and 3 items |
| 2 | Preview your storefront |
| 3 | Share the link with a test customer |
| 4 | Configure notification preferences |

**Why valuable:** Time-to-value in SaaS directly predicts retention. Average SaaS activation rate is 36%; above 50% is exceptional. A guided first-run that takes the owner from sign-up to "my storefront is live" in under 10 minutes is the single highest-ROI onboarding investment.

**Current state:** Onboarding exists (tenant registration) but unclear if a post-registration wizard guides menu setup.

**Complexity:** Medium. In-app checklist component + progress tracking in tenant settings.

**Dependencies:** None. Pure frontend work.

---

### 5. Daily Sales Email Digest (Owner)

A once-daily email summarizing: yesterday's revenue, order count, top items. Sent at 8am.

**Why valuable:** Owners who see daily numbers stay engaged with the product. Engaged owners don't churn. This is cheap to implement once email infrastructure exists (see Table Stakes #1).

**Complexity:** Low. Supabase scheduled function (pg_cron or cron Edge Function) + email template.

**Dependencies:** Transactional email setup (Table Stakes #1).

---

### 6. Customer Reviews / Ratings (Post-Order)

After order completion, send a review request. Show aggregate rating on storefront.

**Why valuable:** Social proof drives conversion. New visitors to a storefront with "4.8 stars from 127 orders" convert higher than blank storefronts.

**Complexity:** Medium. Review schema, post-order trigger, storefront display.

**Dependencies:** Transactional email (Table Stakes #1), order completion webhook.

---

## Anti-Features

Features to deliberately NOT build at this stage.

### 1. Native Mobile App (iOS/Android)

**Why avoid:** Web-first is explicitly in project scope. A native app requires separate development track, App Store review cycles, and 2x maintenance burden. PWA covers 90% of the use case.

**What to do instead:** PWA manifest for add-to-home-screen. Revisit after first 50 paying customers.

---

### 2. Loyalty / Points Program

**Why avoid:** High complexity (points ledger, expiry logic, abuse prevention). The project already lists this as Out of Scope for launch. A half-baked loyalty system is worse than no system — it creates customer expectations the platform can't fulfill.

**What to do instead:** Promotions/discounts feature already exists. Use that for customer retention at launch.

---

### 3. POS / Fiscal Register Integration (ATOL, Evotor)

**Why avoid:** Russian fiscal compliance (54-FZ) integrations require hardware certification, ongoing maintenance, and per-integration support cost. Out of scope per PROJECT.md.

**What to do instead:** Document the manual workaround (export orders, manual fiscal registration). Revisit after first wave of customers demands it.

---

### 4. Full BI / Custom Report Builder

**Why avoid:** Building a report builder before knowing what questions owners actually ask is waste. Basic fixed reports (Table Stakes #3) validate demand first.

**What to do instead:** Implement 5-7 fixed reports with real data. Let customers request custom reports — that backlog becomes the v2 roadmap.

---

### 5. Multi-Language Storefront (i18n)

**Why avoid:** Adds complexity to every storefront template and content model. Current target market is CIS — Russian-first is correct.

**What to do instead:** Build with i18n-ready structure (no hardcoded strings), but don't ship translations at launch.

---

### 6. Inventory / Stock Management

**Why avoid:** Full inventory management is a deep domain (COGS tracking, supplier management, write-offs). The market has dedicated tools (Restik, Tillypad). Competing on this at launch dilutes focus.

**What to do instead:** Add "item unavailable" toggle to menu items (likely already exists). Deep inventory is a v2 vertical.

---

### 7. Customer CRM / Marketing Campaigns

**Why avoid:** GDPR/152-FZ compliance for marketing databases is a significant legal burden. Sending marketing emails requires opt-in management, unsubscribe handling, complaint tracking. This is a different product category.

**What to do instead:** Collect customer emails at checkout for transactional notifications only. Dedicate marketing to a future CRM module.

---

## Feature Dependencies

```
Transactional Email (Table Stakes #1)
  → Customer Order Confirmation
  → Customer Appointment Confirmation
  → Owner New Order Alert (failsafe)
  → Daily Sales Digest (Differentiator #5)
  → Customer Review Request (Differentiator #6)

Order Status Page (Table Stakes #2)
  → Requires: order access token at checkout

Sales Analytics Dashboard (Table Stakes #3)
  → Requires: orders in PostgreSQL (exists)
  → Enables: Daily Sales Digest (Differentiator #5)

Sentry Production Setup (Table Stakes #8)
  → Enables: meaningful E2E test failure diagnosis
  → Required before: first customer goes live

Uptime Monitoring (Table Stakes #9)
  → Requires: production URLs finalized

Legal Pages (Table Stakes #7)
  → Required before: billing any customer

PWA (Differentiator #3)
  → Requires: HTTPS (already), Core Web Vitals pass (Table Stakes #5)
  → Enables: push notification channel for order status

Telegram Notifications (Differentiator #1)
  → Requires: Telegram bot per tenant (existing Edge Function is a start)
  → Enables: order status update via Telegram reply
```

---

## MVP Recommendation for Launch Readiness

**Must ship before first paid customer:**

1. **Transactional email** — Order/appointment confirmation to customer. Owner failsafe alert.
2. **Sentry production monitoring** — Non-negotiable. Invisible bugs kill first customers.
3. **Legal pages** — Privacy Policy + Terms of Service. Required for billing.
4. **SEO metadata + OG tags** — WhatsApp/Telegram link previews are the primary sharing mechanism in CIS. Blank preview = broken perception.
5. **Core Web Vitals audit + fixes** — Lighthouse run, fix top 3 issues. Not perfection, baseline competence.
6. **Uptime monitoring** — BetterUptime setup, 1 hour of work.

**Ship in first sprint after launch (week 1-2):**

7. **Basic sales analytics** — Revenue + order count + top items. Owners will ask on day 2.
8. **Order status page** — Reduces venue support burden immediately.
9. **Print-friendly order view** — CSS @media print, browser print. Unblocks kitchen workflow.

**Ship in month 1:**

10. **Telegram order notifications** — First differentiator. High perceived value in target market.
11. **QR code generation** — 2-hour feature, high demo value.
12. **Onboarding wizard** — After first 5 customers reveal where they get stuck.

**Defer to v2:**

- PWA (valuable, not blocking)
- Customer reviews (valuable, not blocking)
- Daily email digest (valuable, not blocking)
- Data export (implement manually on first request)

---

## Confidence Assessment

| Area | Confidence | Source |
|------|------------|--------|
| Transactional email as table stakes | HIGH | Multiple restaurant SaaS benchmarks, Baymard UX research |
| Core Web Vitals / mobile UX | HIGH | Google documentation, Baymard food delivery research |
| Sales analytics as day-1 need | HIGH | Industry reports, multiple restaurant SaaS competitor feature sets |
| Telegram as CIS differentiator | MEDIUM | Restik feature set (CBInsights), market knowledge — not primary source verified |
| GDPR/152-FZ legal requirements | HIGH | EU GDPR official text, Russian law reference via multiple compliance guides |
| PWA conversion impact | MEDIUM | Starbucks case study, Baymard mobile research — specific conversion numbers vary |
| Print receipt as table stakes | MEDIUM | Industry pattern, GloriaFood/Restik feature sets — specific SMB expectation not sourced directly |

---

## Sources

- [Baymard Institute — Food Delivery & Takeout UX Research](https://baymard.com/research/online-food-delivery)
- [Baymard — 3 UX Takeaways from Food Delivery Testing](https://baymard.com/blog/food-delivery-takeout-launch)
- [RestaurantOwner.com — Daily Sales Report](https://www.restaurantowner.com/public/Daily-Sales-Report.cfm)
- [MarketMan — Ultimate Guide to Restaurant Reporting](https://www.marketman.com/blog/ultimate-guide-to-restaurant-reporting)
- [SaaStr — The Challenge with SMB SaaS High Churn](https://www.saastr.com/the-challenge-with-smb-saas-high-growth-can-only-mask-high-churn-for-just-so-long/)
- [Forecastio — Reduce SMB Customer Churn: 5 Retention Strategies](https://forecastio.ai/blog/strategies-for-reducing-smb-churn-in-saas)
- [Resend — Send Emails with Supabase](https://resend.com/supabase)
- [Supabase — Sending Emails via Edge Functions](https://supabase.com/docs/guides/functions/examples/send-emails)
- [Restik — Company Profile (CBInsights)](https://www.cbinsights.com/company/restik)
- [Sentry — Uptime Monitoring](https://sentry.io/product/uptime-monitoring/)
- [Watchman Tower — Why Every SaaS Needs a Status Page](https://www.watchmantower.com/blog/saas-status-page-importance)
- [TermsFeed — Legal Requirements for SaaS](https://www.termsfeed.com/blog/legal-requirements-saas/)
- [Sprinto — GDPR for SaaS Complete Guide](https://sprinto.com/blog/gdpr-for-saas/)
- [Braze — Order Confirmation Email Best Practices](https://www.braze.com/resources/articles/order-confirmation-email)
- [GloriaFood — Restaurant Analytics Dashboard](https://www.gloriafood-pos.com/restaurant-analytics-dashboard)
- [Shopify — PWA SEO](https://www.shopify.com/blog/pwa-seo)
