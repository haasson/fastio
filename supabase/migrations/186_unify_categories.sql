-- Migration 186: унификация категорий — `service_categories` сливается в `categories`
-- через колонку `kind`. Прода нет, миграция деструктивная.

-- 1. Колонка kind: 'food' (по умолчанию для всех существующих) или 'service'
ALTER TABLE categories
  ADD COLUMN kind text NOT NULL DEFAULT 'food'
  CHECK (kind IN ('food', 'service'));

CREATE INDEX idx_categories_tenant_kind
  ON categories(tenant_id, kind) WHERE deleted_at IS NULL;

-- 2. Переносим существующие service_categories в categories с kind='service'.
--    id сохраняем — services.category_id остаётся валидным после смены FK.
INSERT INTO categories (id, tenant_id, name, sort_order, active, kind, created_at)
SELECT id, tenant_id, name, sort_order, active, 'service', created_at
FROM service_categories;

-- 3. services.category_id теперь смотрит на categories
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_category_id_fkey;
ALTER TABLE services
  ADD CONSTRAINT services_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;

-- 4. Дропаем старую таблицу
DROP TABLE service_categories CASCADE;
