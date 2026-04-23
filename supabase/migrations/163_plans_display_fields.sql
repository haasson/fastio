-- ═══════════════════════════════════════════════════════════════════════════════
-- 163: Plans display fields + populate features matrix
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Add display fields for landing page
ALTER TABLE plans ADD COLUMN IF NOT EXISTS badge text DEFAULT NULL;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

-- 2. Populate features matrix (delta — only what each plan ADDS)

UPDATE plans SET features = '{}'::jsonb WHERE key IN ('retail-showcase', 'services-showcase');

UPDATE plans SET features = jsonb_build_object(
  'modules', jsonb_build_object(
    'delivery', true,
    'pickup', true,
    'modifiers', true,
    'addons', true,
    'promotions', true,
    'customers', true,
    'team', true
  ),
  'site', jsonb_build_object('telegramNotifications', true)
) WHERE key = 'retail-start';

UPDATE plans SET features = jsonb_build_object(
  'modules', jsonb_build_object(
    'combos', true,
    'kitchen', true,
    'dineIn', true,
    'reservations', true,
    'branches', true,
    'customRoles', true
  ),
  'menu', jsonb_build_object(
    'virtualCategories', true,
    'ingredients', true
  )
) WHERE key = 'retail-pro';

UPDATE plans SET features = jsonb_build_object(
  'modules', jsonb_build_object(
    'services', true,
    'customers', true,
    'team', true
  ),
  'site', jsonb_build_object('telegramNotifications', true),
  'resources', jsonb_build_object('max', 3)
) WHERE key = 'services-start';

UPDATE plans SET features = jsonb_build_object(
  'modules', jsonb_build_object(
    'branches', true,
    'customRoles', true
  ),
  'resources', jsonb_build_object('max', 0)
) WHERE key = 'services-pro';

-- 3. Set badge and is_featured for landing
UPDATE plans SET badge = 'Популярный', is_featured = true
WHERE key IN ('retail-start', 'services-start');
