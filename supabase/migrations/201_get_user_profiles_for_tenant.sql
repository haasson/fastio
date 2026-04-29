-- Migration 201: tenant-scoped variant of get_user_profiles.
--
-- The legacy get_user_profiles(user_ids) returns any user_id who shares
-- *any* tenant with the caller. In multi-tenant setups (a user is in tenants A
-- and B) calling list-team for tenant A could leak names of B-only members
-- whose user_ids happened to be in the lookup batch.
--
-- This new overload pins lookups to a single tenant: it checks both that the
-- caller is a member of that tenant AND that each requested user_id is a
-- member of that tenant. list-team will switch to this version.

CREATE OR REPLACE FUNCTION public.get_user_profiles_for_tenant(
  p_tenant_id uuid,
  user_ids    uuid[]
)
RETURNS TABLE(user_id uuid, email text, full_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public, pg_temp
AS $$
  SELECT
    u.id,
    u.email,
    COALESCE(
      NULLIF(u.raw_user_meta_data->>'full_name', ''),
      NULLIF(u.raw_user_meta_data->>'name', '')
    )
  FROM auth.users u
  WHERE u.id = ANY(user_ids)
    AND EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.tenant_id = p_tenant_id AND tm.user_id = u.id
    )
    AND EXISTS (
      SELECT 1 FROM public.tenant_members tm_self
      WHERE tm_self.tenant_id = p_tenant_id AND tm_self.user_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.get_user_profiles_for_tenant(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_profiles_for_tenant(uuid, uuid[]) TO authenticated, anon;
