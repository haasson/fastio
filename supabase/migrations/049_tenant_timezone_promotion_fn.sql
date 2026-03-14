-- Часовой пояс тенанта (IANA, например 'Europe/Moscow')
ALTER TABLE tenants ADD COLUMN timezone text NOT NULL DEFAULT 'Europe/Moscow';

-- Удаляем старую версию функции (другая сигнатура)
DROP FUNCTION IF EXISTS get_best_promotion(uuid, numeric, int, text);

-- Обновлённая функция: время и день недели берутся из now() в таймзоне тенанта.
-- Это устраняет необходимость передавать UTC-время с сервера и решает проблему
-- несоответствия таймзон при happy_hour / weekday условиях.
CREATE OR REPLACE FUNCTION get_best_promotion(
  p_tenant_id uuid,
  p_subtotal  numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_tz  text;
  v_local_now  timestamptz;
  v_weekday    int;
  v_time       text;
  v_row        promotions%ROWTYPE;
  v_best_amount numeric := -1;
  v_best       jsonb := NULL;
  v_amount     numeric;
  v_cond       jsonb;
BEGIN
  SELECT COALESCE(timezone, 'Europe/Moscow')
    INTO v_tenant_tz
    FROM tenants
   WHERE id = p_tenant_id;

  v_local_now := now() AT TIME ZONE v_tenant_tz;
  v_weekday   := CASE EXTRACT(DOW FROM v_local_now)::int WHEN 0 THEN 7 ELSE EXTRACT(DOW FROM v_local_now)::int END;
  v_time      := TO_CHAR(v_local_now, 'HH24:MI');

  FOR v_row IN
    SELECT * FROM promotions
    WHERE tenant_id = p_tenant_id
      AND active = true
      AND deleted_at IS NULL
      AND type NOT IN ('first_order', 'free_item')
      AND (active_from IS NULL OR active_from <= now())
      AND (active_to   IS NULL OR active_to   >= now())
  LOOP
    v_cond := v_row.conditions;

    -- Проверка минимальной суммы
    IF (v_cond->>'min_order_amount') IS NOT NULL THEN
      CONTINUE WHEN p_subtotal < (v_cond->>'min_order_amount')::numeric;
    END IF;

    -- Проверка дней недели
    IF (v_cond->'weekdays') IS NOT NULL THEN
      CONTINUE WHEN NOT (v_cond->'weekdays' @> to_jsonb(v_weekday));
    END IF;

    -- Проверка времени (happy_hour) с поддержкой перехода через полночь
    IF (v_cond->>'time_from') IS NOT NULL AND (v_cond->>'time_to') IS NOT NULL THEN
      IF (v_cond->>'time_from') <= (v_cond->>'time_to') THEN
        -- Обычный диапазон: 12:00–16:00
        CONTINUE WHEN NOT (v_time >= v_cond->>'time_from' AND v_time < v_cond->>'time_to');
      ELSE
        -- Диапазон через полночь: 22:00–02:00
        CONTINUE WHEN NOT (v_time >= v_cond->>'time_from' OR v_time < v_cond->>'time_to');
      END IF;
    END IF;

    -- Считаем сумму скидки
    IF v_row.discount_type = 'percent' THEN
      v_amount := ROUND(p_subtotal * v_row.discount_value / 100);
    ELSE
      v_amount := v_row.discount_value;
    END IF;

    v_amount := LEAST(v_amount, p_subtotal);

    IF v_amount > v_best_amount THEN
      v_best_amount := v_amount;
      v_best := jsonb_build_object(
        'promotion_id',   v_row.id,
        'title',          v_row.title,
        'discount_amount', v_amount
      );
    END IF;
  END LOOP;

  RETURN v_best;
END;
$$;

GRANT EXECUTE ON FUNCTION get_best_promotion(uuid, numeric) TO service_role;
