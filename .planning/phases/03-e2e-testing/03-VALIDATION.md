---
phase: 3
slug: e2e-testing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
updated: 2026-05-22
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.60 |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `pnpm playwright test --project=chromium --grep @smoke` |
| **Full suite command** | `pnpm playwright test` |
| **Estimated runtime** | ~120 seconds (full suite against staging) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm playwright test --project=chromium --grep @smoke`
- **After every plan wave:** Run `pnpm playwright test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | SEC-04 | T-3-01 | staging env cannot reach prod DB | manual | human gate — Supabase Cloud setup | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | SEC-04 | T-3-01 | migrate.yml staging path isolated | e2e | `pnpm playwright test --grep @staging` | ❌ W0 | ⬜ pending |
| 03-01-06 | 01 | 1 | SEC-04 | T-3-01c | CI workflows use staging secrets, never prod | ci-yaml | `grep SUPABASE_STAGING .github/workflows/e2e-*.yml` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | E2E-01 | — | N/A | e2e | `pnpm playwright test tests/e2e/order-flow.spec.ts` | ✅ | ⬜ pending |
| 03-03-01 | 03 | 2 | E2E-02 | — | N/A | e2e | `pnpm playwright test tests/e2e/auth-invite-staff.spec.ts` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 2 | E2E-03 | T-3-02 | tenant-A session → tenant-B returns 403 | e2e | `pnpm playwright test tests/e2e/cross-tenant.spec.ts` | ❌ W0 | ⬜ pending |
| 03-05-01 | 05 | 3 | E2E-04 | — | N/A | e2e | `pnpm playwright test tests/e2e/onboarding-flow.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/e2e/global-setup.mjs` — updated with dual-path staging/local logic (SEC-04)
- [ ] `tests/e2e/order-flow.spec.ts` — extended to verify order in admin panel (E2E-01)
- [ ] `tests/e2e/auth-invite-staff.spec.ts` — new file for staff invite auth flow (E2E-02)
- [ ] `tests/e2e/cross-tenant.spec.ts` — new file for cross-tenant security (E2E-03)
- [ ] `tests/e2e/onboarding-flow.spec.ts` — new file for onboarding flow (E2E-04)
- [ ] `.github/workflows/e2e-smoke.yml` and `.github/workflows/e2e-nightly.yml` — staging env secrets + `postgresql-client` install step (SEC-04)
- [ ] `data-testid` attributes added to onboarding components (prerequisite for E2E-04)

---

## Notes on E2E-02 Coverage Split

E2E-02 (auth flow) сейчас покрыт двумя источниками:
- **Существующий тенант — вход**: `tests/e2e/admin-login.spec.ts` (уже зелёный).
- **Инвайт сотрудника**: `tests/e2e/auth-invite-staff.spec.ts` (этот план, plan 03-03).
- **Регистрация нового тенанта**: исключена из Phase 3 (см. ROADMAP success criteria) — flow требует email-delivery через Inbucket/SMTP, недоступного на staging; отложено до Phase 5 (transactional email).
