-- 337: fix add_items_to_order — (1) каст orders.status→order_statuses.id,
-- (2) корректный пересчёт сумм с учётом модификаторов/добавок.
--
-- Баг 336a: `WHERE id = v_status` сравнивал uuid-колонку с text-переменной
-- (orders.status хранится text uuid-строкой, см. 013) → ошибка 42883
-- "operator does not exist: uuid = text". Штатные функции (071/134) кастят
-- `_status::uuid` — здесь каст был потерян.
--
-- Баг 336b (денежный): пересчёт `sum(price*quantity)` занижал сумму — order_items.price
-- хранит ТОЛЬКО базовую цену блюда, а дельты модификаторов (modifiers[].priceDelta)
-- и цены добавок (addons[].price) лежат в jsonb и в price не свёрнуты. Штатный флоу
-- (296) берёт subtotal из клиента, где он посчитан getItemUnitPrice(). RPC-пути
-- считают сами → обязаны включать extras. Выносим в общий хелпер _recalc_order_totals,
-- переиспользуемый add/remove/update_order_item.
-- Fix-forward: 336 уже накатана, повторно не гоняется → отдельный REPLACE.

-- ── Пересчёт сумм заказа: subtotal с extras, total клампится в неотрицательное ──
-- subtotal = Σ((база + Σmod.priceDelta + Σaddon.price) * qty) — зеркало
-- getItemUnitPrice() (packages/shared/src/utils/price.ts).
-- total = subtotal - discount + delivery, не ниже 0 (после удаления позиций
-- замороженная discount_amount могла бы увести total в минус).
-- NB: discount_amount остаётся от исходного состава — переоценка применимости
-- промо при правке состава вне скоупа (TECHDEBT: promo-vs-edit).
CREATE OR REPLACE FUNCTION public._recalc_order_totals(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_subtotal numeric;
BEGIN
  SELECT COALESCE(sum(
    (oi.price
     + COALESCE((SELECT sum((m->>'priceDelta')::numeric) FROM jsonb_array_elements(oi.modifiers) m), 0)
     + COALESCE((SELECT sum((a->>'price')::numeric)      FROM jsonb_array_elements(oi.addons) a), 0)
    ) * oi.quantity
  ), 0)
  INTO v_subtotal
  FROM order_items oi
  WHERE oi.order_id = p_order_id;

  UPDATE orders o SET
    subtotal = v_subtotal,
    total    = GREATEST(v_subtotal - COALESCE(o.discount_amount, 0) + COALESCE(o.delivery_fee, 0), 0)
  WHERE o.id = p_order_id;
END;
$function$;

REVOKE ALL ON FUNCTION public._recalc_order_totals(uuid) FROM PUBLIC, anon;

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
  -- orders.status хранится text (uuid-строкой), order_statuses.id — uuid → каст.
  SELECT group_type INTO v_group FROM order_statuses WHERE id = v_status::uuid;
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

  PERFORM _recalc_order_totals(p_order_id);

  RETURN p_order_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.add_items_to_order(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_items_to_order(uuid, jsonb) TO authenticated, service_role;
