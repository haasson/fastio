---
plan: 02-02
phase: 02-observability
status: complete
completed: 2026-05-21
key-files:
  modified:
    - apps/storefront/nuxt.config.ts
    - apps/admin/nuxt.config.ts
    - apps/storefront/server/middleware/tenant.ts
---

## What Was Built

Wired `@sentry/nuxt` module to self-hosted GlitchTip in both storefront and admin. Server-side errors now ship to `https://errors.fastio.ru` with tenant slug tagged on every storefront error.

## Tasks

| Task | Status | Commit |
|------|--------|--------|
| Task 1: Sentry module config in both nuxt.config.ts | ✓ | 9afe99b6 |
| Task 2: Tenant tag in storefront server middleware | ✓ | 84aa4f9b |
| Task 3: Coolify env vars + deploy verify | ✓ | human checkpoint |

## Key Changes

**nuxt.config.ts (both apps):**
- Added `@sentry/nuxt/module` to modules array
- `sentry.autoInjectServerSentry: 'experimental_dynamic-import'` — wraps Nitro entrypoint so Sentry inits before app code
- `sentry.sentryUrl: 'https://errors.fastio.ru'` — self-hosted GlitchTip
- `sentry.telemetry: false` — no calls to sentry.io
- DSN from `NUXT_PUBLIC_SENTRY_DSN` env (already in runtimeConfig.public.sentryDsn)

**apps/storefront/server/middleware/tenant.ts:**
- `Sentry.setTag('tenant', tenant.slug)` on both resolve paths (cache-hit + fresh + dev fallback)

## Deviation

Plan specified `autoInstrument` / `autoUploadSourceMaps` keys but actual `@sentry/nuxt` 10.47.0 uses `autoInjectServerSentry`. Used type-verified key names. Behavior is equivalent.

## Coolify Env Vars Required

Set in both `apps/admin` and `apps/storefront` Coolify resources:
```
NUXT_PUBLIC_SENTRY_DSN=https://ed128ee63dd6428cbcbd656013216bbd@errors.fastio.ru/1
SENTRY_AUTH_TOKEN=<glitchtip-api-token>
SENTRY_ORG=fastio
SENTRY_PROJECT=fastio
```

## Self-Check: PASSED
