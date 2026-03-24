-- Фикс cron: учитывать таймзону тенанта при автозавершении бронирований.
--
-- reserved_date + reserved_time хранятся в "наивном" времени тенанта.
-- Для корректного сравнения с now() нужно интерпретировать их в таймзоне тенанта.
--
-- TODO: когда у филиалов появится своя таймзона,
-- нужно будет джойнить branches и использовать COALESCE(b.timezone, t.timezone)

DO $$ BEGIN
  PERFORM cron.unschedule('reservations-auto-complete');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'reservations-auto-complete',
  '*/30 * * * *',
  $$
  -- pending/confirmed past their time → no_show
  UPDATE reservations r
  SET
    status     = 'no_show',
    updated_at = now()
  FROM tenants t
  WHERE r.tenant_id = t.id
    AND r.status IN ('pending', 'confirmed')
    AND (
      (r.reserved_date || ' ' || r.reserved_time)::timestamp
        AT TIME ZONE COALESCE(t.timezone, 'Europe/Moscow')
    ) < now() - interval '30 minutes';

  -- seated for more than 4 hours → completed
  UPDATE reservations
  SET
    status     = 'completed',
    updated_at = now()
  WHERE status = 'seated'
    AND seated_at < now() - interval '4 hours';
  $$
);
