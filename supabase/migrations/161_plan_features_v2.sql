-- ═══════════════════════════════════════════════════════════════════════════════
-- 161: Replace plan features with delta-based structure (only what each tier ADDS)
-- ═══════════════════════════════════════════════════════════════════════════════

-- retail-showcase: no module unlocks (basic site only, always available)
UPDATE plans SET features = '{}' WHERE key = 'retail-showcase';

-- retail-start: adds orders, modifiers, promotions, customers, telegram
UPDATE plans SET features = '{
  "modules": {
    "delivery": true,
    "pickup": true,
    "modifiers": true,
    "addons": true,
    "promotions": true,
    "customers": true
  },
  "site": { "telegramNotifications": true }
}' WHERE key = 'retail-start';

-- retail-pro: adds KDS, QR tables, reservations, combos, branches, roles + menu features
UPDATE plans SET features = '{
  "modules": {
    "combos": true,
    "kitchen": true,
    "dineIn": true,
    "reservations": true,
    "branches": true,
    "customRoles": true
  },
  "menu": { "virtualCategories": true, "ingredients": true }
}' WHERE key = 'retail-pro';

-- services-showcase: no module unlocks
UPDATE plans SET features = '{}' WHERE key = 'services-showcase';

-- services-start: adds online booking, customers, 3 resources, telegram
UPDATE plans SET features = '{
  "modules": { "services": true, "customers": true },
  "resources": { "max": 3 },
  "site": { "telegramNotifications": true }
}' WHERE key = 'services-start';

-- services-pro: adds branches, custom roles, unlimited resources
UPDATE plans SET features = '{
  "modules": { "branches": true, "customRoles": true },
  "resources": { "max": 0 }
}' WHERE key = 'services-pro';

-- Update column default to empty object
ALTER TABLE plans ALTER COLUMN features SET DEFAULT '{}';
