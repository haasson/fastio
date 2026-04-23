ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS self_registered boolean NOT NULL DEFAULT false;
