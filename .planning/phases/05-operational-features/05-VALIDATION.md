---
phase: 5
slug: operational-features
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-23
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm vitest run apps/storefront` |
| **Full suite command** | `pnpm test:run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run apps/storefront`
- **After every plan wave:** Run `pnpm test:run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | OPS-01 | — | DEFERRED — no implementation | — | — | — | ⬜ pending |
| 05-01-02 | 01 | 1 | OPS-02 | — | Order accessible via guest_token only | manual | manual — live checkout flow | N/A | ⬜ pending |
| 05-01-03 | 01 | 1 | OPS-03 | — | /terms renders when isLegalInfoComplete | unit | `pnpm vitest run apps/storefront/pages/terms.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-04 | 01 | 1 | OPS-03 | — | Footer shows /terms link when isLegalInfoComplete | unit | included in terms.test.ts | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/storefront/pages/terms.test.ts` — stubs for OPS-03: renders with complete legalInfo, shows empty/fallback state without legalInfo, footer link visibility

*Existing Vitest infrastructure covers all other requirements — no new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Order status page accessible via guest_token after checkout | OPS-02 | Requires live Supabase + full checkout flow; mocking useFetch + auth would be synthetic | Complete a checkout order, follow redirect to /order/[id]?t=[token], verify status page shows order details and polls for updates |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
