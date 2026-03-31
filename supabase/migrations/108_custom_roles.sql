-- ─────────────────────────────────────
-- Таблица: кастомные роли тенанта
-- ─────────────────────────────────────
CREATE TABLE tenant_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{}',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_tenant_roles_tenant ON tenant_roles(tenant_id);

ALTER TABLE tenant_roles ENABLE ROW LEVEL SECURITY;

-- Все участники тенанта видят роли
CREATE POLICY "tenant_roles: member can select"
  ON tenant_roles FOR SELECT
  USING (is_tenant_member(tenant_id));

-- Временно: admin+ через has_tenant_role, заменим в Task 2
CREATE POLICY "tenant_roles: admin can insert"
  ON tenant_roles FOR INSERT
  WITH CHECK (has_tenant_role(tenant_id, 'admin'));

CREATE POLICY "tenant_roles: admin can update"
  ON tenant_roles FOR UPDATE
  USING (has_tenant_role(tenant_id, 'admin'));

CREATE POLICY "tenant_roles: admin can delete"
  ON tenant_roles FOR DELETE
  USING (has_tenant_role(tenant_id, 'admin'));

-- ─────────────────────────────────────
-- Добавляем role_id в tenant_members
-- ─────────────────────────────────────
ALTER TABLE tenant_members ADD COLUMN role_id uuid REFERENCES tenant_roles(id) ON DELETE RESTRICT;

-- ─────────────────────────────────────
-- Добавляем role_id в tenant_invitations
-- ─────────────────────────────────────
ALTER TABLE tenant_invitations ADD COLUMN role_id uuid REFERENCES tenant_roles(id) ON DELETE RESTRICT;

-- ─────────────────────────────────────
-- Создаём дефолтные роли для каждого тенанта
-- ─────────────────────────────────────
INSERT INTO tenant_roles (tenant_id, name, is_default, permissions)
SELECT id, 'Администратор', true, '{
  "menu.view": true, "menu.edit": true, "menu.delete": true,
  "orders.view": true, "orders.create": true, "orders.edit": true, "orders.status": true, "orders.cancel": true,
  "promos.view": true, "promos.manage": true,
  "team.view": true, "team.manage": true, "roles.manage": true,
  "settings.view": true, "settings.edit": true,
  "analytics.view": true
}'::jsonb
FROM tenants;

INSERT INTO tenant_roles (tenant_id, name, is_default, permissions)
SELECT id, 'Менеджер', true, '{
  "menu.view": true, "menu.edit": true, "menu.delete": true,
  "orders.view": true, "orders.create": true, "orders.edit": true, "orders.status": true, "orders.cancel": true,
  "promos.view": true, "promos.manage": true,
  "team.view": true,
  "settings.view": true,
  "analytics.view": true
}'::jsonb
FROM tenants;

INSERT INTO tenant_roles (tenant_id, name, is_default, permissions)
SELECT id, 'Сотрудник', true, '{
  "menu.view": true,
  "orders.view": true, "orders.create": true, "orders.edit": true, "orders.status": true
}'::jsonb
FROM tenants;

-- ─────────────────────────────────────
-- Мигрируем существующих мемберов: role → role_id
-- Owner получает role_id = NULL (определяется отдельно)
-- ─────────────────────────────────────
UPDATE tenant_members tm
SET role_id = tr.id
FROM tenant_roles tr
WHERE tr.tenant_id = tm.tenant_id
  AND tm.role = 'admin'
  AND tr.name = 'Администратор';

UPDATE tenant_members tm
SET role_id = tr.id
FROM tenant_roles tr
WHERE tr.tenant_id = tm.tenant_id
  AND tm.role = 'manager'
  AND tr.name = 'Менеджер';

UPDATE tenant_members tm
SET role_id = tr.id
FROM tenant_roles tr
WHERE tr.tenant_id = tm.tenant_id
  AND tm.role = 'staff'
  AND tr.name = 'Сотрудник';

-- Owner: role_id остаётся NULL

-- ─────────────────────────────────────
-- Мигрируем инвайты: role → role_id
-- ─────────────────────────────────────
UPDATE tenant_invitations ti
SET role_id = tr.id
FROM tenant_roles tr
WHERE tr.tenant_id = ti.tenant_id
  AND ti.role = 'admin'
  AND tr.name = 'Администратор'
  AND ti.accepted_at IS NULL;

UPDATE tenant_invitations ti
SET role_id = tr.id
FROM tenant_roles tr
WHERE tr.tenant_id = ti.tenant_id
  AND ti.role = 'manager'
  AND tr.name = 'Менеджер'
  AND ti.accepted_at IS NULL;

UPDATE tenant_invitations ti
SET role_id = tr.id
FROM tenant_roles tr
WHERE tr.tenant_id = ti.tenant_id
  AND ti.role = 'staff'
  AND tr.name = 'Сотрудник'
  AND ti.accepted_at IS NULL;

-- ─────────────────────────────────────
-- Helper: is_owner — проверяет что текущий юзер владелец тенанта
-- ─────────────────────────────────────
CREATE OR REPLACE FUNCTION is_tenant_owner(_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_members
    WHERE tenant_id = _tenant_id
      AND user_id = auth.uid()
      AND role_id IS NULL
      AND (blocked_until IS NULL OR blocked_until < now())
  );
$$;

-- ─────────────────────────────────────
-- Helper: has_permission — проверяет конкретный пермишен
-- Owner всегда возвращает true
-- ─────────────────────────────────────
CREATE OR REPLACE FUNCTION has_permission(_tenant_id uuid, _permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    -- Owner: role_id IS NULL → all permissions
    SELECT 1 FROM tenant_members
    WHERE tenant_id = _tenant_id
      AND user_id = auth.uid()
      AND role_id IS NULL
      AND (blocked_until IS NULL OR blocked_until < now())
  )
  OR EXISTS (
    -- Custom role: check specific permission
    SELECT 1 FROM tenant_members tm
    JOIN tenant_roles tr ON tr.id = tm.role_id
    WHERE tm.tenant_id = _tenant_id
      AND tm.user_id = auth.uid()
      AND (tm.blocked_until IS NULL OR tm.blocked_until < now())
      AND (tr.permissions->>_permission)::boolean = true
  );
$$;
