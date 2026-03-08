CREATE TABLE order_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name  text,
  actor_role  text,
  event_type  text NOT NULL,
  meta        jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view" ON order_events
  FOR SELECT USING (is_tenant_member(tenant_id));

CREATE POLICY "members can insert" ON order_events
  FOR INSERT WITH CHECK (is_tenant_member(tenant_id));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE order_events;

-- Trigger: log order_created (catches storefront orders where auth.uid() is null)
CREATE OR REPLACE FUNCTION log_order_created() RETURNS trigger AS $$
BEGIN
  INSERT INTO order_events (order_id, tenant_id, actor_id, event_type, meta)
  VALUES (
    NEW.id,
    NEW.tenant_id,
    auth.uid(),
    'order_created',
    jsonb_build_object(
      'source', CASE WHEN auth.uid() IS NULL THEN 'storefront' ELSE 'admin' END
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER order_created_trigger
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION log_order_created();
