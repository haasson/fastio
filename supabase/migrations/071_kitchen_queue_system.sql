-- Migration 071: Kitchen queue system
--
-- Full dish-level kitchen conveyor: queue table, triggers for auto-populating
-- queue on order status change (delivery/pickup) and on item insert (dine_in),
-- auto-transition of order status when all dishes are done.

-- ─── Schema changes on existing tables ──────────────────────────────

-- Item-level completion tracking
ALTER TABLE order_items ADD COLUMN completed_at timestamptz;

-- Combo items snapshot (dishes inside combo at order time)
ALTER TABLE order_items ADD COLUMN combo_items jsonb;

-- Kitchen urgency threshold (minutes)
ALTER TABLE tenants ADD COLUMN kitchen_urgency_minutes int NOT NULL DEFAULT 15;

-- Kitchen config (source status, completed status map)
ALTER TABLE tenants ADD COLUMN kitchen_config jsonb NOT NULL DEFAULT '{}';

-- ─── Kitchen queue table ────────────────────────────────────────────

CREATE TABLE kitchen_queue (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id            uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id       uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  dish_name           text NOT NULL,
  dish_id             uuid,
  combo_id            uuid,
  combo_name          text,
  category_name       text,
  modifiers           jsonb NOT NULL DEFAULT '[]',
  addons              jsonb NOT NULL DEFAULT '[]',
  removed_ingredients jsonb NOT NULL DEFAULT '[]',
  delivery_type       text NOT NULL CHECK (delivery_type IN ('delivery', 'pickup', 'dine_in')),
  status              text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'in_progress', 'done', 'served')),
  assigned_to         uuid REFERENCES auth.users(id),
  assigned_at         timestamptz,
  completed_at        timestamptz,
  served_at           timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_kitchen_queue_tenant_status ON kitchen_queue(tenant_id, status);
CREATE INDEX idx_kitchen_queue_order ON kitchen_queue(order_id);

-- ─── RLS + Realtime ─────────────────────────────────────────────────

ALTER TABLE kitchen_queue ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE kitchen_queue;

CREATE POLICY "kitchen_queue: member can select"
  ON kitchen_queue FOR SELECT USING (is_tenant_member(tenant_id));

CREATE POLICY "kitchen_queue: member can update"
  ON kitchen_queue FOR UPDATE USING (is_tenant_member(tenant_id));

-- ─── Shared helper: populate kitchen_queue from order_items ─────────

