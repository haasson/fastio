-- Customers (per-tenant, linked to auth.users)
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  phone text,
  email text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, auth_user_id)
);

CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_customers_auth_user ON customers(auth_user_id);

-- Customer addresses
CREATE TABLE customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  address text NOT NULL,
  coordinates point NOT NULL,
  entrance text,
  floor text,
  apartment text,
  intercom text,
  comment text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_addresses_customer ON customer_addresses(customer_id);

-- Add customer_id to orders (nullable for guest orders)
ALTER TABLE orders ADD COLUMN customer_id uuid REFERENCES customers(id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);

-- RLS for customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers: user can read own"
  ON customers FOR SELECT
  USING (auth.uid() = auth_user_id);

CREATE POLICY "customers: user can update own"
  ON customers FOR UPDATE
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "customers: service role full access"
  ON customers FOR ALL
  USING (auth.role() = 'service_role');

-- RLS for customer_addresses
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_addresses: owner can manage"
  ON customer_addresses FOR ALL
  USING (
    customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "customer_addresses: service role full access"
  ON customer_addresses FOR ALL
  USING (auth.role() = 'service_role');

-- Allow tenant members to see customers (for backoffice)
CREATE POLICY "customers: tenant member can read"
  ON customers FOR SELECT
  USING (is_tenant_member(tenant_id));
