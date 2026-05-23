---
plan: 04-03
phase: 04-performance-seo
status: complete
completed: "2026-05-23"
requirements: [PERF-02]
key-files:
  created:
    - lighthouserc.json
  modified:
    - .github/workflows/ci.yml
---

# Plan 04-03 Summary: Lighthouse CI Gate (PERF-02)

## What Was Built

Lighthouse CI gate in the GitHub Actions pipeline. Every PR to `main` now runs a real Lighthouse audit against the staging storefront (`https://demo.fastio.ru/`) with the **mobile preset** (Moto G4 CPU throttle + Slow 4G network) and asserts LCP < 2500ms and CLS < 0.1 as build-blocking errors.

## Files Created / Modified

### `lighthouserc.json` (new, repo root)

```json
{
  "ci": {
    "collect": {
      "url": ["https://demo.fastio.ru/"],
      "numberOfRuns": 5,
      "settings": {
        "preset": "mobile",
        "onlyCategories": ["performance"],
        "chromeFlags": "--no-sandbox --disable-dev-shm-usage"
      }
    },
    "assert": {
      "preset": "lighthouse:no-pwa",
      "assertions": {
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "first-contentful-paint": ["warn", { "maxNumericValue": 1800 }],
        "interactive": ["warn", { "maxNumericValue": 3800 }],
        "uses-optimized-images": ["warn"],
        "uses-webp-images": ["warn"],
        "render-blocking-resources": ["warn"]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

Key decisions:
- `preset: "mobile"` — ROADMAP success criterion #2 mandates simulated mobile connection
- `numberOfRuns: 5` — mobile emulation has higher variance in headless CI; 5 runs damps it
- `url: ["https://demo.fastio.ru/"]` — staging tenant only (T-4-08: prod URL would screenshot real customer data into public LHCI storage)
- Pinned `@lhci/cli@0.14.0` — 0.15.x ships lighthouse@12.6.1 which requires Node≥22.19; CI uses Node 20

### `.github/workflows/ci.yml` (added `lhci` job)

New job after `security`:
- `needs: check` — runs after typecheck + lint + tests
- **NO** `if: github.ref == 'refs/heads/main'` — must run on PRs to block regressions before merge
- `timeout-minutes: 20` — 5 mobile Lighthouse runs ≈ 10 min + build overhead
- Node 20 (pinned) — Node 22 would silently upgrade to incompatible @lhci/cli
- `pnpm build --filter storefront` with only public Supabase keys (SEC-02: no service_role)
- `npx @lhci/cli@0.14.0 autorun` — reads `./lighthouserc.json` from repo root

## Verification Results

All automated checks passed:
- `node -e "require('./lighthouserc.json')"` — JSON valid
- LCP gated as `"error"` with `maxNumericValue: 2500` ✓
- CLS gated as `"error"` with `maxNumericValue: 0.1` ✓
- `preset: "mobile"` ✓, `numberOfRuns: 5` ✓
- `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` — YAML valid ✓
- `jobs.lhci.needs == "check"` ✓
- `jobs.lhci` has no `if:` key (runs on PRs) ✓
- `@lhci/cli@0.14.0` version pin present ✓
- No `NUXT_SUPABASE_SERVICE_ROLE_KEY` in lhci build env ✓

## Human Checkpoint

**Status:** Deferred — user will verify after merging.

Verification steps:
1. Open `https://demo.fastio.ru/` — must return 200 (not 503)
2. Confirm GitHub secrets: `NUXT_PUBLIC_SUPABASE_URL`, `NUXT_PUBLIC_SUPABASE_ANON_KEY` exist
3. Open a draft PR, confirm `Lighthouse CI` check appears
4. Wait for lhci job — confirm mobile preset, 5 runs, green on baseline
5. Optional: tank LCP with `loading="lazy"` on Hero — confirm job fails

## Deviations

None. Implementation follows PLAN.md + RESEARCH.md pattern 3 exactly.

## Self-Check: PASSED
