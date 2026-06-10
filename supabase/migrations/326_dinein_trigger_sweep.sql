-- 326: сведение order-level триггеров под модель «стол = один чек».

-- (1) Telegram-уведомление «новый заказ» НЕ слать для dine_in:
-- чек создаётся пустым на открытии стола (нет смысла), а гость дописывает
-- позиции БЕЗ INSERT в orders (триггер всё равно не сработал бы). Персонал
-- видит pending realtime'ом на доске «Столы». (решение №2)
CREATE OR REPLACE FUNCTION public.notify_new_order_telegram()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'net', 'public', 'vault'
AS $function$
DECLARE
  v_notify_url text;
  v_secret     text;
BEGIN
  IF NEW.delivery_type = 'dine_in' THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_notify_url
  FROM vault.decrypted_secrets
  WHERE name = 'telegram_notify_url';

  IF v_notify_url IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'telegram_internal_secret';

  PERFORM net.http_post(
    url     := v_notify_url,
    body    := jsonb_build_object('orderId', NEW.id, 'tenantId', NEW.tenant_id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', COALESCE(v_secret, '')
    )
  );

  RETURN NEW;
END;
$function$;

-- (2) Удаление последней позиции НЕ должно удалять открытый dine-in чек:
-- order — это сам чек, он живёт пустым пока стол открыт (иначе ломается
-- инвариант is_open ⟺ открытый чек + партиал-уникальный индекс).
-- kitchen_queue по удалённой позиции гасит trg_kitchen_queue_on_item_delete.
CREATE OR REPLACE FUNCTION public.delete_order_item_atomic(p_order_item_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order_id      uuid;
  v_tenant_id     uuid;
  v_delivery_type text;
  v_check_status  text;
  v_count         int;
BEGIN
  SELECT oi.order_id, oi.tenant_id
    INTO v_order_id, v_tenant_id
    FROM order_items oi
   WHERE oi.id = p_order_item_id;

  IF v_order_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF NOT has_permission(v_tenant_id, 'orders.edit') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  PERFORM 1 FROM orders WHERE id = v_order_id FOR UPDATE;

  SELECT delivery_type, check_status INTO v_delivery_type, v_check_status
    FROM orders WHERE id = v_order_id;

  DELETE FROM order_items WHERE id = p_order_item_id;

  SELECT count(*) INTO v_count FROM order_items WHERE order_id = v_order_id;

  -- Пересчёт сумм для живого dine-in чека (subtotal/total из оставшихся позиций).
  IF v_delivery_type = 'dine_in' AND v_check_status = 'open' THEN
    UPDATE orders o SET
      subtotal = COALESCE((SELECT sum(price * quantity) FROM order_items WHERE order_id = o.id), 0),
      total    = COALESCE((SELECT sum(price * quantity) FROM order_items WHERE order_id = o.id), 0)
    WHERE o.id = v_order_id;

    RETURN jsonb_build_object('ok', true, 'order_deleted', false);
  END IF;

  -- Не-dine_in (или закрытый чек): прежнее поведение — пустой order удаляем.
  IF v_count = 0 THEN
    DELETE FROM orders WHERE id = v_order_id;
    RETURN jsonb_build_object('ok', true, 'order_deleted', true);
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- Снимаем дефолтный anon/PUBLIC EXECUTE (Supabase pg_default_acl грантит anon напрямую).
-- delete_order_item_atomic — admin-only (внутренний has_permission гард), anon тут не нужен.
REVOKE ALL ON FUNCTION public.delete_order_item_atomic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_order_item_atomic(uuid) TO authenticated;
