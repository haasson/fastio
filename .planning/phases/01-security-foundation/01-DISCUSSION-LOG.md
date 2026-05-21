# Phase 1: Security Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-05-21
**Phase:** 01-security-foundation
**Mode:** discuss
**Areas discussed:** RLS audit scope & remediation, Staging environment, Tenant middleware

---

## Areas Discussed

### RLS Audit

| Question | Options | Selection |
|----------|---------|-----------|
| Какой объём RLS-аудита? | Только TENANT_TABLES / Все public-таблицы / Только критические (orders, customers) | "прими решение сам" — пользователь делегировал |

**Claude's decision:** Аудит всех TENANT_TABLES (40+ таблиц) + проход по shared-таблицам для документирования intentional no-RLS. Remediation — restrictive policy через memberships join.

### Staging Environment

| Question | Options | Selection |
|----------|---------|-----------|
| Cloud vs docker-in-CI | Supabase Cloud / Docker ephemeral | Supabase Cloud |
| Seed approach | SQL seed.sql / Playwright globalSetup via API | SQL seed.sql |
| Reset approach | API truncate через service-role / psql via supabase CLI | API truncate через service-role |

### Tenant Middleware

| Question | Options | Selection |
|----------|---------|-----------|
| 404 vs 503 для неизвестного хоста | 503 для любого неразрешённого / 404 семантически правильнее | 503 для любого |
| getTenantDb 400 vs 500 | 500 Internal / 400 оставить | 500 |

---

## Claude's Discretion

- **CI bundle scan scope:** Только storefront (не admin) — admin SPA с anon key, риск другой. Security-job только на push в main (экономия CI minutes).
- **RLS policy form:** Будет выведена из существующих migration-паттернов в supabase/migrations/.
- **Staging project naming:** fastio-staging.
- **TENANT_TABLES truncate order:** по FK-зависимостям (order_items → orders → tenants/branches).

---

## Deferred Ideas

- Storefront Supabase client untyped — техдолг, не Phase 1
- processed_webhook_events TTL — TECHDEBT, отдельная задача
- TENANT_TABLES auto-generation — улучшение, v2
