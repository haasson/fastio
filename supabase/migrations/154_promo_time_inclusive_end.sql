-- Исправляем граничное условие time_to: теперь включительно (<=).
-- "Акция до 20:00" должна работать и в 20:00 тоже.

-- get_best_promotion ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_best_promotion(
  p_tenant_id     uuid,
  p_subtotal      numeric,
  p_delivery_time timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_tz   text;
  v_ref_time    timestamptz;
  v_local_now   timestamptz;
  v_weekday     int;
  v_time        text;
  v_row         promotions%ROWTYPE;
  v_best_amount numeric := -1;
  v_best        jsonb := NULL;
  v_amount      numeric;
  v_cond        jsonb;
BEGIN
  SELECT COALESCE(timezone, 'Europe/Moscow')
    INTO v_tenant_tz
    FROM tenants
   WHERE id = p_tenant_id;

  v_ref_time  := COALESCE(p_delivery_time, now());
  v_local_now := v_ref_time AT TIME ZONE v_tenant_tz;
  v_weekday   := CASE EXTRACT(DOW FROM v_local_now)::int WHEN 0 THEN 7 ELSE EXTRACT(DOW FROM v_local_now)::int END;
  v_time      := TO_CHAR(v_local_now, 'HH24:MI');

  FOR v_row IN
    SELECT * FROM promotions
    WHERE tenant_id = p_tenant_id
      AND active = true
      AND deleted_at IS NULL
      AND type NOT IN ('first_order', 'free_item')
      AND (active_from IS NULL OR active_from <= v_ref_time)
      AND (active_to   IS NULL OR active_to   >= v_ref_time)
  LOOP
    v_cond := v_row.conditions;

    IF (v_cond->>'min_order_amount') IS NOT NULL THEN
      CONTINUE WHEN p_subtotal < (v_cond->>'min_order_amount')::numeric;
    END IF;

    IF (v_cond->'weekdays') IS NOT NULL THEN
      CONTINUE WHEN NOT (v_cond->'weekdays' @> to_jsonb(v_weekday));
    END IF;

    IF (v_cond->>'time_from') IS NOT NULL AND (v_cond->>'time_to') IS NOT NULL THEN
      IF (v_cond->>'time_from') <= (v_cond->>'time_to') THEN
        CONTINUE WHEN NOT (v_time >= v_cond->>'time_from' AND v_time <= v_cond->>'time_to');
      ELSE
        CONTINUE WHEN NOT (v_time >= v_cond->>'time_from' OR v_time <= v_cond->>'time_to');
      END IF;
    END IF;

    IF v_row.discount_type = 'percent' THEN
      v_amount := ROUND(p_subtotal * v_row.discount_value / 100);
    ELSE
      v_amount := v_row.discount_value;
    END IF;

    v_amount := LEAST(v_amount, p_subtotal);

    IF v_amount > v_best_amount THEN
      v_best_amount := v_amount;
      v_best := jsonb_build_object(
        'promotion_id',    v_row.id,
        'title',           v_row.title,
        'discount_amount', v_amount
      );
    END IF;
  END LOOP;

  RETURN v_best;
END;
$$;

GRANT EXECUTE ON FUNCTION get_best_promotion(uuid, numeric, timestamptz) TO service_role;

-- check_promotion_by_id ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_promotion_by_id(
  p_tenant_id     uuid,
  p_promotion_id  uuid,
  p_subtotal      numeric DEFAULT 0,
  p_delivery_time timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_tz   text;
  v_ref_time    timestamptz;
  v_local_now   timestamptz;
  v_weekday     int;
  v_time        text;
  v_promo       promotions%ROWTYPE;
  v_cond        jsonb;
  v_amount      numeric;
BEGIN
  SELECT * INTO v_promo
  FROM promotions
  WHERE id = p_promotion_id
    AND tenant_id = p_tenant_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'not_found', 'discount_amount', 0);
  END IF;

  IF NOT v_promo.active THEN
    RETURN jsonb_build_object('valid', false, 'error', 'inactive', 'discount_amount', 0);
  END IF;

  SELECT COALESCE(timezone, 'Europe/Moscow')
    INTO v_tenant_tz
    FROM tenants
   WHERE id = p_tenant_id;

  v_ref_time  := COALESCE(p_delivery_time, now());
  v_local_now := v_ref_time AT TIME ZONE v_tenant_tz;
  v_weekday   := CASE EXTRACT(DOW FROM v_local_now)::int WHEN 0 THEN 7 ELSE EXTRACT(DOW FROM v_local_now)::int END;
  v_time      := TO_CHAR(v_local_now, 'HH24:MI');

  IF v_promo.active_from IS NOT NULL AND v_promo.active_from > v_ref_time THEN
    RETURN jsonb_build_object('valid', false, 'error', 'not_started', 'discount_amount', 0);
  END IF;

  IF v_promo.active_to IS NOT NULL AND v_promo.active_to < v_ref_time THEN
    RETURN jsonb_build_object('valid', false, 'error', 'expired', 'discount_amount', 0);
  END IF;

  v_cond := v_promo.conditions;

  IF (v_cond->'weekdays') IS NOT NULL THEN
    IF NOT (v_cond->'weekdays' @> to_jsonb(v_weekday)) THEN
      RETURN jsonb_build_object('valid', false, 'error', 'weekday', 'discount_amount', 0);
    END IF;
  END IF;

  IF (v_cond->>'time_from') IS NOT NULL AND (v_cond->>'time_to') IS NOT NULL THEN
    IF (v_cond->>'time_from') <= (v_cond->>'time_to') THEN
      IF NOT (v_time >= v_cond->>'time_from' AND v_time <= v_cond->>'time_to') THEN
        RETURN jsonb_build_object('valid', false, 'error', 'time_range',
          'discount_amount', 0, 'time_from', v_cond->>'time_from', 'time_to', v_cond->>'time_to');
      END IF;
    ELSE
      IF NOT (v_time >= v_cond->>'time_from' OR v_time <= v_cond->>'time_to') THEN
        RETURN jsonb_build_object('valid', false, 'error', 'time_range',
          'discount_amount', 0, 'time_from', v_cond->>'time_from', 'time_to', v_cond->>'time_to');
      END IF;
    END IF;
  END IF;

  IF (v_cond->>'min_order_amount') IS NOT NULL THEN
    IF p_subtotal < (v_cond->>'min_order_amount')::numeric THEN
      RETURN jsonb_build_object('valid', false, 'error', 'min_order',
        'discount_amount', 0, 'min_order_amount', (v_cond->>'min_order_amount')::numeric);
    END IF;
  END IF;

  IF v_promo.discount_type = 'percent' THEN
    v_amount := ROUND(p_subtotal * v_promo.discount_value / 100);
  ELSE
    v_amount := v_promo.discount_value;
  END IF;

  v_amount := LEAST(v_amount, p_subtotal);

  RETURN jsonb_build_object(
    'valid',           true,
    'discount_amount', v_amount,
    'title',           v_promo.title
  );
END;
$$;

GRANT EXECUTE ON FUNCTION check_promotion_by_id(uuid, uuid, numeric, timestamptz) TO service_role;
