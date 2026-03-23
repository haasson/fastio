-- Migration 082: Employee tracking & order item confirmation
--
-- Adds tracking columns for who added/confirmed items, accepted orders,
-- and served dishes. Updates kitchen trigger to respect item status.

-- ─── New columns ──────────────────────────────────────────

-- order_items: who added, who confirmed, item status
ALTER TABLE order_items ADD COLUMN added_by uuid REFERENCES auth.users(id);
ALTER TABLE order_items ADD COLUMN confirmed_by uuid REFERENCES auth.users(id);
ALTER TABLE order_items ADD COLUMN status text NOT NULL DEFAULT 'confirmed'
  CHECK (status IN ('pending', 'confirmed'));

-- orders: who accepted (operator for delivery/pickup)
ALTER TABLE orders ADD COLUMN accepted_by uuid REFERENCES auth.users(id);

-- kitchen_queue: who served
ALTER TABLE kitchen_queue ADD COLUMN served_by uuid REFERENCES auth.users(id);

-- ─── Update dine_in insert trigger: skip pending items ────

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
  -- Skip pending items — they go to kitchen only after confirmation
  IF NEW.status = 'pending' THEN
    RETURN NEW;
  END IF;

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

-- ─── New trigger: on item confirmation → send to kitchen ──

CREATE OR REPLACE FUNCTION kitchen_queue_on_item_confirmed()
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
  -- Only fire when status changes from pending to confirmed
  IF OLD.status != 'pending' OR NEW.status != 'confirmed' THEN
    RETURN NEW;
  END IF;

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

CREATE TRIGGER trg_kitchen_queue_on_item_confirmed
  AFTER UPDATE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION kitchen_queue_on_item_confirmed();
