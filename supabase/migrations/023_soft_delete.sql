-- =============================================
-- Soft delete: deleted_at на dishes, categories, promotions, promo_codes
-- =============================================

-- 1. Добавляем колонку deleted_at
ALTER TABLE dishes ADD COLUMN deleted_at timestamptz;
ALTER TABLE categories ADD COLUMN deleted_at timestamptz;
ALTER TABLE promotions ADD COLUMN deleted_at timestamptz;
ALTER TABLE promo_codes ADD COLUMN deleted_at timestamptz;

-- 2. Индексы для фильтрации (partial index — только живые записи)
CREATE INDEX idx_dishes_not_deleted ON dishes(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_categories_not_deleted ON categories(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_promotions_not_deleted ON promotions(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_promo_codes_not_deleted ON promo_codes(tenant_id) WHERE deleted_at IS NULL;

-- =============================================
-- 3. RLS: обновляем public SELECT — скрываем удалённое
-- =============================================

-- categories
DROP POLICY IF EXISTS "categories: public read" ON categories;
CREATE POLICY "categories: public read"
  ON categories FOR SELECT
  USING (deleted_at IS NULL);

-- dishes
DROP POLICY IF EXISTS "dishes: public read" ON dishes;
CREATE POLICY "dishes: public read"
  ON dishes FOR SELECT
  USING (deleted_at IS NULL);

-- promotions
DROP POLICY IF EXISTS "promotions: public read" ON promotions;
CREATE POLICY "promotions: public read"
  ON promotions FOR SELECT
  USING (deleted_at IS NULL);

-- promo_codes
DROP POLICY IF EXISTS "promo_codes: public read" ON promo_codes;
CREATE POLICY "promo_codes: public read"
  ON promo_codes FOR SELECT
  USING (deleted_at IS NULL);

-- =============================================
-- 4. RLS: мемберы видят всё (включая удалённое) для восстановления
-- =============================================

CREATE POLICY "categories: member can select all"
  ON categories FOR SELECT
  USING (is_tenant_member(tenant_id));

CREATE POLICY "dishes: member can select all"
  ON dishes FOR SELECT
  USING (is_tenant_member(tenant_id));

CREATE POLICY "promotions: member can select all"
  ON promotions FOR SELECT
  USING (is_tenant_member(tenant_id));

CREATE POLICY "promo_codes: member can select all"
  ON promo_codes FOR SELECT
  USING (is_tenant_member(tenant_id));

-- =============================================
-- 5. Убираем DELETE политики (только soft delete через UPDATE)
-- =============================================

DROP POLICY IF EXISTS "categories: manager can delete" ON categories;
DROP POLICY IF EXISTS "dishes: manager can delete" ON dishes;
DROP POLICY IF EXISTS "promotions: manager can delete" ON promotions;
DROP POLICY IF EXISTS "promo_codes: manager can delete" ON promo_codes;
