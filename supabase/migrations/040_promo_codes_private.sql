-- Закрываем public read на promo_codes.
-- Раньше анон мог вытащить все промокоды тенанта.
-- Теперь проверка идёт через серверную функцию check_promo_code().
DROP POLICY IF EXISTS "promo_codes: public read" ON promo_codes;

-- SECURITY DEFINER — выполняется с правами владельца (postgres), минуя RLS.
-- Возвращает только скидку, без id и прочих деталей.
-- Можно вызывать с anon-ключом для клиентской валидации при вводе промокода.
CREATE OR REPLACE FUNCTION check_promo_code(p_tenant_id uuid, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo promo_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_promo
  FROM promo_codes
  WHERE tenant_id = p_tenant_id
    AND upper(code) = upper(p_code)
    AND active = true
    AND (active_from IS NULL OR active_from <= now())
    AND (active_to IS NULL OR active_to >= now())
    AND (usage_limit IS NULL OR used_count < usage_limit);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'discount_type', v_promo.discount_type,
    'discount_value', v_promo.discount_value
  );
END;
$$;

-- Разрешаем вызов для анонимных пользователей (storefront клиент)
GRANT EXECUTE ON FUNCTION check_promo_code(uuid, text) TO anon, authenticated;
