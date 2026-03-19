-- Plans table: tariff hierarchy for billing
CREATE TABLE plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Public read: admin, storefront, landing
CREATE POLICY "plans: anyone can select" ON plans
  FOR SELECT USING (true);

-- Write — only via service_role (backoffice)

INSERT INTO plans (key, name, description, price, sort_order) VALUES
  ('start',    'Старт',   'Базовый тариф для старта',              0,    0),
  ('business', 'Бизнес',  'Расширенные возможности для бизнеса',    1990, 1),
  ('pro',      'Про',     'Максимум возможностей и кастомизации',   4990, 2);
