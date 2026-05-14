-- Migration 279: self_register_tenant — ON CONFLICT DO NOTHING для tenant_members.
--
-- Проблема: миграция 120 добавила trigger `trg_auto_owner_membership` на tenants AFTER INSERT,
-- который автоматически создаёт запись в tenant_members. RPC self_register_tenant (миграция 169)
-- была написана ДО триггера и тоже делает INSERT INTO tenant_members — без ON CONFLICT.
-- Результат: на свежей БД INSERT в RPC падает с 23505 на tenant_members_tenant_id_user_id_key,
-- потому что trigger уже создал запись.
--
-- Фикс: ON CONFLICT (tenant_id, user_id) DO NOTHING — safe и идемпотентно.
-- Не убираем сам ручной INSERT, чтобы RPC оставалась независимой от триггера.

CREATE OR REPLACE FUNCTION public.self_register_tenant(
  p_owner_id uuid,
  p_name text,
  p_slug text,
  p_email text,
  p_trial_days int
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  INSERT INTO tenants (
    owner_id, name, slug, custom_domain, self_registered,
    theme, contacts, notifications, subscription,
    delivery_min_order, delivery_fee
  )
  VALUES (
    p_owner_id,
    p_name,
    p_slug,
    NULL,
    true,
    jsonb_build_object(
      'primaryColor', '#ff6b35',
      'fontFamily', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      'logoUrl', NULL,
      'bannerUrl', NULL,
      'preset', 'default'
    ),
    jsonb_build_object(
      'phone', '',
      'email', p_email,
      'address', '',
      'instagram', NULL,
      'vk', NULL,
      'telegram', NULL,
      'whatsapp', NULL
    ),
    jsonb_build_object('email', p_email, 'telegramChatId', NULL),
    jsonb_build_object(
      'status', 'trial',
      'plan', 'service',
      'trialEndsAt', to_char((now() + make_interval(days => p_trial_days)) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'renewsAt', NULL
    ),
    0,
    0
  )
  RETURNING id INTO v_tenant_id;

  -- ON CONFLICT нужен потому что trigger trg_auto_owner_membership (миграция 120)
  -- уже создал запись в tenant_members при INSERT INTO tenants выше.
  INSERT INTO tenant_members (tenant_id, user_id)
  VALUES (v_tenant_id, p_owner_id)
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  RETURN v_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.self_register_tenant(uuid, text, text, text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.self_register_tenant(uuid, text, text, text, int) TO service_role;
