-- 336: add_items_to_order — дозаказ блюд в принятый (in_progress) заказ
-- доставки/самовывоза, с инкрементальным наполнением кухни.
--
-- Зачем: клиент перезвонил «добавьте ещё бургер». Сейчас состав принятого
-- заказа залочен (editItems == 'new'); update_order_with_items для не-new
-- намеренно пропускает items (DELETE+reinsert уничтожил бы kitchen_queue).
-- Нужен append-only путь: дописать позиции + создать тикеты ТОЛЬКО на них.
--
-- Прецедент: add_items_to_check (327, dine-in). Отличие: для delivery/pickup
-- триггер kitchen_queue_on_dine_in_item_insert не срабатывает (gated на dine_in),
-- поэтому кухню наполняем явно через _kitchen_queue_insert_item на новых строках.
-- Идемпотентность: позиции только что вставлены → kitchen_queue по ним пуст,
-- доп. EXISTS-гард не нужен. Доготовленные позиции не воскресают (их order_item
-- мы не трогаем).

CREATE OR REPLACE FUNCTION public.add_items_to_order(
  p_order_id   uuid,
  p_items_json jsonb
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_tenant_id       uuid;
  v_delivery_type   text;
  v_status          text;
  v_group           text;
  v_kitchen_queued  timestamptz;
  v_kitchen_enabled boolean;
  v_max_sort        int;
  v_new_ids         uuid[];
  v_item            record;
BEGIN
  -- FOR UPDATE: защита от гонки с параллельной сменой статуса/накаткой кухни.
  SELECT o.tenant_id, o.delivery_type, o.status, o.kitchen_queued_at
    INTO v_tenant_id, v_delivery_type, v_status, v_kitchen_queued
    FROM orders o
    WHERE o.id = p_order_id
    FOR UPDATE;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0001';
  END IF;

  IF NOT has_permission(v_tenant_id, 'orders.edit') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  -- dine_in сюда не ходит — у него свой add_items_to_check.
  IF v_delivery_type = 'dine_in' THEN
    RAISE EXCEPTION 'Use add_items_to_check for dine-in' USING ERRCODE = 'P0001';
  END IF;

  -- Дозаказ только пока заказ в работе (new/in_progress), не терминальный.
  SELECT group_type INTO v_group FROM order_statuses WHERE id = v_status;
  IF v_group IS NULL OR v_group NOT IN ('new', 'in_progress') THEN
    RAISE EXCEPTION 'Order is not editable in its current status' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(max(sort_order), -1) INTO v_max_sort
    FROM order_items WHERE order_id = p_order_id;

  -- Вставка новых позиций; собираем их id для точечного наполнения кухни.
  -- status дефолтится в 'confirmed' (миграция 082).
  WITH inserted AS (
    INSERT INTO order_items (
      order_id, tenant_id, dish_id, combo_id, combo_items,
      dish_name, category_name, price, quantity,
      removed_ingredients, modifiers, addons, sort_order
    )
    SELECT
      p_order_id,
      v_tenant_id,
      nullif(item->>'dish_id', '')::uuid,
      nullif(item->>'combo_id', '')::uuid,
      CASE WHEN jsonb_typeof(item->'combo_items') = 'array' THEN item->'combo_items' ELSE NULL END,
      item->>'dish_name',
      item->>'category_name',
      (item->>'price')::numeric,
      (item->>'quantity')::int,
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(item->'removed_ingredients')), ARRAY[]::text[]),
      COALESCE(item->'modifiers', '[]'::jsonb),
      COALESCE(item->'addons', '[]'::jsonb),
      v_max_sort + ord::int
    FROM jsonb_array_elements(p_items_json) WITH ORDINALITY AS t(item, ord)
    RETURNING id
  )
  SELECT array_agg(id) INTO v_new_ids FROM inserted;

  -- Кухня: только если модуль включён И заказ уже уходил на кухню.
  -- Если ещё не уходил (kitchen_queued_at IS NULL) — тикеты создаст штатный
  -- статус-триггер при переходе в «Принят», дублировать не нужно.
  SELECT (modules ->> 'kitchen')::boolean INTO v_kitchen_enabled
    FROM tenants WHERE id = v_tenant_id;

  IF COALESCE(v_kitchen_enabled, false) AND v_kitchen_queued IS NOT NULL THEN
    FOR v_item IN
      SELECT * FROM order_items WHERE id = ANY(v_new_ids)
    LOOP
      PERFORM _kitchen_queue_insert_item(v_tenant_id, p_order_id, v_item, v_delivery_type);
    END LOOP;
  END IF;

  -- Пересчёт сумм: subtotal из всех позиций, total = subtotal - скидка + доставка
  -- (как формула total в create_order_with_items_atomic / клиентский total в
  -- OrderContent.vue: subtotal - discountAmount + deliveryFee).
  UPDATE orders o SET
    subtotal = COALESCE((SELECT sum(price * quantity) FROM order_items WHERE order_id = o.id), 0),
    total    = COALESCE((SELECT sum(price * quantity) FROM order_items WHERE order_id = o.id), 0)
               - COALESCE(o.discount_amount, 0)
               + COALESCE(o.delivery_fee, 0)
  WHERE o.id = p_order_id;

  RETURN p_order_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.add_items_to_order(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_items_to_order(uuid, jsonb) TO authenticated, service_role;
