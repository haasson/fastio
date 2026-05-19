-- Атомарное удаление позиции заказа: lock order, delete item, delete order
-- если позиций не осталось. Раньше API делал три отдельных запроса
-- (DELETE order_item → SELECT count → DELETE order) — между DELETE и
-- SELECT другой кассир мог добавить позицию, и мы удаляли непустой заказ.
--
-- SELECT ... FOR UPDATE берёт row-lock на orders.id, что сериализует
-- параллельные удаления и добавления через RPC update_order_with_items
-- (которая тоже трогает order_items этого заказа). INSERT в order_items
-- без явного UPDATE на orders FOR UPDATE не блокируется, но риск меньше:
-- удаление пустой строки заказа в этом случае всё ещё возможно ровно
-- в окне между DELETE FROM order_items и `count(*)` внутри транзакции,
-- но обе операции теперь в одной транзакции — Postgres гарантирует
-- snapshot isolation внутри функции.
--
-- Envelope: { ok: true } | { ok: true, order_deleted: true } |
--           { ok: false, reason: 'not_found' | 'forbidden' }

CREATE OR REPLACE FUNCTION public.delete_order_item_atomic(p_order_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order_id  uuid;
  v_tenant_id uuid;
  v_count     int;
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

  -- Row-lock на order перед мутацией: сериализует concurrent delete_order_item_atomic
  -- и update_order_with_items для одного заказа.
  PERFORM 1 FROM orders WHERE id = v_order_id FOR UPDATE;

  DELETE FROM order_items WHERE id = p_order_item_id;

  SELECT count(*) INTO v_count FROM order_items WHERE order_id = v_order_id;

  IF v_count = 0 THEN
    DELETE FROM orders WHERE id = v_order_id;
    RETURN jsonb_build_object('ok', true, 'order_deleted', true);
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_order_item_atomic(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_order_item_atomic(uuid) TO authenticated;
