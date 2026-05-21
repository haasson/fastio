# Phase 1: Security Foundation - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Tenant isolation является надёжной, service-role ключ не попадает в браузерный бандл, система громко падает на мисконфиге вместо того чтобы тихо отдавать чужие данные.

Scope: SEC-01 (RLS audit), SEC-02 (service-role CI check), SEC-03 (tenant middleware hardening), SEC-04 (staging Supabase project).
E2E-тесты, observability, performance — отдельные фазы.

</domain>

<decisions>
## Implementation Decisions

### SEC-01 — RLS Audit

- **D-01:** Скоуп аудита — все таблицы из TENANT_TABLES (40+ таблиц с tenant_id). Shared-таблицы без tenant_id (tenants, memberships, plan_features, processed_webhook_events) — отдельный проход: если rowsecurity=false, документируем как intentional (доступны только через service-role, anon key не добирается).
- **D-02:** Remediation для TENANT_TABLES: `ALTER TABLE x ENABLE ROW LEVEL SECURITY` + restrictive policy — аутентифицированные пользователи видят только строки своего тенанта через join с `tenant_members`. Service-role политики не нужны (service_role байпасит RLS).
- **D-03:** CI enforcement: audit query в migrate.yml после применения миграций — выходит с ошибкой если находит таблицы из TENANT_TABLES с rowsecurity=false. Блокирует merge.

### SEC-02 — Service-role CI Check

- **D-04:** Отдельный `security` job в CI, запускается только на push в main (не на PR — экономим время). Делает `pnpm build --filter storefront`, затем grep по `.output/public/` на строку `service_role`. Ненулевой выход блокирует деплой.
- **D-05:** Сканируем только storefront: это SSR-приложение с service-role в Nitro server-коде. Admin — SPA с anon key, риск другой.

### SEC-03 — Tenant Middleware Hardening

- **D-06:** Неизвестный домен (тенант не найден в БД при обоих успешных запросах) → 503, не 404. Текущее поведение: `createError({ statusCode: 404 })` меняется на 503. Мотивация: не раскрываем факт существования/отсутствия тенанта; 503 сигнализирует retry-able для load balancer.
- **D-07:** Полностью отсутствующий Host-заголовок (пустой domain после strip port) → 503 с message `'Missing or invalid Host header'`. Добавить явную проверку до DB lookup.
- **D-08:** `getTenantDb()` при отсутствующем tenantId меняет 400 → 500 (Internal Server Error). Мотивация: отсутствие tenant в context — это баг сервера (middleware не сработал), не ошибка клиента. 500 попадает в GlitchTip/Sentry.

### SEC-04 — Staging Supabase Project

- **D-09:** Новый Supabase Cloud проект (free tier) — постоянный staging, изолированный от prod. Staging credentials хранятся в GH Secrets: `SUPABASE_STAGING_URL`, `SUPABASE_STAGING_SERVICE_ROLE_KEY`, `SUPABASE_STAGING_ANON_KEY`.
- **D-10:** Миграции на staging применяются через `supabase db push --db-url $STAGING_DB_URL` в отдельном step migrate.yml (или отдельный workflow). Первичное применение — разово руками через Supabase dashboard / CLI.
- **D-11:** Seed-данные: `supabase/seed.sql` с фиксированными фикстурами (1 тенант, 1 owner, 1 branch, базовые позиции меню). E2E-тесты применяют seed через Playwright globalSetup.
- **D-12:** Очистка БД перед E2E-раном: Playwright globalSetup truncates tenant-data tables через service-role API (без ssh, без supabase CLI). Порядок truncate по FK-зависимостям.

### Claude's Discretion

- Точная SQL-форма RLS-политик (будет выведена из pattern в суще>ствующих миграциях RLS)
- Конкретный список таблиц для truncate в globalSetup (по результатам аудита)
- Naming staging-проекта (fastio-staging)
- Таймаут и retry-count для `supabase db push` в CI

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Security — текущая реализация
- `apps/storefront/server/middleware/tenant.ts` — текущая логика tenant resolution (меняем 404→503, добавляем host-check)
- `apps/storefront/server/utils/tenantDb.ts` — getTenantDb(), TENANT_TABLES set (меняем 400→500)
- `apps/storefront/server/utils/__tests__/tenantTablesDrift.test.ts` — drift-check тест (нужно убедиться что покрывает аудит)

### CI pipeline
- `.github/workflows/ci.yml` — текущий CI (добавляем security job)
- `.github/workflows/migrate.yml` — pipeline миграций (добавляем audit query step)

### Supabase миграции (RLS-примеры)
- Поискать в `supabase/migrations/` существующие `CREATE POLICY` / `ENABLE ROW LEVEL SECURITY` — взять как паттерн для новых политик

### Requirements
- `.planning/REQUIREMENTS.md` §Security — SEC-01..SEC-04 с acceptance criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TENANT_TABLES` set в `tenantDb.ts:19` — готовый список tenant-таблиц для аудита (40+ таблиц)
- `tenantTablesDrift.test.ts` — уже содержит логику сравнения TENANT_TABLES с information_schema, можно переиспользовать audit query
- `supabase/migrations/300_audit_logs_cleanup.sql` — пример pg_cron job, паттерн для CI audit query

### Established Patterns
- Все существующие миграции нумеруются 3-значно: `NNN_description.sql`. Новые RLS-миграции будут `302_rls_*.sql`, `303_...` и т.д.
- migrate.yml применяет SQL через psql в docker: можно дописать audit query step в конец `Apply pending migrations` или отдельным step
- GH Actions secrets уже настроены: `VPS_SSH_KEY`, `VPS_HOST` — новые staging secrets добавляем по аналогии

### Integration Points
- Новый security-job в ci.yml: запускается после основного check job, использует `needs: check`
- Playwright E2E (Phase 3): будет зависеть от staging environment (SEC-04) — staging должен быть готов до Phase 3
- migrate.yml: audit query добавляется как последний step, блокирует при ошибке

</code_context>

<specifics>
## Specific Ideas

- Для SEC-02: grep команда — `grep -r "service_role" apps/storefront/.output/public/ && echo "FAIL: service_role found in bundle" && exit 1 || echo "OK"`
- Для SEC-03: явная проверка пустого host — `if (!domain) throw createError({ statusCode: 503, message: 'Missing or invalid Host header' })`
- Для SEC-04: при truncate порядок важен — сначала таблицы с FK (order_items, order_events), потом orders, потом tenants/branches

</specifics>

<deferred>
## Deferred Ideas

- Storefront Supabase client untyped (`as unknown as SomeType` casts) — CONCERNS.md упоминает, но это не security Phase 1, это техдолг
- `processed_webhook_events` TTL — TECHDEBT, Phase 5 или отдельная задача
- TENANT_TABLES auto-generation at build time — улучшение drift-check, v2

</deferred>

---

*Phase: 01-security-foundation*
*Context gathered: 2026-05-21*
