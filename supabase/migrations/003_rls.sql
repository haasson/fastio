-- Включаем RLS на всех таблицах
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────
-- TENANTS
-- Читать и менять может только владелец
-- ─────────────────────────────────────
CREATE POLICY "tenants: owner can select"
  ON tenants FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "tenants: owner can update"
  ON tenants FOR UPDATE
  USING (owner_id = auth.uid());

-- ─────────────────────────────────────
-- CATEGORIES
-- Читать — все (публично для витрины)
-- Писать — только владелец тенанта
-- ─────────────────────────────────────
CREATE POLICY "categories: public read"
  ON categories FOR SELECT
  USING (true);

CREATE POLICY "categories: owner can insert"
  ON categories FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM tenants WHERE id = tenant_id AND owner_id = auth.uid())
  );

CREATE POLICY "categories: owner can update"
  ON categories FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM tenants WHERE id = tenant_id AND owner_id = auth.uid())
  );

CREATE POLICY "categories: owner can delete"
  ON categories FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM tenants WHERE id = tenant_id AND owner_id = auth.uid())
  );

-- ─────────────────────────────────────
-- DISHES
-- Читать — все, писать — только владелец
-- ─────────────────────────────────────
CREATE POLICY "dishes: public read"
  ON dishes FOR SELECT
  USING (true);

CREATE POLICY "dishes: owner can insert"
  ON dishes FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM tenants WHERE id = tenant_id AND owner_id = auth.uid())
  );

CREATE POLICY "dishes: owner can update"
  ON dishes FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM tenants WHERE id = tenant_id AND owner_id = auth.uid())
  );

CREATE POLICY "dishes: owner can delete"
  ON dishes FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM tenants WHERE id = tenant_id AND owner_id = auth.uid())
  );

-- ─────────────────────────────────────
-- ORDERS
-- Создавать — все (анонимные покупатели)
-- Читать и обновлять — только владелец тенанта
-- ─────────────────────────────────────
CREATE POLICY "orders: anyone can insert"
  ON orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "orders: owner can select"
  ON orders FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM tenants WHERE id = tenant_id AND owner_id = auth.uid())
  );

CREATE POLICY "orders: owner can update"
  ON orders FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM tenants WHERE id = tenant_id AND owner_id = auth.uid())
  );

-- ─────────────────────────────────────
-- PROMOTIONS
-- Читать — все, писать — только владелец
-- ─────────────────────────────────────
CREATE POLICY "promotions: public read"
  ON promotions FOR SELECT
  USING (true);

CREATE POLICY "promotions: owner can insert"
  ON promotions FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM tenants WHERE id = tenant_id AND owner_id = auth.uid())
  );

CREATE POLICY "promotions: owner can update"
  ON promotions FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM tenants WHERE id = tenant_id AND owner_id = auth.uid())
  );

CREATE POLICY "promotions: owner can delete"
  ON promotions FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM tenants WHERE id = tenant_id AND owner_id = auth.uid())
  );

-- ─────────────────────────────────────
-- PROMO CODES
-- Читать — все (для применения на витрине)
-- Писать — только владелец
-- ─────────────────────────────────────
CREATE POLICY "promo_codes: public read"
  ON promo_codes FOR SELECT
  USING (true);

CREATE POLICY "promo_codes: owner can insert"
  ON promo_codes FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM tenants WHERE id = tenant_id AND owner_id = auth.uid())
  );

CREATE POLICY "promo_codes: owner can update"
  ON promo_codes FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM tenants WHERE id = tenant_id AND owner_id = auth.uid())
  );

CREATE POLICY "promo_codes: owner can delete"
  ON promo_codes FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM tenants WHERE id = tenant_id AND owner_id = auth.uid())
  );
