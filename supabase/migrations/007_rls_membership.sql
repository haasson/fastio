-- ─────────────────────────────────────
-- Удаляем все старые owner-based политики из 003_rls.sql
-- ─────────────────────────────────────

-- tenants
DROP POLICY IF EXISTS "tenants: owner can select" ON tenants;
DROP POLICY IF EXISTS "tenants: owner can update" ON tenants;

-- categories
DROP POLICY IF EXISTS "categories: public read" ON categories;
DROP POLICY IF EXISTS "categories: owner can insert" ON categories;
DROP POLICY IF EXISTS "categories: owner can update" ON categories;
DROP POLICY IF EXISTS "categories: owner can delete" ON categories;

-- dishes
DROP POLICY IF EXISTS "dishes: public read" ON dishes;
DROP POLICY IF EXISTS "dishes: owner can insert" ON dishes;
DROP POLICY IF EXISTS "dishes: owner can update" ON dishes;
DROP POLICY IF EXISTS "dishes: owner can delete" ON dishes;

-- orders
DROP POLICY IF EXISTS "orders: anyone can insert" ON orders;
DROP POLICY IF EXISTS "orders: owner can select" ON orders;
DROP POLICY IF EXISTS "orders: owner can update" ON orders;

-- promotions
DROP POLICY IF EXISTS "promotions: public read" ON promotions;
DROP POLICY IF EXISTS "promotions: owner can insert" ON promotions;
DROP POLICY IF EXISTS "promotions: owner can update" ON promotions;
DROP POLICY IF EXISTS "promotions: owner can delete" ON promotions;

-- promo_codes
DROP POLICY IF EXISTS "promo_codes: public read" ON promo_codes;
DROP POLICY IF EXISTS "promo_codes: owner can insert" ON promo_codes;
DROP POLICY IF EXISTS "promo_codes: owner can update" ON promo_codes;
DROP POLICY IF EXISTS "promo_codes: owner can delete" ON promo_codes;

-- ─────────────────────────────────────
-- TENANTS — membership-based
-- ─────────────────────────────────────
CREATE POLICY "tenants: member can select"
  ON tenants FOR SELECT
  USING (is_tenant_member(id));

CREATE POLICY "tenants: admin can update"
  ON tenants FOR UPDATE
  USING (has_tenant_role(id, 'admin'));

-- ─────────────────────────────────────
-- CATEGORIES — public read, manager+ write
-- ─────────────────────────────────────
CREATE POLICY "categories: public read"
  ON categories FOR SELECT
  USING (true);

CREATE POLICY "categories: manager can insert"
  ON categories FOR INSERT
  WITH CHECK (has_tenant_role(tenant_id, 'manager'));

CREATE POLICY "categories: manager can update"
  ON categories FOR UPDATE
  USING (has_tenant_role(tenant_id, 'manager'));

CREATE POLICY "categories: manager can delete"
  ON categories FOR DELETE
  USING (has_tenant_role(tenant_id, 'manager'));

-- ─────────────────────────────────────
-- DISHES — public read, manager+ write
-- ─────────────────────────────────────
CREATE POLICY "dishes: public read"
  ON dishes FOR SELECT
  USING (true);

CREATE POLICY "dishes: manager can insert"
  ON dishes FOR INSERT
  WITH CHECK (has_tenant_role(tenant_id, 'manager'));

CREATE POLICY "dishes: manager can update"
  ON dishes FOR UPDATE
  USING (has_tenant_role(tenant_id, 'manager'));

CREATE POLICY "dishes: manager can delete"
  ON dishes FOR DELETE
  USING (has_tenant_role(tenant_id, 'manager'));

-- ─────────────────────────────────────
-- ORDERS — public insert, any member read/update
-- ─────────────────────────────────────
CREATE POLICY "orders: anyone can insert"
  ON orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "orders: member can select"
  ON orders FOR SELECT
  USING (is_tenant_member(tenant_id));

CREATE POLICY "orders: member can update"
  ON orders FOR UPDATE
  USING (is_tenant_member(tenant_id));

-- ─────────────────────────────────────
-- PROMOTIONS — public read, manager+ write
-- ─────────────────────────────────────
CREATE POLICY "promotions: public read"
  ON promotions FOR SELECT
  USING (true);

CREATE POLICY "promotions: manager can insert"
  ON promotions FOR INSERT
  WITH CHECK (has_tenant_role(tenant_id, 'manager'));

CREATE POLICY "promotions: manager can update"
  ON promotions FOR UPDATE
  USING (has_tenant_role(tenant_id, 'manager'));

CREATE POLICY "promotions: manager can delete"
  ON promotions FOR DELETE
  USING (has_tenant_role(tenant_id, 'manager'));

-- ─────────────────────────────────────
-- PROMO CODES — public read, manager+ write
-- ─────────────────────────────────────
CREATE POLICY "promo_codes: public read"
  ON promo_codes FOR SELECT
  USING (true);

CREATE POLICY "promo_codes: manager can insert"
  ON promo_codes FOR INSERT
  WITH CHECK (has_tenant_role(tenant_id, 'manager'));

CREATE POLICY "promo_codes: manager can update"
  ON promo_codes FOR UPDATE
  USING (has_tenant_role(tenant_id, 'manager'));

CREATE POLICY "promo_codes: manager can delete"
  ON promo_codes FOR DELETE
  USING (has_tenant_role(tenant_id, 'manager'));
