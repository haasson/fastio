---
plan: 02-01
phase: 02-observability
status: complete
completed: 2026-05-21
key-files:
  created:
    - docs/glitchtip-deploy.md
---

## What Was Built

GlitchTip instance live at https://errors.fastio.ru. Self-hosted on existing VPS (109.71.242.205) via Coolify Docker Compose stack: web / worker / postgres / redis. Wildcard cert *.fastio.ru covers the subdomain automatically via Traefik.

Deployment runbook written at `docs/glitchtip-deploy.md` — covers compose stack, env vars, DNS, admin bootstrap, and DSN extraction.

## Tasks

| Task | Status | Commit |
|------|--------|--------|
| Task 1: GlitchTip deployment runbook | ✓ | c8e3c204 |
| Task 2: Deploy + admin account + project DSN | ✓ | human checkpoint |

## Verification

- https://errors.fastio.ru — reachable over HTTPS (wildcard cert) ✓
- Admin account: admin@fastio.ru ✓
- ENABLE_OPEN_USER_REGISTRATION=false ✓
- Project DSN: `https://ed128ee63dd6428cbcbd656013216bbd@errors.fastio.ru/1` ✓

## Notes

- Django migrations did not run automatically on first start — ran manually via `docker exec python manage.py migrate`
- Admin user created via CLI (`createsuperuser`) since registration form was not visible despite ENABLE_OPEN_USER_REGISTRATION=true — GlitchTip hides registration when accessed from non-localhost; CLI bootstrap is the correct approach
- DNS A record added: errors.fastio.ru → 109.71.242.205

## DSN for downstream plans

```
https://ed128ee63dd6428cbcbd656013216bbd@errors.fastio.ru/1
```

Plans 02-02 and 02-03 consume this DSN.

## Self-Check: PASSED
