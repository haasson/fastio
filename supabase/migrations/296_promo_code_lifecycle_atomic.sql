-- Атомарный lifecycle promo_codes.used_count
--
-- PREPROD-114: при создании заказа из storefront инкремент usage делался
-- ОТДЕЛЬНЫМ RPC после успешного create_order_with_items_atomic. Если worker
-- крашился между — заказ есть, used_count не инкрементирован. Теперь
-- инкремент выполняется внутри той же транзакции что и INSERT INTO orders.
--
-- PREPROD-144: при отмене заказа админом used_count не откатывался — клиент
-- не мог реюзнуть промокод. Теперь при переходе заказа из non-cancelled в
-- группу cancelled used_count декрементится в той же транзакции что и
-- UPDATE orders.status.
--
-- Расширяет:
--   - create_order_with_items_atomic — добавлен параметр p_promo_code
--     (default NULL). Если передан + найден активный код → used_count + 1.
--   - update_order_with_items — после UPDATE orders.status проверяет
--     переход в group_type='cancelled' и декрементит used_count.
--
-- Добавляет:
--   - update_order_status — атомарный апдейт статуса с декрементом promo
--     для быстрых переходов из админки (ordersApi.updateStatus).

-- ─── create_order_with_items_atomic (PREPROD-114) ─────────────────
-- Дропаем старую сигнатуру (3 jsonb-параметра), чтобы PostgreSQL не путал
-- её с новой. CREATE OR REPLACE по разным сигнатурам создаст две функции.
DROP FUNCTION IF EXISTS public.create_order_with_items_atomic(jsonb, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.create_order_with_items_atomic(
  p_order_payload  jsonb,
  p_items_json     jsonb,
  p_free_item_json jsonb,
  p_promo_code     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
      item->'combo_items',
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
$$;

REVOKE ALL ON FUNCTION public.create_order_with_items_atomic(jsonb, jsonb, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_with_items_atomic(jsonb, jsonb, jsonb, text) TO service_role;

-- ─── update_order_status (PREPROD-144) ────────────────────────────
-- Атомарный апдейт статуса заказа с автоматическим декрементом
-- promo_codes.used_count при переходе в группу cancelled.
--
-- Перманентность операции:
--   1. Lock на orders.id (UPDATE … RETURNING)
--   2. Проверка переходов group_type (старая/новая)
--   3. UPDATE promo_codes.used_count (если применимо)
--   Всё в одной транзакции.
--
-- Декрементируем ТОЛЬКО при переходе из non-cancelled → cancelled.
-- Это защита от двойного декремента, если кто-то ставит статус cancelled
-- два раза подряд (idempotency). used_count >= 1 проверяется в WHERE,
-- так что negative count невозможен.

CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id    uuid,
  p_new_status  uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id        uuid;
  v_old_status_id    uuid;
  v_old_group        text;
  v_new_group        text;
  v_new_tenant_id    uuid;
  v_promo_code       text;
BEGIN
  -- Lock + читаем текущее состояние. orders.status хранится text (uuid-строка),
  -- nullif для пустых строк (защита от грязных данных)
  SELECT o.tenant_id, nullif(o.status, '')::uuid, o.promo_code
  INTO v_tenant_id, v_old_status_id, v_promo_code
  FROM orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0001';
  END IF;

  IF NOT has_permission(v_tenant_id, 'orders.edit') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  -- Cross-tenant guard: новый статус должен принадлежать тому же тенанту.
  SELECT s.group_type, s.tenant_id
  INTO v_new_group, v_new_tenant_id
  FROM order_statuses s
  WHERE s.id = p_new_status;

  IF v_new_tenant_id IS NULL OR v_new_tenant_id <> v_tenant_id THEN
    RAISE EXCEPTION 'Status does not belong to tenant' USING ERRCODE = '42501';
  END IF;

  -- Старая группа (если old_status существует — может быть невалидный uuid
  -- в legacy-данных). Здесь не строгий guard, поскольку нас интересует
  -- только переход из не-cancelled в cancelled.
  SELECT s.group_type INTO v_old_group
  FROM order_statuses s
  WHERE s.id = v_old_status_id;

  UPDATE orders SET status = p_new_status::text WHERE id = p_order_id;

  -- Декрементим promo только при переходе non-cancelled → cancelled.
  -- v_old_group=NULL означает orphaned legacy-статус (был удалён из order_statuses) —
  -- не считаем это «не-cancelled» переходом, чтобы не словить false-positive
  -- decrement на грязных данных.
  IF v_new_group = 'cancelled'
     AND v_old_group IS NOT NULL
     AND v_old_group <> 'cancelled'
     AND v_promo_code IS NOT NULL
     AND length(trim(v_promo_code)) > 0 THEN
    UPDATE promo_codes
    SET used_count = used_count - 1
    WHERE tenant_id = v_tenant_id
      AND upper(code) = upper(v_promo_code)
      AND used_count > 0;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_order_status(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid, uuid) TO authenticated;

-- ─── update_order_with_items: декремент promo на cancel (PREPROD-144) ─
-- Полный update заказа из админки тоже может менять status. Если меняется
-- на cancelled — декрементим. Без этого блока админ, отменяющий заказ
-- через полную форму (а не quick-action), оставит used_count неоткатанным.

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
$$;

REVOKE ALL ON FUNCTION public.update_order_with_items(uuid, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_order_with_items(uuid, jsonb, jsonb) TO authenticated;
