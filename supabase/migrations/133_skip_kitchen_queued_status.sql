-- Migration 133: Insert skip_kitchen items as 'queued' instead of 'done'
--
-- Previously, items with skip_kitchen=true were inserted with status='done'
-- and completed_at=now(). This caused them to appear as already checked/crossed
-- out on the Assembly tab, and also allowed auto-advance of orders before
-- the assembler actually collected these items.
--
-- Now all items start as 'queued'. Skip_kitchen items still don't appear on
-- the kitchen queue (filtered by skip_kitchen=false), but assemblers must
-- explicitly mark them as collected.

-- ─── Update kitchen_queue_populate ──────────────────────────────

CREATE OR REPLACE FUNCTION kitchen_queue_populate(p_order_id uuid, p_tenant_id uuid, p_delivery_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _item       record;
  _combo_item record;
  _i          int;
  _skip       boolean;
BEGIN
  FOR _item IN
    SELECT * FROM order_items WHERE order_id = p_order_id
  LOOP
    IF _item.combo_id IS NOT NULL THEN
      IF _item.combo_items IS NOT NULL AND jsonb_array_length(_item.combo_items) > 0 THEN
        FOR _combo_item IN
          SELECT * FROM jsonb_to_recordset(_item.combo_items) AS x("dishName" text, "dishId" text)
        LOOP
          _skip := NOT COALESCE((SELECT requires_kitchen FROM dishes WHERE id = _combo_item."dishId"::uuid), true);
          FOR _i IN 1.._item.quantity LOOP
            INSERT INTO kitchen_queue (tenant_id, order_id, order_item_id, dish_name, dish_id, combo_id, combo_name, category_name, modifiers, addons, removed_ingredients, delivery_type, skip_kitchen, status)
            VALUES (p_tenant_id, p_order_id, _item.id, _combo_item."dishName", _combo_item."dishId"::uuid, _item.combo_id, _item.dish_name, _item.category_name, _item.modifiers, _item.addons, to_jsonb(_item.removed_ingredients), p_delivery_type, _skip, 'queued');
          END LOOP;
        END LOOP;
      ELSE
        FOR _combo_item IN
          SELECT ci.dish_id, d.name AS dish_name, d.requires_kitchen
          FROM combo_items ci
          JOIN dishes d ON d.id = ci.dish_id
          WHERE ci.combo_id = _item.combo_id
          ORDER BY ci.sort_order
        LOOP
          _skip := NOT COALESCE(_combo_item.requires_kitchen, true);
          FOR _i IN 1.._item.quantity LOOP
            INSERT INTO kitchen_queue (tenant_id, order_id, order_item_id, dish_name, dish_id, combo_id, combo_name, category_name, modifiers, addons, removed_ingredients, delivery_type, skip_kitchen, status)
            VALUES (p_tenant_id, p_order_id, _item.id, _combo_item.dish_name, _combo_item.dish_id, _item.combo_id, _item.dish_name, _item.category_name, _item.modifiers, _item.addons, to_jsonb(_item.removed_ingredients), p_delivery_type, _skip, 'queued');
          END LOOP;
        END LOOP;
      END IF;
    ELSE
      _skip := NOT COALESCE((SELECT requires_kitchen FROM dishes WHERE id = _item.dish_id), true);
      FOR _i IN 1.._item.quantity LOOP
        INSERT INTO kitchen_queue (tenant_id, order_id, order_item_id, dish_name, dish_id, combo_id, combo_name, category_name, modifiers, addons, removed_ingredients, delivery_type, skip_kitchen, status)
        VALUES (p_tenant_id, p_order_id, _item.id, _item.dish_name, _item.dish_id, NULL, NULL, _item.category_name, _item.modifiers, _item.addons, to_jsonb(_item.removed_ingredients), p_delivery_type, _skip, 'queued');
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

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
        FOR _i IN 1..NEW.quantity LOOP
          INSERT INTO kitchen_queue (tenant_id, order_id, order_item_id, dish_name, dish_id, combo_id, combo_name, category_name, modifiers, addons, removed_ingredients, delivery_type, skip_kitchen, status)
          VALUES (_order.tenant_id, _order.id, NEW.id, _combo_item."dishName", _combo_item."dishId"::uuid, NEW.combo_id, NEW.dish_name, NEW.category_name, NEW.modifiers, NEW.addons, to_jsonb(NEW.removed_ingredients), _order.delivery_type, _skip, 'queued');
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
        FOR _i IN 1..NEW.quantity LOOP
          INSERT INTO kitchen_queue (tenant_id, order_id, order_item_id, dish_name, dish_id, combo_id, combo_name, category_name, modifiers, addons, removed_ingredients, delivery_type, skip_kitchen, status)
          VALUES (_order.tenant_id, _order.id, NEW.id, _combo_item.dish_name, _combo_item.dish_id, NEW.combo_id, NEW.dish_name, NEW.category_name, NEW.modifiers, NEW.addons, to_jsonb(NEW.removed_ingredients), _order.delivery_type, _skip, 'queued');
        END LOOP;
      END LOOP;
    END IF;
  ELSE
    _skip := NOT COALESCE((SELECT requires_kitchen FROM dishes WHERE id = NEW.dish_id), true);
    FOR _i IN 1..NEW.quantity LOOP
      INSERT INTO kitchen_queue (tenant_id, order_id, order_item_id, dish_name, dish_id, combo_id, combo_name, category_name, modifiers, addons, removed_ingredients, delivery_type, skip_kitchen, status)
      VALUES (_order.tenant_id, _order.id, NEW.id, NEW.dish_name, NEW.dish_id, NULL, NULL, NEW.category_name, NEW.modifiers, NEW.addons, to_jsonb(NEW.removed_ingredients), _order.delivery_type, _skip, 'queued');
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
        FOR _i IN 1..NEW.quantity LOOP
          INSERT INTO kitchen_queue (tenant_id, order_id, order_item_id, dish_name, dish_id, combo_id, combo_name, category_name, modifiers, addons, removed_ingredients, delivery_type, skip_kitchen, status)
          VALUES (_order.tenant_id, _order.id, NEW.id, _combo_item."dishName", _combo_item."dishId"::uuid, NEW.combo_id, NEW.dish_name, NEW.category_name, NEW.modifiers, NEW.addons, to_jsonb(NEW.removed_ingredients), _order.delivery_type, _skip, 'queued');
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
        FOR _i IN 1..NEW.quantity LOOP
          INSERT INTO kitchen_queue (tenant_id, order_id, order_item_id, dish_name, dish_id, combo_id, combo_name, category_name, modifiers, addons, removed_ingredients, delivery_type, skip_kitchen, status)
          VALUES (_order.tenant_id, _order.id, NEW.id, _combo_item.dish_name, _combo_item.dish_id, NEW.combo_id, NEW.dish_name, NEW.category_name, NEW.modifiers, NEW.addons, to_jsonb(NEW.removed_ingredients), _order.delivery_type, _skip, 'queued');
        END LOOP;
      END LOOP;
    END IF;
  ELSE
    _skip := NOT COALESCE((SELECT requires_kitchen FROM dishes WHERE id = NEW.dish_id), true);
    FOR _i IN 1..NEW.quantity LOOP
      INSERT INTO kitchen_queue (tenant_id, order_id, order_item_id, dish_name, dish_id, combo_id, combo_name, category_name, modifiers, addons, removed_ingredients, delivery_type, skip_kitchen, status)
      VALUES (_order.tenant_id, _order.id, NEW.id, NEW.dish_name, NEW.dish_id, NULL, NULL, NEW.category_name, NEW.modifiers, NEW.addons, to_jsonb(NEW.removed_ingredients), _order.delivery_type, _skip, 'queued');
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;
