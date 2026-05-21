---
status: partial
phase: 02-observability
source: [02-VERIFICATION.md]
started: 2026-05-21T14:00:00Z
updated: 2026-05-21T14:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live Error Capture Round-Trip (OBS-01 / SC-1)

**Setup:** NUXT_PUBLIC_SENTRY_DSN and SENTRY_AUTH_TOKEN set in Coolify for both admin and storefront apps. Throw a new error in a Nitro route (e.g. a temporary test endpoint), hit it from a real tenant subdomain.

expected: Within 60 seconds — GlitchTip UI at errors.fastio.ru shows a new issue with: de-minified stack trace (source maps uploaded), `tenant` tag matching the storefront slug, issue linked to correct project
result: [pending]

### 2. Telegram Alert End-to-End (OBS-02 / SC-2)

**Setup:** Confirm GlitchTip project at errors.fastio.ru has a Telegram alert configured (Project → Settings → Alerts) per docs/glitchtip-telegram-alerts.md. Trigger a new unique error (previously unseen fingerprint). Wait up to 5 minutes.

expected: A Telegram message arrives in the ops alert chat (NUXT_TELEGRAM_ALERT_CHAT_ID) with the new issue title and a link back to errors.fastio.ru
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
