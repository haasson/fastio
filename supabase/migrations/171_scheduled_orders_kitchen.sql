-- Migration 171: Scheduled orders — holding status + auto-advance cron
--
-- Заказы «ко времени» ждут в системном статусе «Запланировано»
-- (holdingStatusId). Раз в минуту pg_cron переводит созревшие заказы
-- в nextStatusId за kitchen_lead_minutes до scheduled_at. Кухонный
-- триггер отрабатывает как для обычных заказов — спецлогики не нужно.

ALTER TABLE orders
  ADD COLUMN kitchen_lead_minutes int DEFAULT NULL;

-- ─── pg_cron: advance scheduled orders from holding to next status ───────────
--
-- ORDER BY + LIMIT + FOR UPDATE SKIP LOCKED:
--   * ограничиваем волну, если одновременно созрело много заказов
--   * самые горящие (ближайший scheduled_at) идут первыми
--   * SKIP LOCKED — если строку держит оператор, пропускаем, вернёмся через минуту

SELECT cron.schedule(
  'scheduled-orders-advance',
  '* * * * *',
  $$
  WITH batch AS (
    SELECT o.id, (t.order_scheduling_config ->> 'nextStatusId') AS next_id
    FROM orders o
    JOIN tenants t ON t.id = o.tenant_id
    WHERE o.scheduled_at IS NOT NULL
      AND (t.order_scheduling_config ->> 'holdingStatusId') IS NOT NULL
      AND (t.order_scheduling_config ->> 'nextStatusId') IS NOT NULL
      AND o.status = (t.order_scheduling_config ->> 'holdingStatusId')
      AND o.scheduled_at - (COALESCE(o.kitchen_lead_minutes, 60) * interval '1 minute') <= now()
    ORDER BY o.scheduled_at
    LIMIT 200
    FOR UPDATE OF o SKIP LOCKED
  )
  UPDATE orders o
  SET status = batch.next_id
  FROM batch
  WHERE o.id = batch.id;
  $$
);

-- ─── RPC: ensure "Запланировано" holding status exists ───────────────────────

CREATE OR REPLACE FUNCTION ensure_scheduled_holding_status(p_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _existing_id uuid;
  _new_id      uuid;
  _max_pos     int;
BEGIN
  -- Return existing if already configured and the status record still exists
  SELECT (order_scheduling_config ->> 'holdingStatusId')::uuid
    INTO _existing_id
    FROM tenants
   WHERE id = p_tenant_id;

  IF _existing_id IS NOT NULL
    AND EXISTS(SELECT 1 FROM order_statuses WHERE id = _existing_id AND tenant_id = p_tenant_id)
  THEN
    RETURN _existing_id;
  END IF;

  -- Find the max position in the 'new' group
  SELECT COALESCE(MAX(position), -1) INTO _max_pos
    FROM order_statuses
   WHERE tenant_id = p_tenant_id AND group_type = 'new';

  -- Shift all statuses after the new group up by 1 to make room
  UPDATE order_statuses
  SET position = position + 1
  WHERE tenant_id = p_tenant_id AND position > _max_pos;

  -- Create the holding status last in the new group
  INSERT INTO order_statuses (tenant_id, name, group_type, position, quick_actions, kitchen_visible)
  VALUES (p_tenant_id, 'Запланировано', 'new', _max_pos + 1, '{}', false)
  RETURNING id INTO _new_id;

  -- Store holdingStatusId in tenant config
  UPDATE tenants
  SET order_scheduling_config = COALESCE(order_scheduling_config, '{}')::jsonb
    || jsonb_build_object('holdingStatusId', _new_id::text)
  WHERE id = p_tenant_id;

  RETURN _new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION ensure_scheduled_holding_status(uuid) TO authenticated;
