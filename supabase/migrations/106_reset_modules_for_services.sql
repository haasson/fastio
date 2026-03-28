-- Force-disable modules that are incompatible with the 'services' business type.
-- Mirrors the resolveModules() logic in @fastio/shared so DB state stays consistent.
UPDATE tenants
SET modules = modules
  || '{"delivery": false, "pickup": false, "dineIn": false, "kitchen": false, "combos": false, "promotions": false}'::jsonb
WHERE business_type = 'services';
