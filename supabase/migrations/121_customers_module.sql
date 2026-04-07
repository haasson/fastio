-- Add 'customers' module: customer login/registration on storefront.
-- Defaults: true for food/retail, false for services.

-- 1. Add customers flag to all tenants (default true — existing food/retail keep working)
UPDATE tenants
SET modules = modules || '{"customers": true}'::jsonb
WHERE business_type IS NULL OR business_type != 'services';

UPDATE tenants
SET modules = modules || '{"customers": false}'::jsonb
WHERE business_type = 'services';

-- 2. Update column default so new tenants get the flag
ALTER TABLE tenants
  ALTER COLUMN modules SET DEFAULT '{
    "delivery": true,
    "pickup": false,
    "modifiers": true,
    "addons": true,
    "promotions": true,
    "combos": true,
    "branches": true,
    "customRoles": false,
    "dineIn": false,
    "kitchen": false,
    "customers": true
  }';

-- 3. Add module config row
INSERT INTO module_configs (key, name, description, icon, required_plan_key, sort_order)
VALUES ('customers', 'Клиенты', 'Регистрация и вход клиентов на сайте — личный кабинет, история заказов', 'users', 'business', 10);
