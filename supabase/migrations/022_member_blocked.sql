ALTER TABLE tenant_members ADD COLUMN IF NOT EXISTS blocked_until timestamptz;

ALTER TABLE tenant_invitations ADD COLUMN IF NOT EXISTS branch_ids uuid[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION is_tenant_member(_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_members
    WHERE tenant_id = _tenant_id
      AND user_id = auth.uid()
      AND (blocked_until IS NULL OR blocked_until < now())
  );
$$;

CREATE OR REPLACE FUNCTION has_tenant_role(_tenant_id uuid, _min_role tenant_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_members
    WHERE tenant_id = _tenant_id
      AND user_id = auth.uid()
      AND (blocked_until IS NULL OR blocked_until < now())
      AND ARRAY_POSITION(ARRAY['owner','admin','manager','staff']::tenant_role[], role)
       <= ARRAY_POSITION(ARRAY['owner','admin','manager','staff']::tenant_role[], _min_role)
  );
$$;
