-- Fix delivery_zones RLS:
-- 1. Split FOR ALL into separate read/write policies
-- 2. Use is_tenant_member() for SELECT (respects blocked_until)
-- 3. Restrict writes to admin+ (consistent with branches table)

DROP POLICY IF EXISTS "Members can manage their delivery zones" ON delivery_zones;

CREATE POLICY "delivery_zones: member can select"
  ON delivery_zones FOR SELECT
  USING (is_tenant_member(tenant_id));

CREATE POLICY "delivery_zones: admin can insert"
  ON delivery_zones FOR INSERT
  WITH CHECK (has_tenant_role(tenant_id, 'admin'));

CREATE POLICY "delivery_zones: admin can update"
  ON delivery_zones FOR UPDATE
  USING (has_tenant_role(tenant_id, 'admin'));

CREATE POLICY "delivery_zones: admin can delete"
  ON delivery_zones FOR DELETE
  USING (has_tenant_role(tenant_id, 'admin'));
