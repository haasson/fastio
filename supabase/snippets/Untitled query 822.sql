CREATE OR REPLACE FUNCTION public.get_invite_status(_tenant_id uuid, _email text)                           
  RETURNS text
  LANGUAGE sql                                                                                                
  SECURITY DEFINER                                          
  SET search_path = auth, public
  AS $$
    SELECT
      CASE
        WHEN EXISTS (
          SELECT 1 FROM tenant_members tm
          JOIN auth.users u ON u.id = tm.user_id
          WHERE tm.tenant_id = _tenant_id AND u.email = _email
        ) THEN 'member'
        WHEN EXISTS (
          SELECT 1 FROM tenant_invitations ti
          WHERE ti.tenant_id = _tenant_id AND ti.email = _email AND ti.accepted_at IS NULL
        ) THEN 'pending'
        ELSE NULL
      END
  $$;