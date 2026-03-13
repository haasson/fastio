ALTER TABLE categories ADD COLUMN type text NOT NULL DEFAULT 'regular'
  CHECK (type IN ('regular', 'combo', 'new', 'hit'));

CREATE UNIQUE INDEX categories_tenant_special_type
  ON categories (tenant_id, type)
  WHERE type != 'regular';

CREATE TABLE combos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  price numeric NOT NULL DEFAULT 0,
  photos text[] DEFAULT '{}',
  tags text[] DEFAULT '{}',
  active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE combo_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id uuid NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
  dish_id uuid NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  sort_order int DEFAULT 0,
  UNIQUE (combo_id, dish_id)
);

ALTER TABLE combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "combos: public read"
  ON combos FOR SELECT
  USING (true);

CREATE POLICY "combos: owner can insert"
  ON combos FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM tenants WHERE id = tenant_id AND owner_id = auth.uid())
  );

CREATE POLICY "combos: owner can update"
  ON combos FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM tenants WHERE id = tenant_id AND owner_id = auth.uid())
  );

CREATE POLICY "combos: owner can delete"
  ON combos FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM tenants WHERE id = tenant_id AND owner_id = auth.uid())
  );

CREATE POLICY "combo_items: public read"
  ON combo_items FOR SELECT
  USING (true);

CREATE POLICY "combo_items: owner can insert"
  ON combo_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM combos c
      JOIN tenants t ON t.id = c.tenant_id
      WHERE c.id = combo_id AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY "combo_items: owner can update"
  ON combo_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM combos c
      JOIN tenants t ON t.id = c.tenant_id
      WHERE c.id = combo_id AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY "combo_items: owner can delete"
  ON combo_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM combos c
      JOIN tenants t ON t.id = c.tenant_id
      WHERE c.id = combo_id AND t.owner_id = auth.uid()
    )
  );
