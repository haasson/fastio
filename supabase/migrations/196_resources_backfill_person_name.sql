-- Бэкфил имён ресурсов-сотрудников.
-- Раньше при создании resource типа 'person' имя бралось из member.displayName,
-- который для пользователей без отображаемого имени в профиле фолбэчился на email —
-- так в resources.name вместо имени попадал email.
--
-- Метадата хранится по разным ключам (исторически 'name', местами 'full_name'),
-- берём первый непустой. Если нет ни того ни другого — оставляем как есть.

UPDATE resources r
SET name = COALESCE(
  NULLIF(u.raw_user_meta_data->>'full_name', ''),
  NULLIF(u.raw_user_meta_data->>'name', '')
)
FROM tenant_members tm
JOIN auth.users u ON u.id = tm.user_id
WHERE r.type = 'person'
  AND r.member_id = tm.id
  AND r.name LIKE '%@%'
  AND COALESCE(
    NULLIF(u.raw_user_meta_data->>'full_name', ''),
    NULLIF(u.raw_user_meta_data->>'name', '')
  ) IS NOT NULL;

-- Чтобы новые ресурсы и любые места UI, читающие displayName через
-- get_user_profiles, тоже корректно подхватывали 'name'-ключ из метадаты.

CREATE OR REPLACE FUNCTION public.get_user_profiles(user_ids uuid[])
RETURNS TABLE(user_id uuid, email text, full_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
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
      SELECT 1
      FROM public.tenant_members tm1
      JOIN public.tenant_members tm2 ON tm1.tenant_id = tm2.tenant_id
      WHERE tm1.user_id = u.id
        AND tm2.user_id = auth.uid()
    );
$$;
