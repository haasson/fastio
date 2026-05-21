---
plan: 01-03
phase: 01-security-foundation
status: complete
completed: 2026-05-21
tasks_total: 3
tasks_complete: 3
key-files:
  created:
    - supabase/migrations/302_fix_edge_alerts_rls.sql
  modified:
    - .github/workflows/migrate.yml
---

## Summary

Закрыта последняя public-таблица без RLS (`edge_alerts_state`) и добавлен CI-аудит в `migrate.yml`, который блокирует воркфлоу если любая из 46 TENANT_TABLES регрессирует в `rowsecurity=false`.

## Tasks

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Создать миграцию 302 | ✓ | ALTER TABLE edge_alerts_state ENABLE ROW LEVEL SECURITY; без политик |
| 2 | Добавить RLS-аудит в migrate.yml | ✓ | Внутри существующего шага, reuse $SSH/$DB_CT |
| 3 | [CHECKPOINT] Применить локально и верифицировать | ✓ | edge_alerts_state\|t; аудит-запрос — 0 строк |

## Verification

- `edge_alerts_state` → `relrowsecurity=true` (подтверждено через psql после применения миграции) ✓
- Аудит-запрос по 46 TENANT_TABLES возвращает 0 строк ✓
- `migrate.yml` парсится как валидный YAML ✓
- Миграция 302 содержит ровно 1 `ALTER TABLE` и 0 `CREATE POLICY` ✓
- `TABLES_MISSING_RLS`, `::error::RLS audit FAILED`, `RLS audit PASSED` — все три строки присутствуют в `migrate.yml` ✓
- `edge_alerts_state` НЕ включена в ARRAY аудита (нет tenant_id; это не TENANT_TABLE) ✓

## Key Decisions

- **Без политик**: default-deny для anon/authenticated; `pg_cron` через SECURITY DEFINER обходит RLS — не сломать мониторинг.
- **Аудит внутри существующего шага**: reuse `$SSH` и `$DB_CT` из того же `run: |` блока — без дополнительных SSH-хендшейков (Pitfall 2).
- **TECHDEBT**: ARRAY в аудите дублирует TENANT_TABLES из `tenantDb.ts` — задокументировано inline, авто-генерация отложена.

## Self-Check: PASSED
