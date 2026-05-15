-- Migration 280: self_register_tenant — дефолтный plan на валидный key из plans.
--
-- Проблема: миграция 169 (и 279 как наследник) создавали subscription с plan='service',
-- но такого key в таблице plans нет — есть retail-* и services-*. На старом managed
-- prod'е, видимо, был ручной insert plan'а с key='service' и self-register работал.
-- На self-hosted этого insert'а нет → онбординг падает на billing_change_plan со словами
-- "Current plan not found: service".
--
-- Фикс: дефолтный plan = retail-showcase (бесплатный, соответствует business_type='retail'
-- дефолту в этом же insert). При смене на services-вертикаль через онбординг план
-- меняется через billing_change_plan на services-* — это уже работающий путь.

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
      'plan', 'retail-showcase',
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
