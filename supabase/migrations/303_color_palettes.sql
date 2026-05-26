ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS color_palettes jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN tenants.color_palettes IS
  'Пользовательская палитра по контекстам: {"delivery_zones": ["#hex"], "branches": [], "service_categories": []}';
