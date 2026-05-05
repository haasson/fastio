-- Migration 251: add service_name to appointment_created event meta.
--
-- Why: with multi-service visits, one visit produces N appointment_created
-- events (one per appointment). Without service_name they all look identical
-- in the timeline. Storing the snapshot lets the UI show
-- "Запись создана: Массаж спины" instead of two indistinguishable lines.
--
-- Backward compat: old events without service_name render fine —
-- formatAppointmentEventText falls back to the generic label.

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
    jsonb_build_object(
      'source',       v_source,
      'service_name', NEW.service_name
    )
  );
  RETURN NEW;
END;
$$;
