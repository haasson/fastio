-- Migration 136: Fix category_name for combo items in kitchen queue
--
-- Previously all dishes within a combo got the combo's category_name.
-- Now each dish gets its own category:
--   - snapshot path: reads "categoryName" from combo_items JSON
--   - DB lookup path: joins dishes → categories

-- ─── Helper: insert one order_item into kitchen_queue ─────────────

CREATE OR REPLACE FUNCTION _kitchen_queue_insert_item(
  p_tenant_id     uuid,
  p_order_id      uuid,
  p_item          record,
  p_delivery_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _combo_item record;
  _i          int;
  _skip       boolean;
BEGIN
  IF p_item.combo_id IS NOT NULL THEN
    IF p_item.combo_items IS NOT NULL AND jsonb_array_length(p_item.combo_items) > 0 THEN
      FOR _combo_item IN
        SELECT * FROM jsonb_to_recordset(p_item.combo_items) AS x("dishName" text, "dishId" text, "categoryName" text)
      LOOP
        _skip := NOT COALESCE((SELECT requires_kitchen FROM dishes WHERE id = _combo_item."dishId"::uuid), true);
        FOR _i IN 1..p_item.quantity LOOP
          INSERT INTO kitchen_queue (tenant_id, order_id, order_item_id, dish_name, dish_id, combo_id, combo_name, category_name, modifiers, addons, removed_ingredients, delivery_type, skip_kitchen, status)
          VALUES (p_tenant_id, p_order_id, p_item.id, _combo_item."dishName", _combo_item."dishId"::uuid, p_item.combo_id, p_item.dish_name, _combo_item."categoryName", p_item.modifiers, p_item.addons, to_jsonb(p_item.removed_ingredients), p_delivery_type, _skip, 'queued');
        END LOOP;
      END LOOP;
    ELSE
      FOR _combo_item IN
        SELECT ci.dish_id, d.name AS dish_name, d.requires_kitchen, c.name AS category_name
        FROM combo_items ci
        JOIN dishes d ON d.id = ci.dish_id
        LEFT JOIN categories c ON c.id = d.category_id
        WHERE ci.combo_id = p_item.combo_id
        ORDER BY ci.sort_order
      LOOP
        _skip := NOT COALESCE(_combo_item.requires_kitchen, true);
        FOR _i IN 1..p_item.quantity LOOP
          INSERT INTO kitchen_queue (tenant_id, order_id, order_item_id, dish_name, dish_id, combo_id, combo_name, category_name, modifiers, addons, removed_ingredients, delivery_type, skip_kitchen, status)
          VALUES (p_tenant_id, p_order_id, p_item.id, _combo_item.dish_name, _combo_item.dish_id, p_item.combo_id, p_item.dish_name, _combo_item.category_name, p_item.modifiers, p_item.addons, to_jsonb(p_item.removed_ingredients), p_delivery_type, _skip, 'queued');
        END LOOP;
      END LOOP;
    END IF;
  ELSE
    _skip := NOT COALESCE((SELECT requires_kitchen FROM dishes WHERE id = p_item.dish_id), true);
    FOR _i IN 1..p_item.quantity LOOP
      INSERT INTO kitchen_queue (tenant_id, order_id, order_item_id, dish_name, dish_id, combo_id, combo_name, category_name, modifiers, addons, removed_ingredients, delivery_type, skip_kitchen, status)
      VALUES (p_tenant_id, p_order_id, p_item.id, p_item.dish_name, p_item.dish_id, NULL, NULL, p_item.category_name, p_item.modifiers, p_item.addons, to_jsonb(p_item.removed_ingredients), p_delivery_type, _skip, 'queued');
    END LOOP;
  END IF;
END;
$$;

-- ─── kitchen_queue_populate ────────────────────────────────────────

CREATE OR REPLACE FUNCTION kitchen_queue_populate(p_order_id uuid, p_tenant_id uuid, p_delivery_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _item record;
BEGIN
  FOR _item IN
    SELECT * FROM order_items WHERE order_id = p_order_id
  LOOP
    PERFORM _kitchen_queue_insert_item(p_tenant_id, p_order_id, _item, p_delivery_type);
  END LOOP;
END;
$$;

-- ─── kitchen_queue_on_dine_in_item_insert ──────────────────────────

CREATE OR REPLACE FUNCTION kitchen_queue_on_dine_in_item_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _order           record;
  _kitchen_enabled boolean;
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

  PERFORM _kitchen_queue_insert_item(_order.tenant_id, _order.id, NEW, _order.delivery_type);

  RETURN NEW;
END;
$$;

-- ─── kitchen_queue_on_item_confirmed ───────────────────────────────

CREATE OR REPLACE FUNCTION kitchen_queue_on_item_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _order           record;
  _kitchen_enabled boolean;
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

  PERFORM _kitchen_queue_insert_item(_order.tenant_id, _order.id, NEW, _order.delivery_type);

  RETURN NEW;
END;
$$;
