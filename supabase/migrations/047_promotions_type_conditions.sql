-- Добавляем type и conditions к promotions для автоматических скидок
ALTER TABLE promotions ADD COLUMN type text NOT NULL DEFAULT 'min_order';
ALTER TABLE promotions ADD COLUMN conditions jsonb NOT NULL DEFAULT '{}';

-- type: min_order | happy_hour | weekday | first_order
-- conditions examples:
--   min_order:   { "min_order_amount": 1500 }
--   happy_hour:  { "time_from": "14:00", "time_to": "17:00" }
--   weekday:     { "weekdays": [1,2,3,4,5] }  -- 1=Mon, 7=Sun
--   combinations: { "time_from": "14:00", "time_to": "17:00", "weekdays": [1,2,3,4,5] }

-- Функция применения лучшей автоскидки к заказу.
-- Вызывается с service_role из storefront-сервера.
-- Возвращает лучшую подходящую скидку или null.
CREATE OR REPLACE FUNCTION get_best_promotion(
  p_tenant_id uuid,
  p_subtotal numeric,
  p_weekday int,       -- 1=Mon, 7=Sun
  p_time text          -- "HH:MM" UTC
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row promotions%ROWTYPE;
  v_best_amount numeric := -1;
  v_best jsonb := NULL;
  v_amount numeric;
  v_cond jsonb;
BEGIN
  FOR v_row IN
    SELECT * FROM promotions
    WHERE tenant_id = p_tenant_id
      AND active = true
      AND deleted_at IS NULL
      AND type != 'first_order'
      AND (active_from IS NULL OR active_from <= now())
      AND (active_to IS NULL OR active_to >= now())
  LOOP
    v_cond := v_row.conditions;

    -- Проверка минимальной суммы
    IF (v_cond->>'min_order_amount') IS NOT NULL THEN
      CONTINUE WHEN p_subtotal < (v_cond->>'min_order_amount')::numeric;
    END IF;

    -- Проверка дней недели
    IF (v_cond->'weekdays') IS NOT NULL THEN
      CONTINUE WHEN NOT (v_cond->'weekdays' @> to_jsonb(p_weekday));
    END IF;

    -- Проверка времени (happy_hour)
    IF (v_cond->>'time_from') IS NOT NULL AND (v_cond->>'time_to') IS NOT NULL THEN
      CONTINUE WHEN NOT (p_time >= v_cond->>'time_from' AND p_time < v_cond->>'time_to');
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
        'promotion_id', v_row.id,
        'title', v_row.title,
        'discount_amount', v_amount
      );
    END IF;
  END LOOP;

  RETURN v_best;
END;
$$;

GRANT EXECUTE ON FUNCTION get_best_promotion(uuid, numeric, int, text) TO service_role;
