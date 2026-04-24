ALTER TABLE categories ADD COLUMN IF NOT EXISTS slug text;

CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_tenant_unique
  ON categories(tenant_id, slug)
  WHERE slug IS NOT NULL AND deleted_at IS NULL;
