CREATE TABLE appointment_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name      text,
  actor_role      text,
  event_type      text NOT NULL,
  meta            jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_appointment_events_appt ON appointment_events(appointment_id, created_at);

-- RLS
ALTER TABLE appointment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view" ON appointment_events
  FOR SELECT USING (is_tenant_member(tenant_id));

CREATE POLICY "members can insert" ON appointment_events
  FOR INSERT WITH CHECK (is_tenant_member(tenant_id));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE appointment_events;

-- Trigger: log appointment_created (включая создание из сторфронта, где auth.uid() = null)
CREATE OR REPLACE FUNCTION log_appointment_created() RETURNS trigger AS $$
BEGIN
  INSERT INTO appointment_events (appointment_id, tenant_id, actor_id, event_type, meta)
  VALUES (
    NEW.id,
    NEW.tenant_id,
    auth.uid(),
    'appointment_created',
    jsonb_build_object(
      'source', CASE WHEN auth.uid() IS NULL THEN 'storefront' ELSE 'admin' END
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER appointment_created_trigger
  AFTER INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION log_appointment_created();
