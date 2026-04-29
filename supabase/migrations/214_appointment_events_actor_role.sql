-- Migration 214: populate appointment_events.actor_role from the trigger.
--
-- Why: 191 declared the column but never wrote to it; only meta.source held
-- the same info as a JSON key. Promote it to a typed column so audit queries
-- can filter without parsing jsonb.
--
-- Values mirror the existing meta.source vocabulary: 'admin' (auth.uid()
-- present) and 'storefront' (anonymous booking via service_role).

CREATE OR REPLACE FUNCTION log_appointment_created() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_source text := CASE WHEN auth.uid() IS NULL THEN 'storefront' ELSE 'admin' END;
BEGIN
  INSERT INTO appointment_events (appointment_id, tenant_id, actor_id, actor_role, event_type, meta)
  VALUES (
    NEW.id,
    NEW.tenant_id,
    auth.uid(),
    v_source,
    'appointment_created',
    jsonb_build_object('source', v_source)
  );
  RETURN NEW;
END;
$$;
