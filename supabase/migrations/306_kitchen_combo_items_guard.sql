-- 306_kitchen_combo_items_guard.sql
-- Robustness: combo_items может оказаться jsonb-`null` (json-скаляр), а не SQL NULL
-- или массивом — например когда update_order_with_items реинсёртит позицию и
-- кладёт item->'combo_items' как jsonb null. Старый гард `combo_items IS NOT NULL
-- AND jsonb_array_length(combo_items) > 0` пропускал jsonb-null (он != SQL NULL) и
-- падал с 22023 "cannot get array length of a scalar", роняя сохранение/populate
-- комбо-заказа.
--
-- Fix:
--   1) Consumers (populate-хелпер + dine_in insert/confirm триггеры): гард на
--      jsonb_typeof(combo_items) = 'array' — NULL и jsonb-null корректно пропускаются.
--   2) Writers (update_order_with_items, create_order_with_items_atomic): нормализуем
--      item->'combo_items' — не-массив пишем как NULL, чтобы плохие данные не оседали.
--
-- Функции переопределены через pg_get_functiondef (актуальные тела) + точечная правка.

-- ── _kitchen_queue_insert_item ──
CREATE OR REPLACE FUNCTION public._kitchen_queue_insert_item(p_tenant_id uuid, p_order_id uuid, p_item record, p_delivery_type text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _combo_item record;
  _i          int;
  _skip       boolean;
BEGIN
  IF p_item.combo_id IS NOT NULL THEN
    IF jsonb_typeof(p_item.combo_items) = 'array' AND jsonb_array_length(p_item.combo_items) > 0 THEN
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
$function$;

-- ── kitchen_queue_on_dine_in_item_insert ──
CREATE OR REPLACE FUNCTION public.kitchen_queue_on_dine_in_item_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    IF jsonb_typeof(NEW.combo_items) = 'array' AND jsonb_array_length(NEW.combo_items) > 0 THEN
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
$function$;

-- ── kitchen_queue_on_item_confirmed ──
CREATE OR REPLACE FUNCTION public.kitchen_queue_on_item_confirmed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    IF jsonb_typeof(NEW.combo_items) = 'array' AND jsonb_array_length(NEW.combo_items) > 0 THEN
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
$function$;

-- ── update_order_with_items ──
CREATE OR REPLACE FUNCTION public.update_order_with_items(p_order_id uuid, p_order_patch jsonb, p_items_json jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_tenant_id      uuid;
  v_status_value   text;
  v_branch_value   uuid;
  v_old_status_id  uuid;
  v_old_group      text;
  v_new_group      text;
  v_promo_code     text;
BEGIN
  -- FOR UPDATE сериализует с update_order_status и delete_order_item_atomic.
  -- Без него возможен race: два параллельных cancel'а (полная форма + quick-action)
  -- читают v_old_group до того как одна из транзакций его сменила → двойной
  -- decrement promo_codes.used_count.
  SELECT tenant_id, nullif(status, '')::uuid, promo_code
  INTO v_tenant_id, v_old_status_id, v_promo_code
  FROM orders WHERE id = p_order_id
  FOR UPDATE;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT has_permission(v_tenant_id, 'orders.edit') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  -- Cross-tenant guard: SECURITY DEFINER обходит RLS, поэтому валидируем
  -- ссылки на справочники руками. Status и branch_id — единственные поля
  -- в p_order_patch, которые ссылаются на per-tenant справочники без FK с
  -- tenant-проверкой. Остальные ID-поля (promotion_id, delivery_zone_id,
  -- table_id) валидируются upstream в admin-сервисах.
  IF p_order_patch ? 'status' THEN
    v_status_value := p_order_patch->>'status';
    IF v_status_value IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM order_statuses
         WHERE id::text = v_status_value AND tenant_id = v_tenant_id
       ) THEN
      RAISE EXCEPTION 'Status does not belong to tenant' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_order_patch ? 'branch_id' THEN
    v_branch_value := nullif(p_order_patch->>'branch_id', '')::uuid;
    IF v_branch_value IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM branches WHERE id = v_branch_value AND tenant_id = v_tenant_id
       ) THEN
      RAISE EXCEPTION 'Branch does not belong to tenant' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_items_json IS NOT NULL THEN
    DELETE FROM order_items WHERE order_id = p_order_id;

    IF jsonb_array_length(p_items_json) > 0 THEN
      INSERT INTO order_items (
        order_id, tenant_id, dish_id, combo_id, dish_name, category_name, price, quantity,
        removed_ingredients, modifiers, addons, customizable, sort_order,
        completed_at, combo_items, added_by, confirmed_by, status
      )
      SELECT
        p_order_id,
        v_tenant_id,
        nullif(item->>'dish_id', '')::uuid,
        nullif(item->>'combo_id', '')::uuid,
        item->>'dish_name',
        item->>'category_name',
        (item->>'price')::numeric,
        (item->>'quantity')::int,
        coalesce(
          ARRAY(SELECT jsonb_array_elements_text(item->'removed_ingredients')),
          ARRAY[]::text[]
        ),
        coalesce(item->'modifiers', '[]'::jsonb),
        coalesce(item->'addons', '[]'::jsonb),
        CASE WHEN item ? 'customizable' AND jsonb_typeof(item->'customizable') = 'boolean'
             THEN (item->>'customizable')::boolean ELSE NULL END,
        coalesce((item->>'sort_order')::int, 0),
        nullif(item->>'completed_at', '')::timestamptz,
        CASE WHEN jsonb_typeof(item->'combo_items') = 'array' THEN item->'combo_items' ELSE NULL END,
        nullif(item->>'added_by', '')::uuid,
        nullif(item->>'confirmed_by', '')::uuid,
        coalesce(item->>'status', 'confirmed')
      FROM jsonb_array_elements(p_items_json) AS item;
    END IF;
  END IF;

  IF p_order_patch IS NOT NULL AND p_order_patch <> '{}'::jsonb THEN
    UPDATE orders SET
      customer_name        = coalesce(p_order_patch->>'customer_name', customer_name),
      customer_phone       = coalesce(p_order_patch->>'customer_phone', customer_phone),
      customer_email       = CASE WHEN p_order_patch ? 'customer_email' THEN p_order_patch->>'customer_email' ELSE customer_email END,
      delivery_type        = coalesce(p_order_patch->>'delivery_type', delivery_type),
      address              = CASE WHEN p_order_patch ? 'address' THEN p_order_patch->>'address' ELSE address END,
      entrance             = CASE WHEN p_order_patch ? 'entrance' THEN p_order_patch->>'entrance' ELSE entrance END,
      floor                = CASE WHEN p_order_patch ? 'floor' THEN p_order_patch->>'floor' ELSE floor END,
      apartment            = CASE WHEN p_order_patch ? 'apartment' THEN p_order_patch->>'apartment' ELSE apartment END,
      intercom             = CASE WHEN p_order_patch ? 'intercom' THEN p_order_patch->>'intercom' ELSE intercom END,
      delivery_lat         = CASE WHEN p_order_patch ? 'delivery_lat' THEN nullif(p_order_patch->>'delivery_lat', '')::numeric ELSE delivery_lat END,
      delivery_lon         = CASE WHEN p_order_patch ? 'delivery_lon' THEN nullif(p_order_patch->>'delivery_lon', '')::numeric ELSE delivery_lon END,
      comment              = CASE WHEN p_order_patch ? 'comment' THEN p_order_patch->>'comment' ELSE comment END,
      promo_code           = CASE WHEN p_order_patch ? 'promo_code' THEN p_order_patch->>'promo_code' ELSE promo_code END,
      promotion_id         = CASE WHEN p_order_patch ? 'promotion_id' THEN nullif(p_order_patch->>'promotion_id', '')::uuid ELSE promotion_id END,
      discount_amount      = coalesce((p_order_patch->>'discount_amount')::numeric, discount_amount),
      subtotal             = coalesce((p_order_patch->>'subtotal')::numeric, subtotal),
      delivery_fee         = coalesce((p_order_patch->>'delivery_fee')::numeric, delivery_fee),
      total                = coalesce((p_order_patch->>'total')::numeric, total),
      status               = coalesce(p_order_patch->>'status', status),
      payment_type         = coalesce(p_order_patch->>'payment_type', payment_type),
      branch_id            = CASE WHEN p_order_patch ? 'branch_id' THEN nullif(p_order_patch->>'branch_id', '')::uuid ELSE branch_id END,
      scheduled_at         = CASE WHEN p_order_patch ? 'scheduled_at' THEN nullif(p_order_patch->>'scheduled_at', '')::timestamptz ELSE scheduled_at END,
      kitchen_lead_minutes = CASE WHEN p_order_patch ? 'kitchen_lead_minutes' THEN nullif(p_order_patch->>'kitchen_lead_minutes', '')::int ELSE kitchen_lead_minutes END
    WHERE id = p_order_id;
  END IF;

  -- PREPROD-144: декремент promo при переходе в cancelled через полную форму.
  IF p_order_patch ? 'status' THEN
    SELECT s.group_type INTO v_new_group
    FROM order_statuses s
    WHERE s.id::text = p_order_patch->>'status';

    IF v_new_group = 'cancelled' THEN
      SELECT s.group_type INTO v_old_group
      FROM order_statuses s
      WHERE s.id = v_old_status_id;

      -- v_old_group=NULL = orphaned legacy-статус → не считаем переходом
      -- из не-cancelled, иначе false-positive decrement на грязных данных.
      IF v_old_group IS NOT NULL
         AND v_old_group <> 'cancelled'
         AND v_promo_code IS NOT NULL
         AND length(trim(v_promo_code)) > 0 THEN
        UPDATE promo_codes
        SET used_count = used_count - 1
        WHERE tenant_id = v_tenant_id
          AND upper(code) = upper(v_promo_code)
          AND used_count > 0;
      END IF;
    END IF;
  END IF;
