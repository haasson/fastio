-- 327: RPC жизненного цикла dine-in чека.

-- ── open_table_check ──────────────────────────────────────────────────────────
-- Атомарно: открыть стол (is_open, opened_at) + создать пустой открытый чек.
-- Партиал-уникальный индекс ловит гонку двойного открытия (23505 → P0001).
-- Линкуем seated-бронь стола к чеку (order_id) — для блока «Бронь» в истории.
CREATE OR REPLACE FUNCTION public.open_table_check(p_table_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_branch_id uuid;
  v_name      text;
  v_check_id  uuid;
BEGIN
  SELECT tenant_id, branch_id, name
    INTO v_tenant_id, v_branch_id, v_name
    FROM tables WHERE id = p_table_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Table not found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT has_permission(v_tenant_id, 'tables.manage') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  BEGIN
    INSERT INTO orders (
      tenant_id, delivery_type, table_id, table_name, branch_id,
      check_status, status, subtotal, total, discount_amount, payment_type
    ) VALUES (
      v_tenant_id, 'dine_in', p_table_id, v_name, v_branch_id,
      'open', 'new', 0, 0, 0, 'cash'   -- payment_type='cash' плейсхолдер, перезапишет settle
    )
    RETURNING id INTO v_check_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Table already has an open check' USING ERRCODE = 'P0001';
  END;

  UPDATE tables SET is_open = true, opened_at = now() WHERE id = p_table_id;

  -- Линк seated-брони к чеку (если есть) — для истории. Не критично, без ошибки.
  UPDATE reservations
    SET order_id = v_check_id
    WHERE table_id = p_table_id AND status = 'seated' AND order_id IS NULL;

  RETURN v_check_id;
END;
$function$;

-- ── add_items_to_check ────────────────────────────────────────────────────────
-- Дописать позиции в открытый чек стола + атомарный пересчёт subtotal/total.
-- p_status: 'confirmed' (официант, сразу на кухню) | 'pending' (QR-гость, ждёт
-- подтверждения). Резолвим чек по table_id (партиал-уникальный индекс → ≤1).
-- Триггеры order_items сами кладут в kitchen_queue (confirmed) либо ждут (pending).
-- Контракт элемента p_items_json: { dish_name (NOT NULL), price, quantity, dish_id?,
-- combo_id?, combo_items?, category_name?, removed_ingredients?, modifiers?, addons?,
-- added_by? }. Вызывающие доверенные (admin authenticated / Nitro service_role) —
-- валидация формы на их стороне; кривой payload даст 23502/22P02, не P0001.
CREATE OR REPLACE FUNCTION public.add_items_to_check(
  p_table_id   uuid,
  p_items_json jsonb,
  p_status     text DEFAULT 'confirmed'
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_check_id  uuid;
  v_max_sort  int;
BEGIN
  IF p_status NOT IN ('confirmed','pending') THEN
    RAISE EXCEPTION 'Invalid item status' USING ERRCODE = 'P0001';
  END IF;

  SELECT tenant_id INTO v_tenant_id FROM tables WHERE id = p_table_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Table not found' USING ERRCODE = 'P0001';
  END IF;
  -- Официант (confirmed) — tables.manage; QR-гость дёргает RPC под service-role
  -- из Nitro (без auth.uid()), поэтому для pending право не требуем здесь —
  -- гард is_open + check существует достаточен. Для confirmed требуем tables.manage.
  IF p_status = 'confirmed' AND NOT has_permission(v_tenant_id, 'tables.manage') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_check_id
    FROM orders
    WHERE table_id = p_table_id AND check_status = 'open'
    FOR UPDATE;

  IF v_check_id IS NULL THEN
    RAISE EXCEPTION 'No open check for table' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(max(sort_order), -1) INTO v_max_sort
    FROM order_items WHERE order_id = v_check_id;

  INSERT INTO order_items (
    order_id, tenant_id, dish_id, combo_id, combo_items,
    dish_name, category_name, price, quantity,
    removed_ingredients, modifiers, addons, sort_order, status, added_by, confirmed_by
  )
  SELECT
    v_check_id,
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
    v_max_sort + ord::int,
    p_status,
    nullif(item->>'added_by', '')::uuid,
    CASE WHEN p_status = 'confirmed' THEN nullif(item->>'added_by', '')::uuid ELSE NULL END
  FROM jsonb_array_elements(p_items_json) WITH ORDINALITY AS t(item, ord);

  -- Пересчёт сумм из ВСЕХ позиций чека (pending тоже учитываем в живом счёте —
  -- loadSums так и показывает; на settle pending быть не должно).
  UPDATE orders o SET
    subtotal = COALESCE((SELECT sum(price * quantity) FROM order_items WHERE order_id = o.id), 0),
    total    = COALESCE((SELECT sum(price * quantity) FROM order_items WHERE order_id = o.id), 0)
  WHERE o.id = v_check_id;

  RETURN v_check_id;
END;
$function$;

-- ── settle_table_check ────────────────────────────────────────────────────────
-- Расчёт: скидка + способ оплаты (payment_type) + кто/когда. Атомарно закрывает
-- стол и завершает seated-бронь. Пустой чек (0 позиций) → 'cancelled' (в историю
-- не идёт), оплата/скидка игнорируются + defensive чистка кухни (страховка).
CREATE OR REPLACE FUNCTION public.settle_table_check(
  p_check_id        uuid,
  p_discount_amount numeric,
  p_payment_type    text
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_table_id  uuid;
  v_status    text;
  v_subtotal  numeric;
  v_count     int;
  v_discount  numeric;
BEGIN
  SELECT tenant_id, table_id, check_status
    INTO v_tenant_id, v_table_id, v_status
    FROM orders WHERE id = p_check_id FOR UPDATE;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Check not found' USING ERRCODE = 'P0001';
  END IF;
  IF v_status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'Check is not open' USING ERRCODE = 'P0001';
  END IF;
  IF NOT has_permission(v_tenant_id, 'orders.edit') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;
  IF p_payment_type NOT IN ('cash','card') THEN
    RAISE EXCEPTION 'Invalid payment type' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(sum(price * quantity), 0), count(*)
    INTO v_subtotal, v_count
    FROM order_items WHERE order_id = p_check_id;

  IF v_count = 0 THEN
    -- Пустой чек: отменяем, не пишем оплату. Кухни тут нет — но страхуемся.
    UPDATE kitchen_queue SET status = 'cancelled'
      WHERE order_id = p_check_id AND status IN ('queued','in_progress');
    UPDATE orders SET check_status = 'cancelled', subtotal = 0, total = 0
      WHERE id = p_check_id;
  ELSE
    v_discount := least(greatest(COALESCE(p_discount_amount, 0), 0), v_subtotal);
    -- Кухню НЕ трогаем намеренно (дизайн §6.5): confirmed-позиции, не готовые на
    -- момент расчёта, повар доготавливает после оплаты. Чистка кухни — только в
    -- empty-ветке выше (страховка пустого чека).
    UPDATE orders SET
      check_status    = 'settled',
      subtotal        = v_subtotal,
      discount_amount = v_discount,
      total           = v_subtotal - v_discount,
      payment_type    = p_payment_type,
      settled_by      = auth.uid(),
      settled_at      = now()
    WHERE id = p_check_id;
  END IF;

  -- Закрыть стол + завершить seated-бронь.
  IF v_table_id IS NOT NULL THEN
    UPDATE tables SET is_open = false, opened_at = null WHERE id = v_table_id;
    UPDATE reservations
      SET status = 'completed', completed_at = now(), updated_at = now()
      WHERE table_id = v_table_id AND status = 'seated';
  END IF;
END;
$function$;

-- ── DROP apply_table_discount ─────────────────────────────────────────────────
-- Роль перешла к settle_table_check (скидка размазывалась по N заказам — теперь
-- один чек, размазывать нечего).
DROP FUNCTION IF EXISTS public.apply_table_discount(uuid, timestamptz, numeric, uuid[]);

-- Закрываем дефолтный PUBLIC/anon EXECUTE у SECURITY DEFINER RPC (как в 295).
-- Admin (официант/расчёт) ходит как authenticated. QR-гость дописывает pending
-- ТОЛЬКО через Nitro-эндпоинт под service_role — anon к RPC не допускаем
-- (table_id публичен в QR-URL, иначе любой аноним инжектил бы позиции в чек).
-- Supabase default_privileges на схеме public грантит EXECUTE напрямую роли anon
-- (явная запись anon=X, не через PUBLIC) — поэтому ревокаем и PUBLIC, и anon.
REVOKE ALL ON FUNCTION public.open_table_check(uuid)               FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_items_to_check(uuid, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.settle_table_check(uuid, numeric, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.open_table_check(uuid)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_table_check(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_items_to_check(uuid, jsonb, text) TO authenticated, service_role;
