-- ─────────────────────────────────────
-- Drop old role columns and enum type
-- Data already migrated to role_id in migration 108
-- ─────────────────────────────────────

-- Drop old role columns
ALTER TABLE tenant_members DROP COLUMN IF EXISTS role;
ALTER TABLE tenant_invitations DROP COLUMN IF EXISTS role;

-- Drop deprecated function first (depends on enum type)
DROP FUNCTION IF EXISTS has_tenant_role(uuid, tenant_role);

-- Drop the enum type
DROP TYPE IF EXISTS tenant_role;
