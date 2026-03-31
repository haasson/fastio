-- ─────────────────────────────────────
-- Add missing permission keys to existing default roles
-- New keys: kitchen.view, tables.view, tables.manage,
--           reservations.view, reservations.manage,
--           content.view, content.edit
-- ─────────────────────────────────────

-- Администратор: all new permissions
UPDATE tenant_roles
SET permissions = permissions
  || '{"kitchen.view":true,"tables.view":true,"tables.manage":true,"reservations.view":true,"reservations.manage":true,"content.view":true,"content.edit":true}'::jsonb
WHERE name = 'Администратор' AND is_default = true;

-- Менеджер: kitchen, tables (view+manage), reservations (view+manage), content (view+edit)
UPDATE tenant_roles
SET permissions = permissions
  || '{"kitchen.view":true,"tables.view":true,"tables.manage":true,"reservations.view":true,"reservations.manage":true,"content.view":true,"content.edit":true}'::jsonb
WHERE name = 'Менеджер' AND is_default = true;

-- Сотрудник: kitchen, tables (view), reservations (view)
UPDATE tenant_roles
SET permissions = permissions
  || '{"kitchen.view":true,"tables.view":true,"reservations.view":true}'::jsonb
WHERE name = 'Сотрудник' AND is_default = true;

-- ─────────────────────────────────────
-- Update RLS: tables and table_call_types → tables.manage
-- ─────────────────────────────────────
DROP POLICY IF EXISTS "tables: settings.edit can insert" ON tables;
DROP POLICY IF EXISTS "tables: settings.edit can update" ON tables;
DROP POLICY IF EXISTS "tables: settings.edit can delete" ON tables;

CREATE POLICY "tables: tables.manage can insert"
  ON tables FOR INSERT
  WITH CHECK (has_permission(tenant_id, 'tables.manage'));

CREATE POLICY "tables: tables.manage can update"
  ON tables FOR UPDATE
  USING (has_permission(tenant_id, 'tables.manage'));

CREATE POLICY "tables: tables.manage can delete"
  ON tables FOR DELETE
  USING (has_permission(tenant_id, 'tables.manage'));

DROP POLICY IF EXISTS "table_call_types: settings.edit can insert" ON table_call_types;
DROP POLICY IF EXISTS "table_call_types: settings.edit can update" ON table_call_types;
DROP POLICY IF EXISTS "table_call_types: settings.edit can delete" ON table_call_types;

CREATE POLICY "table_call_types: tables.manage can insert"
  ON table_call_types FOR INSERT
  WITH CHECK (has_permission(tenant_id, 'tables.manage'));

CREATE POLICY "table_call_types: tables.manage can update"
  ON table_call_types FOR UPDATE
  USING (has_permission(tenant_id, 'tables.manage'));

CREATE POLICY "table_call_types: tables.manage can delete"
  ON table_call_types FOR DELETE
  USING (has_permission(tenant_id, 'tables.manage'));

-- ─────────────────────────────────────
-- Update trigger for new tenant default roles
-- ─────────────────────────────────────
CREATE OR REPLACE FUNCTION create_default_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO tenant_roles (tenant_id, name, is_default, permissions) VALUES
    (NEW.id, 'Администратор', true, '{"menu.view":true,"menu.edit":true,"menu.delete":true,"orders.view":true,"orders.create":true,"orders.edit":true,"orders.status":true,"orders.cancel":true,"kitchen.view":true,"tables.view":true,"tables.manage":true,"reservations.view":true,"reservations.manage":true,"promos.view":true,"promos.manage":true,"content.view":true,"content.edit":true,"team.view":true,"team.manage":true,"roles.manage":true,"settings.view":true,"settings.edit":true,"analytics.view":true}'),
    (NEW.id, 'Менеджер', true, '{"menu.view":true,"menu.edit":true,"menu.delete":true,"orders.view":true,"orders.create":true,"orders.edit":true,"orders.status":true,"orders.cancel":true,"kitchen.view":true,"tables.view":true,"tables.manage":true,"reservations.view":true,"reservations.manage":true,"promos.view":true,"promos.manage":true,"content.view":true,"content.edit":true,"team.view":true,"settings.view":true,"analytics.view":true}'),
    (NEW.id, 'Сотрудник', true, '{"menu.view":true,"orders.view":true,"orders.create":true,"orders.edit":true,"orders.status":true,"kitchen.view":true,"tables.view":true,"reservations.view":true}');
  RETURN NEW;
END;
$$;
