-- Migration 284: self_register_tenant — принимает p_initial_plan для pre-select тарифа в онбординге.
--
-- Лендинг запоминает какой тариф нажал юзер и передаёт его при регистрации.
-- Tenant создаётся с этим планом в subscription, онбординг-wizard читает subscription.plan
-- и автоматически показывает нужный тариф уже выбранным.
-- DEFAULT 'retail-showcase' — поведение для регистраций без выбора тарифа не меняется.

CREATE OR REPLACE FUNCTION public.self_register_tenant(
  p_owner_id uuid,
  p_name text,
  p_slug text,
  p_email text,
  p_trial_days int,
  p_initial_plan text DEFAULT 'retail-showcase'
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
      'plan', p_initial_plan,
      'trialEndsAt', to_char((now() + make_interval(days => p_trial_days)) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'renewsAt', NULL
    ),
    0,
    0
  )
  RETURNING id INTO v_tenant_id;

  INSERT INTO tenant_members (tenant_id, user_id)
  VALUES (v_tenant_id, p_owner_id)
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  RETURN v_tenant_id;
END;
$$;

-- Закрываем старую 5-param версию (осталась от миграции 280).
REVOKE ALL ON FUNCTION public.self_register_tenant(uuid, text, text, text, int) FROM PUBLIC, anon, authenticated;

-- Новая 6-param версия — только service_role.
REVOKE ALL ON FUNCTION public.self_register_tenant(uuid, text, text, text, int, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.self_register_tenant(uuid, text, text, text, int, text) TO service_role;
