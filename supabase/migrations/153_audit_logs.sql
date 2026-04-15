CREATE TABLE audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name  text,
  actor_role  text,
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   text,
  entity_name text,
  payload     jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX audit_logs_tenant_id_idx ON audit_logs(tenant_id);
CREATE INDEX audit_logs_created_at_idx ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX audit_logs_entity_idx ON audit_logs(tenant_id, entity_type, entity_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings viewers can view" ON audit_logs
  FOR SELECT USING (has_permission(tenant_id, 'audit_log.view'));

CREATE POLICY "members can insert own" ON audit_logs
  FOR INSERT WITH CHECK (is_tenant_member(tenant_id) AND actor_id = auth.uid());
