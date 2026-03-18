CREATE TABLE tables (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  is_open       BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  opened_at     TIMESTAMPTZ,
  capacity      INTEGER,
  tags          TEXT[] NOT NULL DEFAULT '{}',
  position_x    NUMERIC,
  position_y    NUMERIC,
  shape         TEXT NOT NULL DEFAULT 'rectangle',
  table_width   NUMERIC NOT NULL DEFAULT 120,
  table_height  NUMERIC NOT NULL DEFAULT 80,
  rotation      SMALLINT NOT NULL DEFAULT 0,
  color         TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tables_shape_check CHECK (shape IN ('rectangle', 'circle'))
);

CREATE INDEX idx_tables_tenant_id ON tables(tenant_id);

ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tables: members can select"
  ON tables FOR SELECT
  USING (is_tenant_member(tenant_id));

CREATE POLICY "tables: members can insert"
  ON tables FOR INSERT
  WITH CHECK (is_tenant_member(tenant_id));

CREATE POLICY "tables: members can update"
  ON tables FOR UPDATE
  USING (is_tenant_member(tenant_id));
