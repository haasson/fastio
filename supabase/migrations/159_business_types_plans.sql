-- ═══════════════════════════════════════════════════════════════════════════════
-- 159: Business types and plans — retail/services + showcase/start/pro
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Add menu_style to tenants (default 'food' for existing retail/food tenants)
ALTER TABLE tenants ADD COLUMN menu_style text NOT NULL DEFAULT 'food';

-- 2. Convert 'food' → 'retail', keep menu_style='food' for them
UPDATE tenants SET business_type = 'retail' WHERE business_type = 'food';

-- 3. Restructure plans
-- Reactivate and update 'start' (deactivated in migration 116)
UPDATE plans SET
  name = 'Старт',
  description = 'Базовый операционный функционал: заказы, доставка и самовывоз',
  price = 490,
  sort_order = 1,
  is_active = true
WHERE key = 'start';

-- Reactivate and update 'pro' (deactivated in migration 116)
UPDATE plans SET
  name = 'Про',
  description = 'Полный функционал: кухня, столы, бронирования, комбо и филиалы',
  price = 2490,
  sort_order = 2,
  is_active = true
WHERE key = 'pro';

-- Add 'showcase' plan (free, only site without orders)
INSERT INTO plans (key, name, description, price, sort_order, max_branches)
VALUES ('showcase', 'Витрина', 'Только сайт — без заказов и записи', 0, 0, 0)
ON CONFLICT (key) DO UPDATE SET
  name = 'Витрина',
  description = 'Только сайт — без заказов и записи',
  price = 0,
  sort_order = 0,
  is_active = true;

-- Deactivate old plans
UPDATE plans SET is_active = false WHERE key IN ('service', 'business');

-- 4. Migrate tenant subscriptions: service → showcase, business → pro
DO $$
BEGIN
  SET LOCAL app.billing_function = 'true';

  UPDATE tenants
  SET subscription = jsonb_set(subscription, '{plan}', '"showcase"')
  WHERE subscription->>'plan' = 'service';

  UPDATE tenants
  SET subscription = jsonb_set(subscription, '{plan}', '"pro"')
  WHERE subscription->>'plan' = 'business';
END;
$$;

-- 5. Add business_types and menu_styles columns to module_configs
ALTER TABLE module_configs ADD COLUMN business_types jsonb NOT NULL DEFAULT '["retail","services"]'::jsonb;
ALTER TABLE module_configs ADD COLUMN menu_styles jsonb DEFAULT NULL;

-- 6. Update required_plan_key (business → start/pro), set business_types and menu_styles per matrix
UPDATE module_configs SET required_plan_key = 'start', business_types = '["retail"]'            WHERE key = 'delivery';
UPDATE module_configs SET required_plan_key = 'start', business_types = '["retail"]'            WHERE key = 'pickup';
UPDATE module_configs SET required_plan_key = 'start', business_types = '["retail"]'            WHERE key = 'modifiers';
UPDATE module_configs SET required_plan_key = 'start', business_types = '["retail"]'            WHERE key = 'addons';
UPDATE module_configs SET required_plan_key = 'start', business_types = '["retail"]'            WHERE key = 'promotions';
UPDATE module_configs SET required_plan_key = 'pro',   business_types = '["retail"]', menu_styles = '["food"]' WHERE key = 'combos';
UPDATE module_configs SET required_plan_key = 'pro',   business_types = '["retail"]', menu_styles = '["food"]' WHERE key = 'kitchen';
UPDATE module_configs SET required_plan_key = 'pro',   business_types = '["retail"]', menu_styles = '["food"]' WHERE key = 'dineIn';
UPDATE module_configs SET required_plan_key = 'pro',   business_types = '["retail","services"]'               WHERE key = 'customRoles';
UPDATE module_configs SET required_plan_key = 'pro',   business_types = '["retail"]', menu_styles = '["food"]' WHERE key = 'reservations';
UPDATE module_configs SET required_plan_key = 'start', business_types = '["retail","services"]'               WHERE key = 'customers';

-- 7. Add 'services' booking module (for services business type)
INSERT INTO module_configs (key, name, description, icon, required_plan_key, sort_order, business_types)
VALUES ('services', 'Онлайн-запись', 'Принимайте онлайн-записи к специалистам и на мероприятия', 'calendarCheck', 'start', 10, '["services"]')
ON CONFLICT (key) DO UPDATE SET
  required_plan_key = 'start',
  business_types = '["services"]',
  is_active = true;

-- 8. Re-add branches as plan-gated module (was removed in migration 096)
INSERT INTO module_configs (key, name, description, icon, required_plan_key, sort_order, business_types)
VALUES ('branches', 'Филиалы', 'Несколько точек под одним аккаунтом с общей аналитикой', 'mapPin', 'pro', 20, '["retail","services"]')
ON CONFLICT (key) DO UPDATE SET
  required_plan_key = 'pro',
  business_types = '["retail","services"]',
  is_active = true;

-- 9. Add new module keys to existing tenant modules jsonb
UPDATE tenants
SET modules = modules || '{"services": false, "branches": false}'::jsonb
WHERE modules IS NOT NULL;
