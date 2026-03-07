-- Fix: Realtime server does ON CONFLICT (subscription_id, entity, filters)
-- but newer schema only has a 4-column unique index that includes action_filter.
-- This causes "no unique or exclusion constraint matching the ON CONFLICT specification".
-- See: https://github.com/supabase/supabase/issues/39136
CREATE UNIQUE INDEX IF NOT EXISTS ix_realtime_subscription_dedup
ON realtime.subscription (subscription_id, entity, filters);
