-- Migration 088: Auto-complete reservations via pg_cron
--
-- Runs every 30 minutes:
--   pending / confirmed → no_show  (if reservation time + 30min has passed)
--   seated              → completed (if seated_at + 4 hours has passed)
--
-- NOTE: reserved_date + reserved_time are stored without timezone.
-- Until tenant timezone is implemented, comparison is done in UTC.
-- For Russian timezones (UTC+3..UTC+12) this means the cron fires
-- 3–12 hours after local reservation time — acceptable for auto-completion.

SELECT cron.schedule(
  'reservations-auto-complete',
  '*/30 * * * *',
  $$
  -- pending/confirmed past their time → no_show
  UPDATE reservations
  SET
    status     = 'no_show',
    updated_at = now()
  WHERE status IN ('pending', 'confirmed')
    AND (reserved_date + reserved_time)::timestamptz < now() - interval '30 minutes';

  -- seated for more than 4 hours → completed
  UPDATE reservations
  SET
    status     = 'completed',
    updated_at = now()
  WHERE status = 'seated'
    AND seated_at < now() - interval '4 hours';
  $$
);
