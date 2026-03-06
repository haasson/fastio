-- 1. order_statuses table
CREATE TABLE order_statuses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  group_type text NOT NULL CHECK (group_type IN ('new', 'in_progress', 'completed', 'cancelled')),
  position int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 2. Index for ordering
CREATE INDEX idx_order_statuses_tenant_position ON order_statuses(tenant_id, position);

-- 3. RLS
ALTER TABLE order_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view order statuses" ON order_statuses
  FOR SELECT USING (is_tenant_member(tenant_id));
CREATE POLICY "manager+ can insert order statuses" ON order_statuses
  FOR INSERT WITH CHECK (has_tenant_role(tenant_id, 'manager'));
CREATE POLICY "manager+ can update order statuses" ON order_statuses
  FOR UPDATE USING (has_tenant_role(tenant_id, 'manager'));
CREATE POLICY "manager+ can delete order statuses" ON order_statuses
  FOR DELETE USING (has_tenant_role(tenant_id, 'manager'));

-- 4. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE order_statuses;

-- 5. Drop old CHECK constraint on orders.status (was enum-style text values)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- 6. Seed default statuses for all existing tenants
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    INSERT INTO order_statuses (tenant_id, name, group_type, position) VALUES
      (t.id, 'Новый',       'new',         0),
      (t.id, 'Принят',      'in_progress', 1),
      (t.id, 'Готовится',   'in_progress', 2),
      (t.id, 'Готов',       'in_progress', 3),
      (t.id, 'Доставляется','in_progress', 4),
      (t.id, 'Выполнен',    'completed',   5),
      (t.id, 'Отменён',     'cancelled',   6);
  END LOOP;
END $$;

-- 7. Migrate orders.status from text enum values → UUID of new statuses
DO $$
DECLARE
  t record;
  s_new         uuid;
  s_accepted    uuid;
  s_cooking     uuid;
  s_ready       uuid;
  s_delivering  uuid;
  s_completed   uuid;
  s_cancelled   uuid;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    SELECT id INTO s_new        FROM order_statuses WHERE tenant_id = t.id AND name = 'Новый'        LIMIT 1;
    SELECT id INTO s_accepted   FROM order_statuses WHERE tenant_id = t.id AND name = 'Принят'       LIMIT 1;
    SELECT id INTO s_cooking    FROM order_statuses WHERE tenant_id = t.id AND name = 'Готовится'    LIMIT 1;
    SELECT id INTO s_ready      FROM order_statuses WHERE tenant_id = t.id AND name = 'Готов'        LIMIT 1;
    SELECT id INTO s_delivering FROM order_statuses WHERE tenant_id = t.id AND name = 'Доставляется' LIMIT 1;
    SELECT id INTO s_completed  FROM order_statuses WHERE tenant_id = t.id AND name = 'Выполнен'     LIMIT 1;
    SELECT id INTO s_cancelled  FROM order_statuses WHERE tenant_id = t.id AND name = 'Отменён'      LIMIT 1;

    UPDATE orders SET status = s_new::text        WHERE tenant_id = t.id AND status = 'new';
    UPDATE orders SET status = s_accepted::text   WHERE tenant_id = t.id AND status = 'accepted';
    UPDATE orders SET status = s_cooking::text    WHERE tenant_id = t.id AND status = 'cooking';
    UPDATE orders SET status = s_ready::text      WHERE tenant_id = t.id AND status = 'ready';
    UPDATE orders SET status = s_delivering::text WHERE tenant_id = t.id AND status = 'delivering';
    UPDATE orders SET status = s_completed::text  WHERE tenant_id = t.id AND status = 'completed';
    UPDATE orders SET status = s_cancelled::text  WHERE tenant_id = t.id AND status = 'cancelled';
  END LOOP;
END $$;
