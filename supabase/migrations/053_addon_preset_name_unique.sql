-- Enforce unique preset names per tenant
ALTER TABLE addon_presets
  ADD CONSTRAINT addon_presets_tenant_name_unique UNIQUE (tenant_id, name);
