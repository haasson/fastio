-- Migration 339: Scheduled orders cron — fallback to kitchen cooking status
--
-- Раньше авто-перевод созревшего предзаказа из холдинга работал ТОЛЬКО если в
-- order_scheduling_config задан nextStatusId. По умолчанию он null, поэтому при
-- невыбранном статусе заказ залипал в «Запланировано» навсегда (особенно заметно
-- на просроченных заказах — время прошло, а перевода нет).
--
-- Фикс: если nextStatusId пуст — фоллбэчимся на kitchen_config.cookingStatusId
-- (статус активной готовки). cron.schedule с тем же именем перезаписывает джобу.

SELECT cron.schedule(
  'scheduled-orders-advance',
  '* * * * *',
  $$
  WITH batch AS (
    SELECT
      o.id,
      COALESCE(
        nullif(t.order_scheduling_config ->> 'nextStatusId', ''),
        nullif(t.kitchen_config ->> 'cookingStatusId', '')
      ) AS next_id
    FROM orders o
    JOIN tenants t ON t.id = o.tenant_id
    WHERE o.scheduled_at IS NOT NULL
      AND (t.order_scheduling_config ->> 'holdingStatusId') IS NOT NULL
      AND COALESCE(
            nullif(t.order_scheduling_config ->> 'nextStatusId', ''),
            nullif(t.kitchen_config ->> 'cookingStatusId', '')
          ) IS NOT NULL
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
