---
phase: 02-observability
verified: 2026-05-21T14:00:00Z
status: human_needed
score: 8/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "An intentionally thrown server-side Nitro error appears in GlitchTip within 60 seconds with a readable stack trace and a tenant tag"
    expected: "Error visible in GlitchTip UI at errors.fastio.ru within 60s, stack trace is de-minified, issue shows tenant tag matching the slug of the storefront that was hit"
    why_human: "Requires a live deployed environment on Coolify + NUXT_PUBLIC_SENTRY_DSN + SENTRY_AUTH_TOKEN env vars set; Claude cannot deploy to Coolify or read the GlitchTip UI"
  - test: "A new error event in GlitchTip produces a Telegram message in the team ops channel within 5 minutes"
    expected: "Telegram message arrives in the ops alert chat (NUXT_TELEGRAM_ALERT_CHAT_ID) with issue title and link to errors.fastio.ru"
    why_human: "Requires GlitchTip native Telegram alert to be configured in the UI (Project -> Settings -> Alerts) and a live error event to trigger it; Claude cannot operate the GlitchTip UI or read the Telegram channel"
---

# Phase 2: Observability Verification Report

**Phase Goal:** Errors and downtime in production are immediately visible to the team without needing to dig through logs manually
**Verified:** 2026-05-21T14:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Intentionally thrown server-side Nitro error appears in GlitchTip within 60s with stack trace and tenant tag | ? UNCERTAIN | Code wiring verified; live round-trip requires human validation in deployed env |
| 2 | Telegram message arrives in team channel within 5 minutes when GlitchTip receives a new error event | ? UNCERTAIN | Runbook exists and is complete; actual integration configured in GlitchTip UI — requires human confirmation |
| 3 | Every composable calling supabase.channel() has a paired removeChannel(); grep audit returns zero violations | ✓ VERIFIED | `bash scripts/audit/realtime-channel-audit.sh` exits 0: "AUDIT_CLEAN: 3 file(s) checked" |

**Score:** 1/3 truths fully verified by code (2 are UNCERTAIN pending human validation)

### Roadmap Success Criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| SC-1 | Intentionally thrown server-side error in Nitro appears in GlitchTip within 60s, with stack trace and tenant slug tag | ? UNCERTAIN | Sentry wiring confirmed in code; live event requires deploy verification |
| SC-2 | Telegram message arrives in team channel within 5 minutes when GlitchTip receives a new error event | ? UNCERTAIN | Runbook complete; GlitchTip alert configuration is a UI-only step |
| SC-3 | Every composable calling supabase.channel() has paired removeChannel(); grep audit returns zero violations | ✓ VERIFIED | Script exits 0 on current tree; CI step confirmed in check job |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `docs/glitchtip-deploy.md` | Reproducible GlitchTip deployment runbook, min 40 lines | ✓ VERIFIED | 168 lines; covers compose stack (web/worker/postgres/redis), env vars, DNS, admin bootstrap, DSN extraction, ENABLE_OPEN_USER_REGISTRATION |
| `apps/storefront/nuxt.config.ts` | @sentry/nuxt module options: autoInstrument + source-map upload | ✓ VERIFIED | `sentry` block present with `autoInjectServerSentry: 'experimental_dynamic-import'`, `sentryUrl`, `org`, `project`, `authToken`, `telemetry: false` |
| `apps/admin/nuxt.config.ts` | @sentry/nuxt module options: autoInstrument + source-map upload | ✓ VERIFIED | Identical `sentry` block present |
| `apps/storefront/server/middleware/tenant.ts` | Sentry.setTag('tenant', tenant.slug) after successful resolve | ✓ VERIFIED | `setTag` called at line 39 (main resolve path) and line 157 (dev fallback path); guarded with `if (tenant.slug)` |
| `docs/glitchtip-telegram-alerts.md` | Runbook for GlitchTip native Telegram alert, min 25 lines | ✓ VERIFIED | 100 lines; covers GlitchTip UI path, reused env vars, latency target, notify-alert.post.ts separation note |
| `scripts/audit/realtime-channel-audit.sh` | Repo-wide realtime channel cleanup audit, exit 1 on violation, min 15 lines | ✓ VERIFIED | 46 lines; per-file co-presence check; `set -euo pipefail`; excludes node_modules/.output/.nuxt; exits 0 on current tree |
| `.github/workflows/ci.yml` | CI step invoking the realtime audit, contains "realtime" | ✓ VERIFIED | Step "realtime channel cleanup audit (REL-01)" present in `check` job, runs on both pull_request and push triggers |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/storefront/server/middleware/tenant.ts` | `@sentry/nuxt setTag` | `Sentry.setTag('tenant', tenant.slug)` after applyTenantToContext | ✓ WIRED | Lines 39 and 157; `import * as Sentry from '@sentry/nuxt'` at line 3; both resolve paths tagged |
| `apps/storefront/nuxt.config.ts` | GlitchTip source-map upload | `authToken` + `sentryUrl` in sentry block | ✓ WIRED | Module source confirms `url = moduleOptions.sentryUrl` (line 477); `authToken = moduleOptions.authToken` (line 473); upload enabled by default (`sourceMapsUploadOptions.enabled ?? true`) |
| `.github/workflows/ci.yml` | `scripts/audit/realtime-channel-audit.sh` | `run: bash scripts/audit/realtime-channel-audit.sh` | ✓ WIRED | Step name "realtime channel cleanup audit (REL-01)" in `check` job at lines 52-60; `check` job has no `if:` condition so runs on all triggers including pull_request |
| GlitchTip new-issue event | Telegram team channel | Native GlitchTip Telegram alert integration | ? UNCERTAIN | Runbook documents the configuration; actual integration configured in GlitchTip UI (UI-only step, not verifiable in code) |

### Data-Flow Trace (Level 4)

Not applicable — no dynamic-data rendering components in this phase. Artifacts are config files, a bash script, and server middleware.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Realtime audit exits 0 on current tree | `bash scripts/audit/realtime-channel-audit.sh` | "AUDIT_CLEAN: 3 file(s) checked" (exit 0) | ✓ PASS |
| CI YAML is valid | `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` | YAML_OK | ✓ PASS |
| CI check job runs on pull_request | Python YAML parse of `on:` triggers | `pull_request: {branches: [main]}` confirmed; `check` job has no `if:` condition | ✓ PASS |
| Sentry import in tenant middleware | `grep "from '@sentry/nuxt'" apps/storefront/server/middleware/tenant.ts` | Found at line 3 | ✓ PASS |
| setTag calls in tenant middleware | `grep -E "setTag\('tenant'" ...` | Lines 39 and 157 (both resolve paths) | ✓ PASS |
| @sentry/nuxt module registered in both apps | grep modules array | Present in both nuxt.config.ts files | ✓ PASS |

### Probe Execution

No probe scripts declared in PLAN files. Behavioral spot-checks above substitute.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| OBS-01 | 02-02 | GlitchTip self-hosted deployed in Coolify, @sentry/nuxt SDK configured with `--import` equivalent in start command, source maps uploaded on deploy | ✓ SATISFIED (code) / ? UNCERTAIN (live) | `autoInjectServerSentry: 'experimental_dynamic-import'` (equivalent to --import per module source line 802); `sentryUrl`+`authToken`+`org`+`project` configure source map upload; GlitchTip live confirmed by SUMMARY human checkpoint |
| OBS-02 | 02-03 | Telegram alerts — errors and downtime arrive in team Telegram bot | ? UNCERTAIN | Runbook complete; GlitchTip UI configuration not verifiable in code |
| REL-01 | 02-04 | Realtime channel cleanup audit — every composable using useRealtimeList/useRealtimeWatch has removeChannel in onUnmounted | ✓ SATISFIED | Script exits 0 on current tree (3 files audited); CI gate in check job (runs on PRs) |

### Deviation: autoInstrument vs autoInjectServerSentry

The plan specified `autoInstrument` and `autoUploadSourceMaps` as the option keys. The actual `@sentry/nuxt` 10.47.0 uses `autoInjectServerSentry` (for the --import equivalent) and derives source-map upload from the top-level `authToken`/`sentryUrl`/`org`/`project` options (no separate `autoUploadSourceMaps` key). The module source confirms this:

- `autoInjectServerSentry: 'experimental_dynamic-import'` → wraps Nitro entrypoint with dynamic import (equivalent to `--import` Node loader, line 802 of module.mjs)
- Source maps upload: `setupSourceMaps()` uses `moduleOptions.sentryUrl` as `url` and `moduleOptions.authToken` as `authToken`; enabled by default

The deviation is correct and type-verified. Behavior is equivalent to what the plan intended.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/storefront/nuxt.config.ts` | 58 | `// TECHDEBT.sentry-dsn:` | INFO | Pre-existing comment; marks that DSN comes from env (intentional design). Not a code debt marker — documents correct behavior |
| `apps/admin/nuxt.config.ts` | 125 | `// TECHDEBT.sentry-dsn:` | INFO | Same pre-existing comment as above |

