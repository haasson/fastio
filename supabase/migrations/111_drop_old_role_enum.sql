-- ─────────────────────────────────────
-- Drop old role columns and enum type
-- Data already migrated to role_id in migration 108
-- ─────────────────────────────────────

-- Drop old role columns
ALTER TABLE tenant_members DROP COLUMN IF EXISTS role;
ALTER TABLE tenant_invitations DROP COLUMN IF EXISTS role;

-- Drop policies that depend on has_tenant_role (replaced by permission-based system in migration 109)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE qual LIKE '%has_tenant_role%' OR with_check LIKE '%has_tenant_role%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END;
$$;

-- Drop deprecated function (depends on enum type)
DROP FUNCTION IF EXISTS has_tenant_role(uuid, tenant_role);

-- Drop the enum type
DROP TYPE IF EXISTS tenant_role;
