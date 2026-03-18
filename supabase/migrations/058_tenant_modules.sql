-- Replace delivery_enabled with full modules JSONB (all 10 flags)
ALTER TABLE tenants
  ADD COLUMN modules JSONB NOT NULL DEFAULT '{
    "delivery": true,
    "pickup": false,
    "modifiers": true,
    "addons": true,
    "promotions": true,
    "combos": true,
    "branches": true,
    "customRoles": false,
    "dineIn": false,
    "kitchen": false
  }';

-- Migrate existing delivery_enabled into modules
UPDATE tenants
SET modules = jsonb_set(modules, '{delivery}', to_jsonb(delivery_enabled));

ALTER TABLE tenants DROP COLUMN delivery_enabled;
