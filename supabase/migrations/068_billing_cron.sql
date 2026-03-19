-- Daily billing cron: charge subscriptions at 3 AM
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'billing-daily-charge',
  '0 3 * * *',
  $$
  SELECT billing_charge_subscription(t.id)
  FROM tenants t
  WHERE t.subscription->>'status' IN ('active', 'past_due', 'trial')
    AND (
      t.subscription->>'status' = 'past_due'
      OR (t.subscription->>'renewsAt')::timestamptz <= now()
      OR (t.subscription->>'status' = 'trial' AND (t.subscription->>'trialEndsAt')::timestamptz <= now())
    );
  $$
);
