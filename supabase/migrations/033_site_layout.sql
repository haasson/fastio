ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS site_layout jsonb NOT NULL DEFAULT '{}';
