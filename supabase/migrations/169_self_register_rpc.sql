-- Self-registration RPCs used by landing.
-- Все функции выполняются с привилегиями service_role через SECURITY DEFINER,
-- чтобы мы не открывали RLS-доступ на auth.users для публичного ключа.

-- Поиск user_id по email (case-insensitive). Возвращает NULL если не найден.
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO service_role;

-- Транзакционно: проверяет свободность slug, создаёт тенант + запись в tenant_members.
-- Не трогает auth — юзер должен быть создан/найден до вызова.
-- Возвращает id созданного тенанта. На занятом slug бросает SQLSTATE '23505'.
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
      -- Ручной ISO-8601 с Z-суффиксом: то же самое, что делает Date.toISOString() на клиенте,
      -- для консистентности с другими местами в коде (see apps/backoffice/server/api/tenants.post.ts).
      'trialEndsAt', to_char((now() + make_interval(days => p_trial_days)) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'renewsAt', NULL
    ),
    -- delivery_min_order, delivery_fee: нули намеренно. Self-registered тенант
    -- сам задаёт доставочные параметры в онбординге/настройках.
    0,
    0
  )
  RETURNING id INTO v_tenant_id;

  INSERT INTO tenant_members (tenant_id, user_id)
  VALUES (v_tenant_id, p_owner_id);

  RETURN v_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.self_register_tenant(uuid, text, text, text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.self_register_tenant(uuid, text, text, text, int) TO service_role;
