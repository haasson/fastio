-- Fix delivery_zones RLS policies that were missed during
-- migration 109 (custom roles transition).
-- Old policies referenced has_tenant_role() which was dropped in 111.

DROP POLICY IF EXISTS "delivery_zones: admin can insert" ON delivery_zones;
DROP POLICY IF EXISTS "delivery_zones: admin can update" ON delivery_zones;
DROP POLICY IF EXISTS "delivery_zones: admin can delete" ON delivery_zones;

CREATE POLICY "delivery_zones: settings.edit can insert"
  ON delivery_zones FOR INSERT
  WITH CHECK (has_permission(tenant_id, 'settings.edit'));

CREATE POLICY "delivery_zones: settings.edit can update"
  ON delivery_zones FOR UPDATE
  USING (has_permission(tenant_id, 'settings.edit'));

CREATE POLICY "delivery_zones: settings.edit can delete"
  ON delivery_zones FOR DELETE
  USING (has_permission(tenant_id, 'settings.edit'));
