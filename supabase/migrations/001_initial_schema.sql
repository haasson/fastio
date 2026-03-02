-- Tenants
-- theme, contacts, workingHours, notifications, subscription → jsonb
CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  custom_domain text UNIQUE,
  theme jsonb NOT NULL DEFAULT '{}',
  contacts jsonb NOT NULL DEFAULT '{}',
  working_hours jsonb NOT NULL DEFAULT '{}',
  notifications jsonb NOT NULL DEFAULT '{}',
  subscription jsonb NOT NULL DEFAULT '{}',
  delivery_min_order numeric NOT NULL DEFAULT 0,
  delivery_fee numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Categories
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Dishes
-- photos → text[], tags → text[], ingredients → jsonb, nutrition → jsonb
CREATE TABLE dishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric NOT NULL,
  photos text[] NOT NULL DEFAULT '{}',
  ingredients jsonb NOT NULL DEFAULT '[]',
  nutrition jsonb,
  tags text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Orders
-- customer → jsonb, items → jsonb
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer jsonb NOT NULL,
  items jsonb NOT NULL,
  delivery_type text NOT NULL,
  address text,
  comment text,
  promo_code text,
  discount_amount numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL,
  delivery_fee numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL,
  status text NOT NULL DEFAULT 'new',
  payment_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Promotions
CREATE TABLE promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  banner_url text,
  discount_type text NOT NULL,
  discount_value numeric NOT NULL,
  active_from timestamptz,
  active_to timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Promo codes
CREATE TABLE promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  discount_type text NOT NULL,
  discount_value numeric NOT NULL,
  usage_limit int,
  used_count int NOT NULL DEFAULT 0,
  active_from timestamptz,
  active_to timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);
