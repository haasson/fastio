-- ============================================================
-- Migration 234: Add tenant_id to order_items for realtime filtering
-- ============================================================
-- Нужно для Supabase Realtime: фильтр `tenant_id=eq.X` в подписке
-- на order_items (useTableRealtime.ts) чтобы storefront получал
-- только события своего тенанта, а не всей системы.
-- ============================================================

ALTER TABLE order_items
  ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

-- Заполняем существующие строки через JOIN с orders
UPDATE order_items oi
SET tenant_id = o.tenant_id
FROM orders o
WHERE o.id = oi.order_id;

-- Делаем NOT NULL после заполнения (все order_items обязаны иметь tenant_id)
ALTER TABLE order_items
  ALTER COLUMN tenant_id SET NOT NULL;

-- Индекс для фильтрации в realtime и обычных запросах
CREATE INDEX idx_order_items_tenant_id ON order_items(tenant_id);

-- Заполнять tenant_id при INSERT автоматически через триггер
CREATE OR REPLACE FUNCTION order_items_set_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id
    FROM orders
    WHERE id = NEW.order_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_items_set_tenant_id
  BEFORE INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION order_items_set_tenant_id();
