CREATE TABLE dish_tag_orders (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tag text NOT NULL,
  dish_id uuid NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, tag, dish_id)
);

ALTER TABLE dish_tag_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dish_tag_orders: public read"
  ON dish_tag_orders FOR SELECT
  USING (true);

CREATE POLICY "dish_tag_orders: owner can insert"
  ON dish_tag_orders FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM tenants WHERE id = tenant_id AND owner_id = auth.uid())
  );

CREATE POLICY "dish_tag_orders: owner can update"
  ON dish_tag_orders FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM tenants WHERE id = tenant_id AND owner_id = auth.uid())
  );

CREATE POLICY "dish_tag_orders: owner can delete"
  ON dish_tag_orders FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM tenants WHERE id = tenant_id AND owner_id = auth.uid())
  );