No TBD/FIXME/XXX markers found in any phase-modified files. No stub patterns found.

### Human Verification Required

#### 1. Live Error Capture Round-Trip (OBS-01)

**Test:** With NUXT_PUBLIC_SENTRY_DSN and SENTRY_AUTH_TOKEN set in Coolify for both admin and storefront apps, throw a new error in a Nitro route (e.g. a temporary test endpoint). Hit the endpoint once from a real tenant subdomain.

**Expected:** Within 60 seconds, the GlitchTip UI at errors.fastio.ru shows a new issue with:
- A de-minified stack trace (source maps uploaded correctly)
- A `tenant` tag matching the slug of the storefront that was hit
- The issue is linked to the correct project

**Why human:** Requires a live Coolify deployment with real env vars, actual network path to errors.fastio.ru, and human inspection of the GlitchTip UI. No programmatic alternative.

#### 2. Telegram Alert End-to-End (OBS-02)

**Test:** Confirm the GlitchTip project at errors.fastio.ru has a Telegram alert configured (Project -> Settings -> Alerts) per docs/glitchtip-telegram-alerts.md. Trigger a new unique error (previously unseen fingerprint). Wait up to 5 minutes.

**Expected:** A Telegram message arrives in the ops alert chat (NUXT_TELEGRAM_ALERT_CHAT_ID) describing the new issue with a link back to errors.fastio.ru.

**Why human:** GlitchTip alert configuration is entirely in the GlitchTip UI — no code to verify. The Telegram channel delivery is an external observable that Claude cannot access.

### Gaps Summary

No blocking gaps. All code artifacts exist, are substantive, and are correctly wired. The two UNCERTAIN truths (SC-1 live error capture, SC-2 Telegram alert) reflect the nature of infrastructure work: the GlitchTip instance is deployed (confirmed by human checkpoint in SUMMARY), the Sentry SDK wiring is complete in code, and the Telegram runbook is correct. The phase goal requires human confirmation of the live alert path.

The only open question is whether the deployed Coolify environment has NUXT_PUBLIC_SENTRY_DSN and SENTRY_AUTH_TOKEN correctly set, and whether the GlitchTip Telegram alert was actually configured in the UI. Both were declared done in SUMMARY human checkpoints but cannot be verified programmatically.

---

_Verified: 2026-05-21T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
