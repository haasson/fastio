-- Migration 149: Auto-serve dine_in items with skip_kitchen=true
--
-- For dine_in orders, items with requires_kitchen=false have no flow to
-- get marked as served — kitchen tab filters them out (skip_kitchen=false),
-- assembly tab excludes dine_in orders. They hang as 'queued' forever.
--
-- Fix: insert dine_in skip_kitchen items with status='served' immediately.
-- Delivery/pickup skip_kitchen items keep status='queued' (assembler handles them).
--
-- Also fixes existing stuck records.

-- ─── Fix existing stuck dine_in skip_kitchen items ──────────────

UPDATE kitchen_queue kq
SET
  status     = 'served',
  served_at  = COALESCE(kq.created_at, now()),
  served_by  = NULL
FROM orders o
WHERE kq.order_id   = o.id
  AND o.delivery_type = 'dine_in'
  AND kq.skip_kitchen = true
  AND kq.status       = 'queued';

-- ─── Update dine_in insert trigger ──────────────────────────────

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
  _skip            boolean;
  _status          text;
  _served_at       timestamptz;
BEGIN
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

  IF EXISTS (SELECT 1 FROM kitchen_queue WHERE order_item_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  IF NEW.combo_id IS NOT NULL THEN
    IF NEW.combo_items IS NOT NULL AND jsonb_array_length(NEW.combo_items) > 0 THEN
      FOR _combo_item IN
        SELECT * FROM jsonb_to_recordset(NEW.combo_items) AS x("dishName" text, "dishId" text)
      LOOP
        _skip := NOT COALESCE((SELECT requires_kitchen FROM dishes WHERE id = _combo_item."dishId"::uuid), true);
        _status := CASE WHEN _skip THEN 'served' ELSE 'queued' END;
        _served_at := CASE WHEN _skip THEN now() ELSE NULL END;
        FOR _i IN 1..NEW.quantity LOOP
          INSERT INTO kitchen_queue (tenant_id, order_id, order_item_id, dish_name, dish_id, combo_id, combo_name, category_name, modifiers, addons, removed_ingredients, delivery_type, skip_kitchen, status, served_at)
          VALUES (_order.tenant_id, _order.id, NEW.id, _combo_item."dishName", _combo_item."dishId"::uuid, NEW.combo_id, NEW.dish_name, NEW.category_name, NEW.modifiers, NEW.addons, to_jsonb(NEW.removed_ingredients), _order.delivery_type, _skip, _status, _served_at);
        END LOOP;
      END LOOP;
    ELSE
      FOR _combo_item IN
        SELECT ci.dish_id, d.name AS dish_name, d.requires_kitchen
        FROM combo_items ci
        JOIN dishes d ON d.id = ci.dish_id
        WHERE ci.combo_id = NEW.combo_id
        ORDER BY ci.sort_order
      LOOP
        _skip := NOT COALESCE(_combo_item.requires_kitchen, true);
        _status := CASE WHEN _skip THEN 'served' ELSE 'queued' END;
        _served_at := CASE WHEN _skip THEN now() ELSE NULL END;
        FOR _i IN 1..NEW.quantity LOOP
          INSERT INTO kitchen_queue (tenant_id, order_id, order_item_id, dish_name, dish_id, combo_id, combo_name, category_name, modifiers, addons, removed_ingredients, delivery_type, skip_kitchen, status, served_at)
          VALUES (_order.tenant_id, _order.id, NEW.id, _combo_item.dish_name, _combo_item.dish_id, NEW.combo_id, NEW.dish_name, NEW.category_name, NEW.modifiers, NEW.addons, to_jsonb(NEW.removed_ingredients), _order.delivery_type, _skip, _status, _served_at);
        END LOOP;
      END LOOP;
    END IF;
  ELSE
    _skip := NOT COALESCE((SELECT requires_kitchen FROM dishes WHERE id = NEW.dish_id), true);
    _status := CASE WHEN _skip THEN 'served' ELSE 'queued' END;
    _served_at := CASE WHEN _skip THEN now() ELSE NULL END;
    FOR _i IN 1..NEW.quantity LOOP
      INSERT INTO kitchen_queue (tenant_id, order_id, order_item_id, dish_name, dish_id, combo_id, combo_name, category_name, modifiers, addons, removed_ingredients, delivery_type, skip_kitchen, status, served_at)
      VALUES (_order.tenant_id, _order.id, NEW.id, NEW.dish_name, NEW.dish_id, NULL, NULL, NEW.category_name, NEW.modifiers, NEW.addons, to_jsonb(NEW.removed_ingredients), _order.delivery_type, _skip, _status, _served_at);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- ─── Update item confirmation trigger ───────────────────────────

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
  _skip            boolean;
  _status          text;
  _served_at       timestamptz;
BEGIN
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

  IF EXISTS (SELECT 1 FROM kitchen_queue WHERE order_item_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  IF NEW.combo_id IS NOT NULL THEN
    IF NEW.combo_items IS NOT NULL AND jsonb_array_length(NEW.combo_items) > 0 THEN
      FOR _combo_item IN
        SELECT * FROM jsonb_to_recordset(NEW.combo_items) AS x("dishName" text, "dishId" text)
      LOOP
        _skip := NOT COALESCE((SELECT requires_kitchen FROM dishes WHERE id = _combo_item."dishId"::uuid), true);
        _status := CASE WHEN _skip THEN 'served' ELSE 'queued' END;
        _served_at := CASE WHEN _skip THEN now() ELSE NULL END;
        FOR _i IN 1..NEW.quantity LOOP
          INSERT INTO kitchen_queue (tenant_id, order_id, order_item_id, dish_name, dish_id, combo_id, combo_name, category_name, modifiers, addons, removed_ingredients, delivery_type, skip_kitchen, status, served_at)
          VALUES (_order.tenant_id, _order.id, NEW.id, _combo_item."dishName", _combo_item."dishId"::uuid, NEW.combo_id, NEW.dish_name, NEW.category_name, NEW.modifiers, NEW.addons, to_jsonb(NEW.removed_ingredients), _order.delivery_type, _skip, _status, _served_at);
        END LOOP;
      END LOOP;
    ELSE
      FOR _combo_item IN
        SELECT ci.dish_id, d.name AS dish_name, d.requires_kitchen
        FROM combo_items ci
        JOIN dishes d ON d.id = ci.dish_id
        WHERE ci.combo_id = NEW.combo_id
        ORDER BY ci.sort_order
      LOOP
        _skip := NOT COALESCE(_combo_item.requires_kitchen, true);
        _status := CASE WHEN _skip THEN 'served' ELSE 'queued' END;
        _served_at := CASE WHEN _skip THEN now() ELSE NULL END;
        FOR _i IN 1..NEW.quantity LOOP
          INSERT INTO kitchen_queue (tenant_id, order_id, order_item_id, dish_name, dish_id, combo_id, combo_name, category_name, modifiers, addons, removed_ingredients, delivery_type, skip_kitchen, status, served_at)
          VALUES (_order.tenant_id, _order.id, NEW.id, _combo_item.dish_name, _combo_item.dish_id, NEW.combo_id, NEW.dish_name, NEW.category_name, NEW.modifiers, NEW.addons, to_jsonb(NEW.removed_ingredients), _order.delivery_type, _skip, _status, _served_at);
        END LOOP;
      END LOOP;
    END IF;
  ELSE
    _skip := NOT COALESCE((SELECT requires_kitchen FROM dishes WHERE id = NEW.dish_id), true);
    _status := CASE WHEN _skip THEN 'served' ELSE 'queued' END;
    _served_at := CASE WHEN _skip THEN now() ELSE NULL END;
    FOR _i IN 1..NEW.quantity LOOP
      INSERT INTO kitchen_queue (tenant_id, order_id, order_item_id, dish_name, dish_id, combo_id, combo_name, category_name, modifiers, addons, removed_ingredients, delivery_type, skip_kitchen, status, served_at)
      VALUES (_order.tenant_id, _order.id, NEW.id, NEW.dish_name, NEW.dish_id, NULL, NULL, NEW.category_name, NEW.modifiers, NEW.addons, to_jsonb(NEW.removed_ingredients), _order.delivery_type, _skip, _status, _served_at);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;