END;
$function$;

-- ── create_order_with_items_atomic ──
CREATE OR REPLACE FUNCTION public.create_order_with_items_atomic(p_order_payload jsonb, p_items_json jsonb, p_free_item_json jsonb, p_promo_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order_id      uuid;
  v_order_number  text;
  v_guest_token   uuid;
  v_tenant_id     uuid;
BEGIN
  v_tenant_id := nullif(p_order_payload->>'tenant_id', '')::uuid;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO orders (
    tenant_id, customer_name, customer_phone, customer_email,
    delivery_type, address, entrance, floor, apartment, intercom,
    comment, promo_code, promotion_id,
    discount_amount, subtotal, delivery_fee, total,
    status, payment_type, needs_change, change_from,
    idempotency_key, branch_id, delivery_zone_id,
    delivery_lat, delivery_lon, table_id, table_name,
    customer_id, guest_token, scheduled_at
  ) VALUES (
    v_tenant_id,
    p_order_payload->>'customer_name',
    p_order_payload->>'customer_phone',
    p_order_payload->>'customer_email',
    p_order_payload->>'delivery_type',
    p_order_payload->>'address',
    p_order_payload->>'entrance',
    p_order_payload->>'floor',
    p_order_payload->>'apartment',
    p_order_payload->>'intercom',
    p_order_payload->>'comment',
    p_order_payload->>'promo_code',
    nullif(p_order_payload->>'promotion_id', '')::uuid,
    coalesce((p_order_payload->>'discount_amount')::numeric, 0),
    (p_order_payload->>'subtotal')::numeric,
    coalesce((p_order_payload->>'delivery_fee')::numeric, 0),
    (p_order_payload->>'total')::numeric,
    p_order_payload->>'status',
    p_order_payload->>'payment_type',
    coalesce((p_order_payload->>'needs_change')::boolean, false),
    nullif(p_order_payload->>'change_from', '')::numeric,
    nullif(p_order_payload->>'idempotency_key', ''),
    nullif(p_order_payload->>'branch_id', '')::uuid,
    nullif(p_order_payload->>'delivery_zone_id', '')::uuid,
    nullif(p_order_payload->>'delivery_lat', '')::double precision,
    nullif(p_order_payload->>'delivery_lon', '')::double precision,
    nullif(p_order_payload->>'table_id', '')::uuid,
    p_order_payload->>'table_name',
    nullif(p_order_payload->>'customer_id', '')::uuid,
    nullif(p_order_payload->>'guest_token', '')::uuid,
    nullif(p_order_payload->>'scheduled_at', '')::timestamptz
  )
  RETURNING id, order_number, guest_token
  INTO v_order_id, v_order_number, v_guest_token;

  IF p_items_json IS NOT NULL AND jsonb_array_length(p_items_json) > 0 THEN
    INSERT INTO order_items (
      order_id, tenant_id, dish_id, combo_id, combo_items,
      dish_name, category_name, price, quantity,
      removed_ingredients, modifiers, addons, sort_order, status, added_by
    )
    SELECT
      v_order_id,
      v_tenant_id,
      nullif(item->>'dish_id', '')::uuid,
      nullif(item->>'combo_id', '')::uuid,
      CASE WHEN jsonb_typeof(item->'combo_items') = 'array' THEN item->'combo_items' ELSE NULL END,
      item->>'dish_name',
      item->>'category_name',
      (item->>'price')::numeric,
      (item->>'quantity')::int,
      coalesce(
        ARRAY(SELECT jsonb_array_elements_text(item->'removed_ingredients')),
        ARRAY[]::text[]
      ),
      coalesce(item->'modifiers', '[]'::jsonb),
      coalesce(item->'addons', '[]'::jsonb),
      coalesce((item->>'sort_order')::int, 0),
      coalesce(item->>'status', 'confirmed'),
      nullif(item->>'added_by', '')::uuid
    FROM jsonb_array_elements(p_items_json) AS item;
  END IF;

  IF p_free_item_json IS NOT NULL AND p_free_item_json <> 'null'::jsonb THEN
    INSERT INTO order_items (
      order_id, tenant_id, dish_id, dish_name, category_name,
      price, quantity, removed_ingredients, modifiers, sort_order
    ) VALUES (
      v_order_id,
      v_tenant_id,
      nullif(p_free_item_json->>'dish_id', '')::uuid,
      p_free_item_json->>'dish_name',
      p_free_item_json->>'category_name',
      coalesce((p_free_item_json->>'price')::numeric, 0),
      coalesce((p_free_item_json->>'quantity')::int, 1),
      ARRAY[]::text[],
      '[]'::jsonb,
      coalesce((p_free_item_json->>'sort_order')::int, 0)
    );
  END IF;

  -- PREPROD-114: инкремент used_count промокода в той же транзакции.
  -- Если код не найден (deactivated race / опечатка) — UPDATE 0 строк,
  -- ничего не падает. Заказ при этом уже создан с discount_amount, что
  -- норм: race по «деактивации между resolvePromo и create_order» — баг
  -- более низкого приоритета (мы не блокируем uж принятый чекаут).
  IF p_promo_code IS NOT NULL AND length(trim(p_promo_code)) > 0 THEN
    UPDATE promo_codes
    SET used_count = used_count + 1
    WHERE tenant_id = v_tenant_id
      AND upper(code) = upper(p_promo_code)
      AND active = true
      AND deleted_at IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'guest_token', v_guest_token
  );
END;
$function$;
