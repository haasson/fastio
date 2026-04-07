-- Fix: markSeen should not bump updated_at, otherwise tickets jump to the top
-- when selected (because listTickets sorts by updated_at DESC)

CREATE OR REPLACE FUNCTION update_support_ticket_timestamp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Skip updated_at bump when only seen timestamps changed
  IF NEW.status = OLD.status
    AND (NEW.tenant_last_seen_at IS DISTINCT FROM OLD.tenant_last_seen_at
      OR NEW.support_last_seen_at IS DISTINCT FROM OLD.support_last_seen_at)
  THEN
    RETURN NEW;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
