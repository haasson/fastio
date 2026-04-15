-- Добавляем опциональный p_delivery_time во все три promo-функции.
-- Если передан — валидация идёт против времени доставки (предзаказ),
-- иначе — против текущего времени (как раньше).

-- check_promo_code ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS check_promo_code(uuid, text, numeric);

CREATE OR REPLACE FUNCTION check_promo_code(
  p_tenant_id     uuid,
  p_code          text,
  p_subtotal      numeric DEFAULT 0,
  p_delivery_time timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref_time timestamptz;
  v_promo    promo_codes%ROWTYPE;
BEGIN
  v_ref_time := COALESCE(p_delivery_time, now());

  SELECT * INTO v_promo
  FROM promo_codes
  WHERE tenant_id = p_tenant_id
    AND upper(code) = upper(p_code)
    AND active = true
    AND deleted_at IS NULL
    AND (active_from IS NULL OR active_from <= v_ref_time)
    AND (active_to   IS NULL OR active_to   >= v_ref_time)
    AND (usage_limit IS NULL OR used_count < usage_limit);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  IF v_promo.min_order_amount IS NOT NULL AND p_subtotal < v_promo.min_order_amount THEN
    RETURN jsonb_build_object('valid', false, 'min_order_amount', v_promo.min_order_amount);
  END IF;

  RETURN jsonb_build_object(
    'valid',          true,
    'discount_type',  v_promo.discount_type,
    'discount_value', v_promo.discount_value
  );
END;
$$;

GRANT EXECUTE ON FUNCTION check_promo_code(uuid, text, numeric, timestamptz) TO anon, authenticated;

-- get_best_promotion ───────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_best_promotion(uuid, numeric);

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
        CONTINUE WHEN NOT (v_time >= v_cond->>'time_from' AND v_time < v_cond->>'time_to');
      ELSE
        CONTINUE WHEN NOT (v_time >= v_cond->>'time_from' OR v_time < v_cond->>'time_to');
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

-- get_free_item_promotion ──────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_free_item_promotion(uuid, numeric);

CREATE OR REPLACE FUNCTION get_free_item_promotion(
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
  v_ref_time  timestamptz;
  v_row       promotions%ROWTYPE;
  v_cond      jsonb;
  v_min_order numeric;
  v_best_min  numeric := -1;
  v_best      jsonb := NULL;
  v_dish_name text;
BEGIN
  v_ref_time := COALESCE(p_delivery_time, now());

  FOR v_row IN
    SELECT * FROM promotions
    WHERE tenant_id = p_tenant_id
      AND type = 'free_item'
      AND active = true
      AND deleted_at IS NULL
      AND (active_from IS NULL OR active_from <= v_ref_time)
      AND (active_to   IS NULL OR active_to   >= v_ref_time)
  LOOP
    v_cond := v_row.conditions;

    CONTINUE WHEN (v_cond->>'free_dish_id') IS NULL;

    v_min_order := COALESCE((v_cond->>'min_order_amount')::numeric, 0);
    CONTINUE WHEN p_subtotal < v_min_order;

    SELECT name INTO v_dish_name
      FROM dishes
     WHERE id = (v_cond->>'free_dish_id')::uuid
       AND deleted_at IS NULL
       AND active = true;
    CONTINUE WHEN NOT FOUND;

    IF v_min_order > v_best_min THEN
      v_best_min := v_min_order;
      v_best := jsonb_build_object(
        'promotion_id', v_row.id,
        'free_dish_id', v_cond->>'free_dish_id',
        'dish_name',    COALESCE(v_cond->>'free_dish_name', v_dish_name)
      );
    END IF;
  END LOOP;

  RETURN v_best;
END;
$$;

GRANT EXECUTE ON FUNCTION get_free_item_promotion(uuid, numeric, timestamptz) TO service_role;

-- check_promotion_by_id ──────────────────────────────────────────────────────
-- Единый источник правды для валидации конкретной акции по ID.
-- Используется из admin-эндпоинтов check-promotion и recalculate.

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
      IF NOT (v_time >= v_cond->>'time_from' AND v_time < v_cond->>'time_to') THEN
        RETURN jsonb_build_object('valid', false, 'error', 'time_range',
          'discount_amount', 0, 'time_from', v_cond->>'time_from', 'time_to', v_cond->>'time_to');
      END IF;
    ELSE
      IF NOT (v_time >= v_cond->>'time_from' OR v_time < v_cond->>'time_to') THEN
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
