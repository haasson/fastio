# Roadmap: Fastio Launch Readiness

**Milestone:** Launch Readiness
**Created:** 2026-05-21
**Mode:** mvp
**Granularity:** standard

---

## Phases

- [x] **Phase 1: Security Foundation** — Закрыть дыры в изоляции тенантов и утечке ключей до любой другой работы *(SEC-04/staging вынесен в Phase 3)*
- [x] **Phase 2: Observability** — Развернуть мониторинг ошибок и алертинг, чтобы сбои были видны (completed 2026-05-21)
- [ ] **Phase 3: E2E Testing** — Покрыть критические флоу авто-тестами на стабильном staging-окружении
- [ ] **Phase 4: Performance & SEO** — Довести витрину до приемлемых Core Web Vitals и корректных OG-превью
- [ ] **Phase 5: Operational Features** — Добавить транзакционный email, страницу статуса заказа и легальные страницы

---

## Phase Details

### Phase 1: Security Foundation

**Goal**: Tenant isolation is airtight, service-role key cannot reach the browser, and the system fails loudly on misconfiguration instead of silently serving wrong data
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03
**Success Criteria** (what must be TRUE):

  1. A CI step runs after every build and exits non-zero if the string `service_role` appears anywhere under `.output/public/`
  2. Every table in the Supabase project has an explicit RLS policy; an audit query returns zero tables with `rowsecurity = false`
  3. Requesting the storefront with an unknown or missing `Host` header returns HTTP 503, not a page with data from another tenant or an unscoped admin view

**Plans:** 3/3 plans executed
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — SEC-03 tenant middleware hardening (Host guard + 503 for unknown tenant + 500 for missing tenantId in getTenantDb)
- [x] 01-02-PLAN.md — SEC-02 CI security job: grep storefront public bundle for service_role
- [x] 01-03-PLAN.md — SEC-01 migration 302 (RLS on edge_alerts_state) + migrate.yml TENANT_TABLES audit query

> **Перенесено 2026-05-21:** план `01-04` (SEC-04, staging Supabase + E2E-обвязка) вынесен в `.planning/deferred/SEC-04-staging-supabase-e2e-PLAN.md` и переехал в Phase 3 — это инфраструктура под E2E, не нужна для самой security-foundation. Phase 1 закрывается на SEC-01/02/03.

### Phase 2: Observability

**Goal**: Errors and downtime in production are immediately visible to the team without needing to dig through logs manually
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: OBS-01, OBS-02, REL-01
**Success Criteria** (what must be TRUE):

  1. An intentionally thrown server-side error in a Nitro route appears in GlitchTip within 60 seconds, with a stack trace and the tenant slug as a tag
  2. A Telegram message arrives in the team channel within 5 minutes when GlitchTip receives a new error event
  3. Every composable that calls `supabase.channel()` has a paired `removeChannel()` call in `onUnmounted`; a grep audit returns zero violations

**Plans:** 4/4 plans complete
Plans:
**Wave 1**

- [x] 02-01-PLAN.md — OBS-01 deploy GlitchTip on Coolify (errors.fastio.ru) + admin bootstrap + deployment runbook
- [x] 02-04-PLAN.md — REL-01 realtime channel cleanup audit script (corrected grep formula) + CI gate

**Wave 2**

- [x] 02-02-PLAN.md — OBS-01 wire @sentry/nuxt (autoInstrument + source-map upload) in admin & storefront + tenant slug tag
- [x] 02-03-PLAN.md — OBS-02 GlitchTip native Telegram alert config + runbook (zero code)

### Phase 3: E2E Testing

**Goal**: The critical customer order flow and auth flows are verified by automated tests on every CI run, and test failures are not caused by shared database state
**Mode:** mvp
**Depends on**: Phase 1, Phase 2
**Requirements**: E2E-01, E2E-02, E2E-03, E2E-04, SEC-04
**Success Criteria** (what must be TRUE):

  1. A Playwright test runs the full customer order flow (select items → submit order → order appears in the admin panel) against the staging environment and passes reliably on 5 consecutive CI runs
  2. A Playwright test verifies that auth flows work: existing user login and staff invite link complete without errors *(new tenant registration excluded — requires Inbucket email delivery, deferred to Phase 5 transactional email work)*
  3. A cross-tenant security test confirms that an authenticated session for tenant-A receives a 403 or empty result when requesting tenant-B data via any API endpoint
  4. A Playwright test steps through the owner onboarding flow (register → create venue → configure menu → publish storefront) and reaches the published storefront without manual intervention
  5. (SEC-04) Staging and production Supabase projects are separate; a developer cannot accidentally run E2E tests against the production database

**Plans**: TBD — **готовая спека staging-сетапа уже лежит в `.planning/deferred/SEC-04-staging-supabase-e2e-PLAN.md`** (бывш. 01-04): создание staging-проекта, staging-push в migrate.yml, минимальный E2E seed, dual-path global-setup.mjs. При планировании Phase 3 взять её первой — она блокер для всего остального E2E.

### Phase 4: Performance & SEO

**Goal**: Every storefront page loads fast enough for a real mobile user in CIS, and sharing a storefront link in Telegram or WhatsApp shows a meaningful preview
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: PERF-01, PERF-02, PERF-03, PERF-04
**Success Criteria** (what must be TRUE):

  1. Pasting a storefront URL into Telegram or WhatsApp shows the venue name, description, and logo image in the link preview (not a blank card)
  2. Lighthouse CI in the pipeline reports LCP < 2.5s and CLS < 0.1 for the storefront menu page on a simulated mobile connection; a failing score blocks the build
  3. Hero and menu item images are served as WebP with explicit width/height attributes; the LCP image has `fetchpriority="high"` and no `loading="lazy"`
  4. CDN-cached storefront routes include a `Vary: Host` response header; serving tenant-A's cached page to a tenant-B request is impossible by construction

**Plans**: TBD
**UI hint**: yes

### Phase 5: Operational Features

**Goal**: A customer who places a real order receives an email confirmation, can track their order status, and can find legal documents — making the first week of live orders manageable without manual support
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: OPS-01, OPS-02, OPS-03
**Success Criteria** (what must be TRUE):

  1. A customer who completes an order receives a transactional email within 2 minutes containing the order summary and a link to the order status page
  2. The order status link works without any login and shows the current order status, updating in real time when the venue changes the status
  3. Privacy Policy and Terms of Service pages are reachable from the storefront footer of every tenant and load as static pages without authentication

**Plans**: TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security Foundation | 3/3 | Complete (SEC-04 → Phase 3) | 2026-05-21 |
| 2. Observability | 4/4 | Complete   | 2026-05-21 |
| 3. E2E Testing | 1/5 | In Progress|  |
| 4. Performance & SEO | 0/? | Not started | - |
| 5. Operational Features | 0/? | Not started | - |

---

*Roadmap created: 2026-05-21*
*Last updated: 2026-05-21 — Phase 2 planned (4 plans, 2 waves)*
