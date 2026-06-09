-- Migration 322: выдать право просмотра журнала действий (audit_log.view) админ-ролям.
--
-- Владелец (tenant_members.role_id IS NULL) видит журнал всегда — has_permission()
-- даёт ему все права. Кастомным ролям право нужно выдать явно.
-- Критерий «админ-роль» — наличие roles.manage (управление ролями). Так покрываем
-- дефолтную «Администратор» и любые кастомные админ-роли, не завязываясь на имя.

-- Backfill-миграция не должна попадать в журнал действий — глушим audit-триггер на время UPDATE.
ALTER TABLE tenant_roles DISABLE TRIGGER audit_tenant_roles;

UPDATE tenant_roles
SET permissions = permissions || '{"audit_log.view": true}'::jsonb,
    updated_at = now()
WHERE (permissions->>'roles.manage')::boolean = true
  AND COALESCE((permissions->>'audit_log.view')::boolean, false) = false;

ALTER TABLE tenant_roles ENABLE TRIGGER audit_tenant_roles;
