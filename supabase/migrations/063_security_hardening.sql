-- ============================================================
-- Migration 063: Security hardening — RLS tightening, SECURITY DEFINER fixes
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. get_user_emails — add co-tenant membership check
--    Previously any authenticated user could fetch emails for
--    arbitrary user IDs. Now only returns users who share at
--    least one tenant with the caller.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_user_emails(user_ids uuid[])
RETURNS TABLE(user_id uuid, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT u.id, u.email
  FROM auth.users u
  WHERE u.id = ANY(user_ids)
    AND EXISTS (
      SELECT 1
      FROM public.tenant_members tm1
      JOIN public.tenant_members tm2 ON tm1.tenant_id = tm2.tenant_id
      WHERE tm1.user_id = u.id
        AND tm2.user_id = auth.uid()
    );
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. get_user_profiles — same co-tenant check
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_user_profiles(user_ids uuid[])
RETURNS TABLE(user_id uuid, email text, full_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT u.id, u.email, u.raw_user_meta_data->>'full_name'
  FROM auth.users u
  WHERE u.id = ANY(user_ids)
    AND EXISTS (
      SELECT 1
      FROM public.tenant_members tm1
      JOIN public.tenant_members tm2 ON tm1.tenant_id = tm2.tenant_id
      WHERE tm1.user_id = u.id
        AND tm2.user_id = auth.uid()
    );
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. order_items INSERT — restrict to tenant members
--    Storefront uses service_role (bypasses RLS), so this only
--    blocks direct anon access via Supabase client.
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "order_items_insert" ON order_items;

CREATE POLICY "order_items_insert"
  ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
        AND is_tenant_member(o.tenant_id)
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 4. tables — tighten write to manager+, add DELETE policy
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "tables: members can insert" ON tables;
DROP POLICY IF EXISTS "tables: members can update" ON tables;

CREATE POLICY "tables: manager can insert"
  ON tables FOR INSERT
  WITH CHECK (has_tenant_role(tenant_id, 'manager'));

CREATE POLICY "tables: manager can update"
  ON tables FOR UPDATE
  USING (has_tenant_role(tenant_id, 'manager'));

CREATE POLICY "tables: manager can delete"
  ON tables FOR DELETE
  USING (has_tenant_role(tenant_id, 'manager'));

-- ─────────────────────────────────────────────────────────────
-- 5. combos — replace owner_id checks with has_tenant_role
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "combos: owner can insert" ON combos;
DROP POLICY IF EXISTS "combos: owner can update" ON combos;
DROP POLICY IF EXISTS "combos: owner can delete" ON combos;
DROP POLICY IF EXISTS "tenant combos" ON combos;

CREATE POLICY "combos: manager can insert"
  ON combos FOR INSERT
  WITH CHECK (has_tenant_role(tenant_id, 'manager'));

CREATE POLICY "combos: manager can update"
  ON combos FOR UPDATE
  USING (has_tenant_role(tenant_id, 'manager'));

CREATE POLICY "combos: manager can delete"
  ON combos FOR DELETE
  USING (has_tenant_role(tenant_id, 'manager'));

-- ─────────────────────────────────────────────────────────────
-- 6. combo_items — replace owner_id checks with has_tenant_role
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "combo_items: owner can insert" ON combo_items;
DROP POLICY IF EXISTS "combo_items: owner can update" ON combo_items;
DROP POLICY IF EXISTS "combo_items: owner can delete" ON combo_items;
DROP POLICY IF EXISTS "tenant combo_items" ON combo_items;

CREATE POLICY "combo_items: manager can insert"
  ON combo_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM combos c
      WHERE c.id = combo_id
        AND has_tenant_role(c.tenant_id, 'manager')
    )
  );

CREATE POLICY "combo_items: manager can update"
  ON combo_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM combos c
      WHERE c.id = combo_id
        AND has_tenant_role(c.tenant_id, 'manager')
    )
  );

CREATE POLICY "combo_items: manager can delete"
  ON combo_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM combos c
      WHERE c.id = combo_id
        AND has_tenant_role(c.tenant_id, 'manager')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 7. dish_tag_orders — replace owner_id checks with has_tenant_role
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "dish_tag_orders: owner can insert" ON dish_tag_orders;
DROP POLICY IF EXISTS "dish_tag_orders: owner can update" ON dish_tag_orders;
DROP POLICY IF EXISTS "dish_tag_orders: owner can delete" ON dish_tag_orders;

CREATE POLICY "dish_tag_orders: manager can insert"
  ON dish_tag_orders FOR INSERT
  WITH CHECK (has_tenant_role(tenant_id, 'manager'));

CREATE POLICY "dish_tag_orders: manager can update"
  ON dish_tag_orders FOR UPDATE
  USING (has_tenant_role(tenant_id, 'manager'));

CREATE POLICY "dish_tag_orders: manager can delete"
  ON dish_tag_orders FOR DELETE
  USING (has_tenant_role(tenant_id, 'manager'));
