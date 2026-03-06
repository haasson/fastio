-- 1. branches table
CREATE TABLE branches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  address text,
  phone text,
  is_active boolean DEFAULT true NOT NULL,
  working_hours jsonb,
  delivery_min_order numeric(10,2),
  delivery_fee numeric(10,2),
  notifications jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 2. Price overrides per branch
CREATE TABLE dish_branch_prices (
  dish_id uuid REFERENCES dishes(id) ON DELETE CASCADE NOT NULL,
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
  price numeric(10,2) NOT NULL,
  PRIMARY KEY (dish_id, branch_id)
);

-- 3. Add branch_id to orders
ALTER TABLE orders ADD COLUMN branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;

-- 4. branch_ids on tenant_members: [] = all branches
ALTER TABLE tenant_members ADD COLUMN branch_ids uuid[] DEFAULT '{}' NOT NULL;

-- 5. branch_ids on promotions: [] = all branches
ALTER TABLE promotions ADD COLUMN branch_ids uuid[] DEFAULT '{}' NOT NULL;

-- 6. Indexes
CREATE INDEX idx_branches_tenant_id ON branches(tenant_id);
CREATE INDEX idx_orders_branch_id ON orders(branch_id);
CREATE INDEX idx_dish_branch_prices_branch_id ON dish_branch_prices(branch_id);

-- 7. updated_at trigger
CREATE TRIGGER branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 8. RLS for branches
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view branches" ON branches
  FOR SELECT USING (is_tenant_member(tenant_id));
CREATE POLICY "admin+ can insert branches" ON branches
  FOR INSERT WITH CHECK (has_tenant_role(tenant_id, 'admin'));
CREATE POLICY "admin+ can update branches" ON branches
  FOR UPDATE USING (has_tenant_role(tenant_id, 'admin'));
CREATE POLICY "admin+ can delete branches" ON branches
  FOR DELETE USING (has_tenant_role(tenant_id, 'admin'));

-- 9. RLS for dish_branch_prices
ALTER TABLE dish_branch_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public can view dish branch prices" ON dish_branch_prices
  FOR SELECT USING (true);
CREATE POLICY "manager+ can manage dish branch prices" ON dish_branch_prices
  FOR ALL USING (
    has_tenant_role(
      (SELECT tenant_id FROM branches WHERE id = branch_id),
      'manager'
    )
  );

-- 10. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE branches;
