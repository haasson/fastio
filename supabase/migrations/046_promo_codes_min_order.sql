-- Добавляем min_order_amount в promo_codes
ALTER TABLE promo_codes ADD COLUMN min_order_amount numeric;

-- Обновляем check_promo_code: принимает subtotal, проверяет min_order_amount
CREATE OR REPLACE FUNCTION check_promo_code(
  p_tenant_id uuid,
  p_code text,
  p_subtotal numeric DEFAULT 0
)
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
    AND deleted_at IS NULL
    AND (active_from IS NULL OR active_from <= now())
    AND (active_to IS NULL OR active_to >= now())
    AND (usage_limit IS NULL OR used_count < usage_limit);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  IF v_promo.min_order_amount IS NOT NULL AND p_subtotal < v_promo.min_order_amount THEN
    RETURN jsonb_build_object('valid', false, 'min_order_amount', v_promo.min_order_amount);
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'discount_type', v_promo.discount_type,
    'discount_value', v_promo.discount_value
  );
END;
$$;

GRANT EXECUTE ON FUNCTION check_promo_code(uuid, text, numeric) TO anon, authenticated;
