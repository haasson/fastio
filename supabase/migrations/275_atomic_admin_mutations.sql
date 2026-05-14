-- Атомарные мутации админки: убираем loop-UPDATE и многошаговые
-- (DELETE+INSERT+UPDATE) операции с риском частичного выполнения.

-- ─── reorder_categories ─────────────────────────────────────────────
-- Промикс reorder_dishes: один UPDATE-цикл в одной транзакции вместо
-- Promise.all отдельных UPDATE'ов с разными транзакциями на клиенте.

CREATE OR REPLACE FUNCTION public.reorder_categories(items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  item jsonb;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    UPDATE categories
    SET sort_order = (item->>'order')::int
    WHERE id = (item->>'id')::uuid;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_categories(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_categories(jsonb) TO authenticated;

-- ─── apply_table_discount ──────────────────────────────────────────
-- Распределяет скидку (discount_amount) по всем активным заказам стола
-- пропорционально их total. Раньше делалось циклом UPDATE'ов на клиенте —
-- если падал N-й апдейт, скидка применялась частично и баланс ломался.

CREATE OR REPLACE FUNCTION public.apply_table_discount(
  p_table_id              uuid,
  p_opened_at             timestamptz,
  p_discount_amount       numeric,
  p_cancelled_status_ids  uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id      uuid;
  v_total_sum      numeric;
  v_remaining      numeric;
  v_count          int;
  v_idx            int := 0;
  v_share          numeric;
  v_clamped        numeric;
  v_order          record;
BEGIN
  IF p_discount_amount <= 0 THEN
    RETURN;
  END IF;

  SELECT tenant_id INTO v_tenant_id FROM tables WHERE id = p_table_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Table not found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT has_permission(v_tenant_id, 'orders.edit') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(sum(total), 0), count(*) INTO v_total_sum, v_count
  FROM orders
  WHERE table_id = p_table_id
    AND created_at >= p_opened_at
    AND (p_cancelled_status_ids IS NULL OR status <> ALL(p_cancelled_status_ids));

  IF v_count = 0 OR v_total_sum <= 0 THEN
    RETURN;
  END IF;

  v_remaining := p_discount_amount;

  -- ORDER BY created_at: детерминированный порядок нужен потому, что последний
  -- заказ в цикле получает остаток округления (v_remaining), а не пропорциональную
  -- долю. Без ORDER BY порядок строк был бы определён планом запроса и мог
  -- меняться между вызовами → разные заказы получали бы «копейки» от разных
  -- скидок. Старая JS-реализация была недетерминирована (порядок из supabase-js).
  FOR v_order IN
    SELECT id, total FROM orders
    WHERE table_id = p_table_id
      AND created_at >= p_opened_at
      AND (p_cancelled_status_ids IS NULL OR status <> ALL(p_cancelled_status_ids))
    ORDER BY created_at
  LOOP
    v_idx := v_idx + 1;
    IF v_idx = v_count THEN
      v_share := v_remaining;
    ELSE
      v_share := round(p_discount_amount * v_order.total / v_total_sum);
    END IF;
    v_clamped := least(v_share, v_order.total);

    UPDATE orders
    SET discount_amount = v_clamped,
        total = v_order.total - v_clamped
    WHERE id = v_order.id;

    v_remaining := v_remaining - v_clamped;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_table_discount(uuid, timestamptz, numeric, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_table_discount(uuid, timestamptz, numeric, uuid[]) TO authenticated;

-- ─── update_order_with_items ───────────────────────────────────────
-- Атомарная замена позиций заказа + обновление полей заказа в одной
-- транзакции. Раньше: DELETE order_items → INSERT order_items → UPDATE orders
-- тремя отдельными запросами — между ними триггер kitchen_queue мог снэпшотить
-- неконсистентное состояние, плюс на падении INSERT оставался order без items.
--
-- p_items_json: jsonb-массив строк order_items в формате DB-row
--   (snake_case ключи, order_id игнорируется и заменяется на p_order_id).
-- Если p_items_json IS NULL — items не трогаются (частичный апдейт).
-- p_order_patch: jsonb с полями orders для UPDATE (snake_case).
--   Если NULL или {} — поля заказа не трогаются.

CREATE OR REPLACE FUNCTION public.update_order_with_items(
  p_order_id     uuid,
  p_order_patch  jsonb,
  p_items_json   jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id      uuid;
  v_status_value   text;
  v_branch_value   uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM orders WHERE id = p_order_id;
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
        item->'combo_items',
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
END;
$$;

REVOKE ALL ON FUNCTION public.update_order_with_items(uuid, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_order_with_items(uuid, jsonb, jsonb) TO authenticated;
