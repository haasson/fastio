-- ═══════════════════════════════════════════════════════════════════════════════
-- 160: Split plans by business type (6 plans) + features jsonb
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Add business_type and features columns
ALTER TABLE plans ADD COLUMN business_type text NOT NULL DEFAULT 'retail';
ALTER TABLE plans ADD COLUMN features jsonb NOT NULL DEFAULT '{"menu":{"virtualCategories":false,"ingredients":false},"branches":{"max":0}}';

-- 2. Drop max_branches (moved into features.branches.max)
ALTER TABLE plans DROP COLUMN IF EXISTS max_branches;

-- 3. Drop FK: required_plan_key хранит уровень (start/pro), а не ссылку на конкретный план
ALTER TABLE module_configs DROP CONSTRAINT IF EXISTS module_configs_required_plan_key_fkey;

-- 4. Rename active plans → retail-* and set their features
UPDATE plans SET
  key = 'retail-showcase',
  business_type = 'retail',
  features = '{"menu":{"virtualCategories":false,"ingredients":false},"branches":{"max":0}}'
WHERE key = 'showcase';

UPDATE plans SET
  key = 'retail-start',
  business_type = 'retail',
  features = '{"menu":{"virtualCategories":true,"ingredients":true},"branches":{"max":0}}'
WHERE key = 'start';

UPDATE plans SET
  key = 'retail-pro',
  business_type = 'retail',
  features = '{"menu":{"virtualCategories":true,"ingredients":true},"branches":{"max":0}}'
WHERE key = 'pro';

-- 5. Insert services variants (same sort_order, services-specific features)
INSERT INTO plans (key, name, description, price, sort_order, is_active, business_type, features)
VALUES
  ('services-showcase', 'Витрина',  'Только сайт — без онлайн-записи',          0,    0, true, 'services',
   '{"menu":{"virtualCategories":false,"ingredients":false},"branches":{"max":0}}'),
  ('services-start',   'Старт',    'Онлайн-запись: до 3 ресурсов',              690,  1, true, 'services',
   '{"menu":{"virtualCategories":false,"ingredients":false},"branches":{"max":3}}'),
  ('services-pro',     'Про',      'Онлайн-запись без ограничений + филиалы',   3490, 2, true, 'services',
   '{"menu":{"virtualCategories":false,"ingredients":false},"branches":{"max":0}}');

-- 6. Remove old deactivated legacy plans
DELETE FROM plans WHERE key IN ('service', 'business');

-- 7. Migrate existing tenant subscriptions (all existing are retail)
DO $$
BEGIN
  SET LOCAL app.billing_function = 'true';

  UPDATE tenants
  SET subscription = jsonb_set(subscription, '{plan}', '"retail-showcase"')
  WHERE subscription->>'plan' = 'showcase';

  UPDATE tenants
  SET subscription = jsonb_set(subscription, '{plan}', '"retail-start"')
  WHERE subscription->>'plan' = 'start';

  UPDATE tenants
  SET subscription = jsonb_set(subscription, '{plan}', '"retail-pro"')
  WHERE subscription->>'plan' = 'pro';
END;
$$;
