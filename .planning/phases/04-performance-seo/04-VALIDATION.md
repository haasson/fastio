---
phase: 4
slug: performance-seo
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-23
revised: 2026-05-23
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 (root `vitest.config.ts`) |
| **Config file** | `vitest.config.ts` (корень монорепо) |
| **Quick run command** | `pnpm vitest run apps/storefront` |
| **Full suite command** | `pnpm test:run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run apps/storefront`
- **After every plan wave:** Run `pnpm test:run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Plan → requirement mapping is canonical (matches each PLAN.md frontmatter `requirements:` field):
> - Plan **04-01** covers **PERF-01** (OG/SEO meta tags)
> - Plan **04-02** covers **PERF-03 + PERF-04** (image optimization + tenant-isolated CDN caching)
> - Plan **04-03** covers **PERF-02** (Lighthouse CI gate, mobile preset)

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | PERF-01 | T-4-01 | Vitest RED for buildHead head-config (og:url, og:image guard, twitter, canonical, null-tenant safety) | unit | `pnpm vitest run apps/storefront/app.test.ts` | ❌ W0 (creates test file in RED state) | ⬜ pending |
| 04-01-02 | 01 | 1 | PERF-01 | T-4-01, T-4-02 | buildHead helper emits absolute og:image, null-safe og:url, twitter card, canonical link — tests GREEN | unit | `pnpm vitest run apps/storefront/app.test.ts && pnpm --filter storefront typecheck` | ❌ W0 (creates `apps/storefront/shared/composables/buildHead.ts`) | ⬜ pending |
| 04-01-03 | 01 | 1 | PERF-01 | — | Human-verify SSR HTML + Telegram preview rendering | manual | n/a (human checkpoint) | ✅ | ⬜ pending |
| 04-02-01 | 02 | 2 | PERF-03, PERF-04 | T-4-04, T-4-05, T-4-06, T-4-SC | @nuxt/image module registered, IPX domains whitelist scoped to specific Supabase subdomain, routeRules emit Vary:Host + no-store + immutable | unit | `pnpm --filter storefront typecheck && grep -c "@nuxt/image" apps/storefront/nuxt.config.ts && grep -E "vary.*[Hh]ost" apps/storefront/nuxt.config.ts` | ❌ W0 (installs package) | ⬜ pending |
| 04-02-02 | 02 | 2 | PERF-03 | T-4-07 | 5 NuxtImg replacements (logo eager+high, hero eager+high, banners lazy, product cards lazy) with explicit width/height | unit | `pnpm --filter storefront typecheck && pnpm --filter storefront lint && bash -c 'for f in apps/storefront/shared/ui/sections/SiteHeader.vue apps/storefront/shared/ui/sections/HeroSection.vue apps/storefront/shared/ui/sections/BannersSection.vue apps/storefront/shared/ui/sf/domain/SfProductCard.vue; do grep -q NuxtImg "$f" \|\| exit 1; done'` | ✅ | ⬜ pending |
| 04-02-03 | 02 | 2 | PERF-03, PERF-04 | — | Human-verify Lighthouse smoke (LCP<2.5s, CLS<0.1) + response headers (Vary:Host, no-store, immutable, WebP via /_ipx/) | manual | n/a (human checkpoint) | ✅ | ⬜ pending |
| 04-03-01 | 03 | 3 | PERF-02 | T-4-08 | lighthouserc.json with mobile preset + LCP<2500ms and CLS<0.1 as ERROR-level assertions | unit | `node -e "const c=require('./lighthouserc.json');if(c.ci.collect.settings.preset!=='mobile'\|\|c.ci.assert.assertions['largest-contentful-paint'][0]!=='error'\|\|c.ci.assert.assertions['cumulative-layout-shift'][0]!=='error')process.exit(1)"` | ❌ W0 (creates `lighthouserc.json`) | ⬜ pending |
| 04-03-02 | 03 | 3 | PERF-02 | T-4-09, T-4-10, T-4-SC2 | lhci job in ci.yml pinned Node 20 + @lhci/cli@0.14.0, runs on PRs, build env excludes service-role | unit | `python3 -c "import yaml;d=yaml.safe_load(open('.github/workflows/ci.yml'));assert 'lhci' in d['jobs'];assert d['jobs']['lhci']['needs']=='check';assert any('@lhci/cli@0.14.0' in str(s.get('run','')) for s in d['jobs']['lhci']['steps'])"` | ❌ W0 (creates lhci job in ci.yml) | ⬜ pending |
| 04-03-03 | 03 | 3 | PERF-02 | — | Human-verify lhci runs on draft PR with mobile preset, passes on baseline, blocks intentional LCP regression | manual | n/a (human checkpoint) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/storefront/shared/composables/buildHead.ts` — new module that `app.test.ts` imports (created in plan 04-01 Task 2; W0 for plan 04-01 Task 1's RED state)
- [ ] `apps/storefront/app.test.ts` — Vitest spec covering all 7 head-config invariants including null-tenant safety
- [ ] `@nuxt/image` installed in `apps/storefront/package.json` — W0 for plan 04-02 NuxtImg replacements
- [ ] `lighthouserc.json` — LHCI config at repo root (mobile preset, 5 runs) — W0 for plan 04-03 lhci job step
- [ ] GitHub Actions job `lhci:` in `.github/workflows/ci.yml` — W0 for the PR-blocking perf gate
- [ ] Staging tenant URL `https://demo.fastio.ru/` reachable — W0 for lhci job; checkpoint 04-03-03 may switch to `startServerCommand` mode if unreachable

---

## Manual-Only Verifications

| Behavior | Requirement | Plan | Why Manual | Test Instructions |
|----------|-------------|------|------------|-------------------|
| Telegram/WhatsApp preview shows venue name + logo | PERF-01 | 04-01 | Bot crawlers can't be automated in CI | Paste storefront URL in Telegram chat, verify preview card |
| LCP hero image has fetchpriority="high" in DevTools | PERF-03 | 04-02 | DevTools Network priority column is a visual artifact | Open storefront in Chrome, DevTools → Network, sort by Priority, verify hero/logo show "Highest" |
| tenant-A cached page not served to tenant-B | PERF-04 | 04-02 | Requires two tenant deployments + cache observation across them | Test with two subdomains in staging; verify Vary:Host on document responses |
| lhci would block a real LCP regression on PR | PERF-02 | 04-03 | Requires opening an actual draft PR + intentional regression revert cycle | Tank hero NuxtImg to `loading="lazy"`, push, confirm lhci red |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---

## Revision Log

- **2026-05-23** — Rewrote Per-Task Verification Map: corrected plan-to-requirement assignments (04-02 → PERF-03/04, 04-03 → PERF-02; removed phantom 04-04 task); fixed automated commands to reference the actual test artifacts (`apps/storefront/app.test.ts`, `lighthouserc.json`, `.github/workflows/ci.yml`) instead of placeholder paths (`apps/storefront/app.vue`, `apps/storefront/shared/ui/`). Added per-row plan column for clarity; added Manual-Only verifications plan column.
