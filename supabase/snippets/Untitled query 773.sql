CREATE OR REPLACE FUNCTION public.get_user_profiles(user_ids uuid[])                                        
  RETURNS TABLE(user_id uuid, email text, full_name text)   
  LANGUAGE sql                                                                                                
  SECURITY DEFINER                                          
  SET search_path = auth, public
  AS $$
    SELECT id, email, raw_user_meta_data->>'full_name'
    FROM auth.users
    WHERE id = ANY(user_ids);
  $$;