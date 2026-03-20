-- Backoffice-only function: fetch emails by user IDs without co-tenant restriction.
-- Called server-side with service_role (no auth.uid context), so the co-tenant
-- check in get_user_emails always returns empty. This variant skips that check.
CREATE OR REPLACE FUNCTION public.get_user_emails_admin(user_ids uuid[])
RETURNS TABLE(user_id uuid, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT id, email FROM auth.users WHERE id = ANY(user_ids);
$$;

-- Restrict execution to service_role only
REVOKE EXECUTE ON FUNCTION public.get_user_emails_admin(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_emails_admin(uuid[]) TO service_role;
