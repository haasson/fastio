-- ============================================================
-- Migration 043: Normalize orders — extract items, flatten customer
-- ============================================================

-- A) order_items table
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  dish_id uuid REFERENCES dishes(id) ON DELETE SET NULL,
  dish_name text NOT NULL,
  category_name text,
  price numeric(10,2) NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  removed_ingredients text[] DEFAULT '{}',
  modifiers jsonb DEFAULT '[]',
  sort_order int NOT NULL DEFAULT 0
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_dish_id ON order_items(dish_id) WHERE dish_id IS NOT NULL;

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_items_select" ON order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND is_tenant_member(o.tenant_id))
);

CREATE POLICY "order_items_insert" ON order_items FOR INSERT WITH CHECK (true);

CREATE POLICY "order_items_update" ON order_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND is_tenant_member(o.tenant_id))
);

CREATE POLICY "order_items_delete" ON order_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND is_tenant_member(o.tenant_id))
);

ALTER PUBLICATION supabase_realtime ADD TABLE order_items;

-- B) Flatten customer JSONB → columns on orders

ALTER TABLE orders ADD COLUMN customer_name text;
ALTER TABLE orders ADD COLUMN customer_phone text;
ALTER TABLE orders ADD COLUMN customer_email text;

-- Migrate existing data
UPDATE orders SET
  customer_name = customer->>'name',
  customer_phone = customer->>'phone'
WHERE customer IS NOT NULL;

UPDATE orders SET customer_name = '' WHERE customer_name IS NULL;
UPDATE orders SET customer_phone = '' WHERE customer_phone IS NULL;

ALTER TABLE orders ALTER COLUMN customer_name SET NOT NULL;
ALTER TABLE orders ALTER COLUMN customer_phone SET NOT NULL;

ALTER TABLE orders DROP COLUMN customer;
ALTER TABLE orders DROP COLUMN items;

CREATE INDEX idx_orders_customer_phone ON orders(tenant_id, customer_phone);

-- C) Currency on tenants

ALTER TABLE tenants ADD COLUMN currency text NOT NULL DEFAULT 'RUB';
