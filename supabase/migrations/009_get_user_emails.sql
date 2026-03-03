-- Helper function for backoffice: get emails from auth.users by IDs
-- SECURITY DEFINER allows reading auth schema even without direct access
CREATE OR REPLACE FUNCTION public.get_user_emails(user_ids uuid[])
RETURNS TABLE(user_id uuid, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT id, email FROM auth.users WHERE id = ANY(user_ids);
$$;
