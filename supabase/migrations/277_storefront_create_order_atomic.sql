-- Атомарное создание заказа из storefront: order + items + free_item в одной
-- транзакции вместо трёх отдельных INSERT'ов в orders.post.ts.
--
-- До этого: silent reportError на itemsError оставлял заказ без позиций —
-- админ видел "пустой" заказ, клиент думал что всё ОК. На свободном rolloout
-- (free_item) то же самое. Теперь либо всё, либо ничего.
--
-- p_order_payload — все поля orders (snake_case). tenant_id обязателен.
-- p_items_json — массив позиций (snake_case ключи, order_id игнорируется).
-- p_free_item_json — опциональная free-позиция (для акции free_item), либо NULL.
--
-- На дубликате idempotency_key выбрасывает SQLSTATE 23505 — endpoint ловит
-- и делает SELECT existing (логика IDOR-safe: idempotency_key uuidv4 известен
-- только оригинальному автору).

CREATE OR REPLACE FUNCTION public.create_order_with_items_atomic(
  p_order_payload  jsonb,
  p_items_json     jsonb,
  p_free_item_json jsonb
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

  RETURN jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'guest_token', v_guest_token
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_with_items_atomic(jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_with_items_atomic(jsonb, jsonb, jsonb) TO service_role;