CREATE OR REPLACE FUNCTION kitchen_queue_populate(p_order_id uuid, p_tenant_id uuid, p_delivery_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _item       record;
  _combo_item record;
  _i          int;
BEGIN
  FOR _item IN
    SELECT * FROM order_items WHERE order_id = p_order_id
  LOOP
    IF _item.combo_id IS NOT NULL THEN
      IF _item.combo_items IS NOT NULL AND jsonb_array_length(_item.combo_items) > 0 THEN
        FOR _combo_item IN
          SELECT * FROM jsonb_to_recordset(_item.combo_items) AS x("dishName" text)
        LOOP
          FOR _i IN 1.._item.quantity LOOP
            INSERT INTO kitchen_queue (tenant_id, order_id, order_item_id, dish_name, dish_id, combo_id, combo_name, category_name, modifiers, addons, removed_ingredients, delivery_type)
            VALUES (p_tenant_id, p_order_id, _item.id, _combo_item."dishName", NULL, _item.combo_id, _item.dish_name, _item.category_name, _item.modifiers, _item.addons, to_jsonb(_item.removed_ingredients), p_delivery_type);
          END LOOP;
        END LOOP;
      ELSE
        FOR _combo_item IN
          SELECT ci.dish_id, d.name AS dish_name
          FROM combo_items ci
          JOIN dishes d ON d.id = ci.dish_id
          WHERE ci.combo_id = _item.combo_id
          ORDER BY ci.sort_order
        LOOP
          FOR _i IN 1.._item.quantity LOOP
            INSERT INTO kitchen_queue (tenant_id, order_id, order_item_id, dish_name, dish_id, combo_id, combo_name, category_name, modifiers, addons, removed_ingredients, delivery_type)
            VALUES (p_tenant_id, p_order_id, _item.id, _combo_item.dish_name, _combo_item.dish_id, _item.combo_id, _item.dish_name, _item.category_name, _item.modifiers, _item.addons, to_jsonb(_item.removed_ingredients), p_delivery_type);
          END LOOP;
        END LOOP;
      END IF;
    ELSE
      FOR _i IN 1.._item.quantity LOOP
        INSERT INTO kitchen_queue (tenant_id, order_id, order_item_id, dish_name, dish_id, combo_id, combo_name, category_name, modifiers, addons, removed_ingredients, delivery_type)
        VALUES (p_tenant_id, p_order_id, _item.id, _item.dish_name, _item.dish_id, NULL, NULL, _item.category_name, _item.modifiers, _item.addons, to_jsonb(_item.removed_ingredients), p_delivery_type);
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

-- ─── Trigger: order status change → populate queue (delivery/pickup) ─

CREATE OR REPLACE FUNCTION kitchen_queue_on_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _config     jsonb;
  _source_id  text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT kitchen_config INTO _config FROM tenants WHERE id = NEW.tenant_id;
  _source_id := _config ->> 'sourceStatusId';

  IF _source_id IS NULL OR NEW.status != _source_id THEN
    RETURN NEW;
  END IF;

  -- Idempotent
  IF EXISTS (SELECT 1 FROM kitchen_queue WHERE order_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  PERFORM kitchen_queue_populate(NEW.id, NEW.tenant_id, NEW.delivery_type);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_kitchen_queue_on_order_status
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION kitchen_queue_on_order_status();

-- ─── Trigger: dine_in item insert → queue each item individually ────

CREATE OR REPLACE FUNCTION kitchen_queue_on_dine_in_item_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _order           record;
  _kitchen_enabled boolean;
  _combo_item      record;
  _i               int;
BEGIN
  SELECT id, tenant_id, delivery_type
  INTO _order
  FROM orders
  WHERE id = NEW.order_id;

  IF _order.delivery_type != 'dine_in' THEN
    RETURN NEW;
  END IF;

  SELECT (modules ->> 'kitchen')::boolean INTO _kitchen_enabled
  FROM tenants WHERE id = _order.tenant_id;

  IF NOT COALESCE(_kitchen_enabled, false) THEN
    RETURN NEW;
  END IF;

  -- Idempotent
  IF EXISTS (SELECT 1 FROM kitchen_queue WHERE order_item_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  IF NEW.combo_id IS NOT NULL THEN
    IF NEW.combo_items IS NOT NULL AND jsonb_array_length(NEW.combo_items) > 0 THEN
      FOR _combo_item IN
        SELECT * FROM jsonb_to_recordset(NEW.combo_items) AS x("dishName" text)
      LOOP
        FOR _i IN 1..NEW.quantity LOOP
          INSERT INTO kitchen_queue (tenant_id, order_id, order_item_id, dish_name, dish_id, combo_id, combo_name, category_name, modifiers, addons, removed_ingredients, delivery_type)
          VALUES (_order.tenant_id, _order.id, NEW.id, _combo_item."dishName", NULL, NEW.combo_id, NEW.dish_name, NEW.category_name, NEW.modifiers, NEW.addons, to_jsonb(NEW.removed_ingredients), _order.delivery_type);
        END LOOP;
      END LOOP;
    ELSE
      FOR _combo_item IN
        SELECT ci.dish_id, d.name AS dish_name
        FROM combo_items ci
        JOIN dishes d ON d.id = ci.dish_id
        WHERE ci.combo_id = NEW.combo_id
        ORDER BY ci.sort_order
      LOOP
        FOR _i IN 1..NEW.quantity LOOP
          INSERT INTO kitchen_queue (tenant_id, order_id, order_item_id, dish_name, dish_id, combo_id, combo_name, category_name, modifiers, addons, removed_ingredients, delivery_type)
          VALUES (_order.tenant_id, _order.id, NEW.id, _combo_item.dish_name, _combo_item.dish_id, NEW.combo_id, NEW.dish_name, NEW.category_name, NEW.modifiers, NEW.addons, to_jsonb(NEW.removed_ingredients), _order.delivery_type);
        END LOOP;
      END LOOP;
    END IF;
  ELSE
    FOR _i IN 1..NEW.quantity LOOP
      INSERT INTO kitchen_queue (tenant_id, order_id, order_item_id, dish_name, dish_id, combo_id, combo_name, category_name, modifiers, addons, removed_ingredients, delivery_type)
      VALUES (_order.tenant_id, _order.id, NEW.id, NEW.dish_name, NEW.dish_id, NULL, NULL, NEW.category_name, NEW.modifiers, NEW.addons, to_jsonb(NEW.removed_ingredients), _order.delivery_type);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_kitchen_queue_dine_in_item_insert
  AFTER INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION kitchen_queue_on_dine_in_item_insert();

-- ─── Trigger: all dishes done → auto-transition order status ────────

CREATE OR REPLACE FUNCTION kitchen_queue_check_order_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _all_done      boolean;
  _config        jsonb;
  _completed_map jsonb;
  _delivery_type text;
  _target_id     text;
  _tenant_id     uuid;
  _old_status    text;
  _old_name      text;
  _new_name      text;
BEGIN
  IF NEW.status != 'done' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM kitchen_queue
    WHERE order_id = NEW.order_id
      AND status NOT IN ('done', 'served')
  ) INTO _all_done;

  IF NOT _all_done THEN
    RETURN NEW;
  END IF;

  SELECT t.kitchen_config, o.delivery_type, o.tenant_id, o.status
  INTO _config, _delivery_type, _tenant_id, _old_status
  FROM orders o
  JOIN tenants t ON t.id = o.tenant_id
  WHERE o.id = NEW.order_id;

  _completed_map := _config -> 'completedStatusMap';

  IF _completed_map IS NULL THEN
    RETURN NEW;
  END IF;

  _target_id := _completed_map ->> _delivery_type;

  IF _target_id IS NOT NULL THEN
    SELECT name INTO _old_name FROM order_statuses WHERE id = _old_status::uuid;
    SELECT name INTO _new_name FROM order_statuses WHERE id = _target_id::uuid;

    UPDATE orders SET status = _target_id WHERE id = NEW.order_id;

    INSERT INTO order_events (order_id, tenant_id, actor_id, actor_name, actor_role, event_type, meta)
    VALUES (
      NEW.order_id, _tenant_id, NULL, 'Кухня', NULL, 'status_changed',
      jsonb_build_object('from_id', _old_status, 'from_name', _old_name, 'to_id', _target_id, 'to_name', _new_name, 'auto', true)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_kitchen_queue_check_complete
  AFTER UPDATE ON kitchen_queue
  FOR EACH ROW
  EXECUTE FUNCTION kitchen_queue_check_order_complete();
