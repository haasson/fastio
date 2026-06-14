-- 338: правка принятого заказа (срез 3) — удаление/правка позиции.
-- Дополняет append-only дозаказ (336/337). Оба RPC: SECURITY DEFINER,
-- FOR UPDATE на заказе, право orders.edit, гард группы статуса (new/in_progress),
-- отказ dine_in. orders.status — text(uuid-строка) → джойн на order_statuses.id с ::uuid.
-- Пересчёт сумм — через _recalc_order_totals (337), с модификаторами/добавками.
--
-- Правило блокировки кухни (единое): позиция редактируема/удаляема, если кухня
-- выключена ИЛИ ни один её тикет не начат. «Начат» = статус in_progress/done/served.
-- queued (ещё не взяли) и cancelled (отменённый, напр. после отмены+реактивации
-- заказа) — НЕ блокируют. Блокировка по каждой позиции независимо.
--
-- Смена предзаказ-времени (scheduled_at) отдельного RPC не требует: штатный
-- save() → api.orders.update пишет scheduled_at под RLS и уже вызывается для
-- in_progress. Достаточно разлочить UI-поле (editScheduling для in_progress).

-- ── Общий гард: резолв заказа + право + статус + тип. DRY для обоих RPC. ──
CREATE OR REPLACE FUNCTION public._assert_order_editable(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_tenant_id     uuid;
  v_delivery_type text;
  v_status        text;
  v_group         text;
BEGIN
  SELECT o.tenant_id, o.delivery_type, o.status
    INTO v_tenant_id, v_delivery_type, v_status
    FROM orders o WHERE o.id = p_order_id FOR UPDATE;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT has_permission(v_tenant_id, 'orders.edit') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;
  IF v_delivery_type = 'dine_in' THEN
    RAISE EXCEPTION 'Use dine-in flow' USING ERRCODE = 'P0001';
  END IF;
  SELECT group_type INTO v_group FROM order_statuses WHERE id = v_status::uuid;
  IF v_group IS NULL OR v_group NOT IN ('new', 'in_progress') THEN
    RAISE EXCEPTION 'Order is not editable in its current status' USING ERRCODE = 'P0001';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public._assert_order_editable(uuid) FROM PUBLIC, anon;

-- ── Блокировка позиции кухней: TRUE если кухня вкл И есть НАЧАТЫЙ тикет позиции. ──
-- Начатый = in_progress/done/served. queued/cancelled не блокируют.
CREATE OR REPLACE FUNCTION public._order_item_kitchen_locked(p_order_item_id uuid, p_tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE((SELECT (modules ->> 'kitchen')::boolean FROM tenants WHERE id = p_tenant_id), false)
     AND EXISTS (
       SELECT 1 FROM kitchen_queue
       WHERE order_item_id = p_order_item_id
         AND status IN ('in_progress', 'done', 'served')
     );
$function$;

REVOKE ALL ON FUNCTION public._order_item_kitchen_locked(uuid, uuid) FROM PUBLIC, anon;

-- ── 1. remove_order_item — удаление позиции ──
CREATE OR REPLACE FUNCTION public.remove_order_item(p_order_item_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order_id  uuid;
  v_tenant_id uuid;
  v_count     int;
BEGIN
  SELECT oi.order_id, oi.tenant_id INTO v_order_id, v_tenant_id
    FROM order_items oi WHERE oi.id = p_order_item_id;
  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'Item not found' USING ERRCODE = 'P0001';
  END IF;

  PERFORM _assert_order_editable(v_order_id);

  -- Last-item guard: нельзя оставить заказ пустым (убрать заказ — статусом «Отменён»).
  SELECT count(*) INTO v_count FROM order_items WHERE order_id = v_order_id;
  IF v_count <= 1 THEN
    RAISE EXCEPTION 'Cannot remove the last item' USING ERRCODE = 'P0001';
  END IF;

  -- Лочим тикеты позиции, чтобы повар не успел клеймить между проверкой и DELETE.
  PERFORM 1 FROM kitchen_queue WHERE order_item_id = p_order_item_id FOR UPDATE;

  IF _order_item_kitchen_locked(p_order_item_id, v_tenant_id) THEN
    RAISE EXCEPTION 'Item already being cooked' USING ERRCODE = 'P0001';
  END IF;

  -- DELETE order_item: FK kitchen_queue.order_item_id = ON DELETE SET NULL (304),
  -- а BEFORE-DELETE триггер trg_kitchen_queue_on_item_delete мягко гасит тикеты
  -- (queued/in_progress → cancelled). Здесь все незаблокированные → queued.
  DELETE FROM order_items WHERE id = p_order_item_id;

  PERFORM _recalc_order_totals(v_order_id);

  RETURN v_order_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.remove_order_item(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_order_item(uuid) TO authenticated, service_role;

-- ── 2. update_order_item — правка позиции (кол-во/состав) ──
CREATE OR REPLACE FUNCTION public.update_order_item(
  p_order_item_id uuid,
  p_item_json     jsonb
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order_id        uuid;
  v_tenant_id       uuid;
  v_delivery_type   text;
  v_kitchen_queued  timestamptz;
  v_kitchen_enabled boolean;
  v_quantity        int;
  v_item            record;
BEGIN
  SELECT oi.order_id, oi.tenant_id INTO v_order_id, v_tenant_id
    FROM order_items oi WHERE oi.id = p_order_item_id;
  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'Item not found' USING ERRCODE = 'P0001';
  END IF;

  PERFORM _assert_order_editable(v_order_id);

  v_quantity := (p_item_json->>'quantity')::int;
  IF v_quantity IS NULL OR v_quantity < 1 THEN
    RAISE EXCEPTION 'Quantity must be positive' USING ERRCODE = 'P0001';
  END IF;

  -- Лочим тикеты позиции от параллельного клейма поваром.
  PERFORM 1 FROM kitchen_queue WHERE order_item_id = p_order_item_id FOR UPDATE;

  IF _order_item_kitchen_locked(p_order_item_id, v_tenant_id) THEN
    RAISE EXCEPTION 'Item already being cooked' USING ERRCODE = 'P0001';
  END IF;

  SELECT o.delivery_type, o.kitchen_queued_at INTO v_delivery_type, v_kitchen_queued
    FROM orders o WHERE o.id = v_order_id;

  UPDATE order_items SET
    dish_name           = p_item_json->>'dish_name',
    category_name       = p_item_json->>'category_name',
    price               = (p_item_json->>'price')::numeric,
    quantity            = v_quantity,
    removed_ingredients = COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_item_json->'removed_ingredients')), ARRAY[]::text[]),
    modifiers           = COALESCE(p_item_json->'modifiers', '[]'::jsonb),
    addons              = COALESCE(p_item_json->'addons', '[]'::jsonb)
  WHERE id = p_order_item_id;

  -- Кухня: пересоздать тикеты позиции под новый состав/кол-во. Сносим только
  -- живые queued (начатые отсекает guard выше), cancelled-историю оставляем.
  SELECT (modules ->> 'kitchen')::boolean INTO v_kitchen_enabled FROM tenants WHERE id = v_tenant_id;
  IF COALESCE(v_kitchen_enabled, false) AND v_kitchen_queued IS NOT NULL THEN
    DELETE FROM kitchen_queue WHERE order_item_id = p_order_item_id AND status = 'queued';
    SELECT * INTO v_item FROM order_items WHERE id = p_order_item_id;
    PERFORM _kitchen_queue_insert_item(v_tenant_id, v_order_id, v_item, v_delivery_type);
  END IF;

  PERFORM _recalc_order_totals(v_order_id);

  RETURN v_order_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_order_item(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_order_item(uuid, jsonb) TO authenticated, service_role;
