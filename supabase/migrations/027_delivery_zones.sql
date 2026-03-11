CREATE TABLE delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#FF5500',
  coordinates jsonb NOT NULL,  -- [[lng, lat], ...] массив точек полигона
  delivery_fee numeric NOT NULL DEFAULT 0,
  min_order numeric NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX delivery_zones_branch_id_idx ON delivery_zones(branch_id);
CREATE INDEX delivery_zones_tenant_id_idx ON delivery_zones(tenant_id);

ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage their delivery zones"
  ON delivery_zones
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE delivery_zones;

CREATE OR REPLACE FUNCTION set_delivery_zones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_delivery_zones_updated_at
  BEFORE UPDATE ON delivery_zones
  FOR EACH ROW
  EXECUTE FUNCTION set_delivery_zones_updated_at();
