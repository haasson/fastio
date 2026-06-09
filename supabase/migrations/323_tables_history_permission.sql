-- Migration 323: выдать право просмотра истории столов (tables.history) ролям, управляющим столами.
--
-- Владелец (tenant_members.role_id IS NULL) видит историю всегда — has_permission()
-- даёт ему все права. Кастомным ролям право нужно выдать явно.
-- Критерий — наличие tables.manage (управление столами и бронями). Так покрываем
-- роли, которые и так распоряжаются столами, не завязываясь на имя.

-- Backfill-миграция не должна попадать в журнал действий — глушим audit-триггер на время UPDATE.
ALTER TABLE tenant_roles DISABLE TRIGGER audit_tenant_roles;

UPDATE tenant_roles
SET permissions = permissions || '{"tables.history": true}'::jsonb,
    updated_at = now()
WHERE (permissions->>'tables.manage')::boolean = true
  AND COALESCE((permissions->>'tables.history')::boolean, false) = false;

ALTER TABLE tenant_roles ENABLE TRIGGER audit_tenant_roles;
