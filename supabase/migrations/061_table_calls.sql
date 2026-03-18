CREATE TABLE table_call_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_order  SMALLINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE table_calls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  table_id        UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  call_type_id    UUID REFERENCES table_call_types(id) ON DELETE SET NULL,
  call_type_name  TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

ALTER PUBLICATION supabase_realtime ADD TABLE table_calls;

-- RLS: table_call_types
ALTER TABLE table_call_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "table_call_types: member can select"
  ON table_call_types FOR SELECT
  USING (is_tenant_member(tenant_id));

CREATE POLICY "table_call_types: manager can insert"
  ON table_call_types FOR INSERT
  WITH CHECK (has_tenant_role(tenant_id, 'manager'));

CREATE POLICY "table_call_types: manager can update"
  ON table_call_types FOR UPDATE
  USING (has_tenant_role(tenant_id, 'manager'));

CREATE POLICY "table_call_types: manager can delete"
  ON table_call_types FOR DELETE
  USING (has_tenant_role(tenant_id, 'manager'));

-- RLS: table_calls
-- INSERT restricted to valid open tables of the same tenant (storefront uses service role)
ALTER TABLE table_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "table_calls: insert for valid open table"
  ON table_calls FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tables
      WHERE tables.id = table_calls.table_id
        AND tables.tenant_id = table_calls.tenant_id
        AND tables.is_open = true
        AND tables.is_active = true
    )
  );

CREATE POLICY "table_calls: member can select"
  ON table_calls FOR SELECT
  USING (is_tenant_member(tenant_id));

CREATE POLICY "table_calls: member can update"
  ON table_calls FOR UPDATE
  USING (is_tenant_member(tenant_id));
