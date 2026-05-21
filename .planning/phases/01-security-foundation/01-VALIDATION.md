---
phase: 1
slug: security-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x + Playwright 1.60 |
| **Config file** | `vitest.config.ts` (per-app), `playwright.config.ts` |
| **Quick run command** | `pnpm test:run` |
| **Full suite command** | `pnpm test && pnpm typecheck` |
| **Estimated runtime** | ~30 seconds (unit), ~120 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:run`
- **After every plan wave:** Run `pnpm test && pnpm typecheck`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | SEC-01 | T-1-01 | RLS active on all tenant tables | manual | `supabase db query` | ✅ | ⬜ pending |
| 1-02-01 | 02 | 1 | SEC-02 | T-1-02 | service_role not in .output/public/ | CI | `grep -r service_role .output/public/` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 1 | SEC-03 | T-1-03 | unknown Host → HTTP 503 | unit | `pnpm test:run apps/storefront` | ✅ | ⬜ pending |
| 1-04-01 | 04 | 1 | SEC-04 | T-1-04 | staging Supabase project separate | manual | checkpoint:human-verify | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.github/workflows/security.yml` — CI job for service_role bundle check (SEC-02)
- [ ] `e2e/global-setup-staging.ts` — staging seed path (SEC-04)

*Existing vitest + Playwright infrastructure covers unit and E2E testing.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Staging Supabase project exists | SEC-04 | Requires Supabase Cloud UI action | Create project at app.supabase.com, set GH Secrets |
| GH Secrets configured | SEC-04 | GitHub secrets cannot be created via code | Add SUPABASE_STAGING_URL + SUPABASE_STAGING_SERVICE_KEY to repo secrets |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
