-- Auto-close stale support tickets via pg_cron
-- Condition: status = 'waiting_for_reply' and no activity for 5 days
-- (means support wrote last and tenant never replied)
-- Tenant can still reopen by sending a new message (handled by existing trigger)

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION auto_close_stale_support_tickets()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE support_tickets
  SET status = 'resolved'
  WHERE status = 'waiting_for_reply'
    AND updated_at < now() - interval '5 days';
$$;

SELECT cron.schedule(
  'auto-close-stale-support-tickets',
  '0 3 * * *',
  'SELECT auto_close_stale_support_tickets()'
);
