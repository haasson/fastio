ALTER TABLE tenants
  ADD COLUMN delivery_mode text NOT NULL DEFAULT 'zones';
