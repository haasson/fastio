-- Функция для акций типа "блюдо в подарок".
-- Работает независимо от get_best_promotion — скидки и подарки не конкурируют.
-- Возвращает лучшую подходящую акцию (с наибольшим min_order_amount) или null.
CREATE OR REPLACE FUNCTION get_free_item_promotion(
  p_tenant_id uuid,
  p_subtotal  numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row       promotions%ROWTYPE;
  v_cond      jsonb;
  v_min_order numeric;
  v_best_min  numeric := -1;
  v_best      jsonb := NULL;
  v_dish_name text;
BEGIN
  FOR v_row IN
    SELECT * FROM promotions
    WHERE tenant_id = p_tenant_id
      AND type = 'free_item'
      AND active = true
      AND deleted_at IS NULL
      AND (active_from IS NULL OR active_from <= now())
      AND (active_to   IS NULL OR active_to   >= now())
  LOOP
    v_cond := v_row.conditions;

    -- free_dish_id обязателен
    CONTINUE WHEN (v_cond->>'free_dish_id') IS NULL;

    -- Проверка минимальной суммы
    v_min_order := COALESCE((v_cond->>'min_order_amount')::numeric, 0);
    CONTINUE WHEN p_subtotal < v_min_order;

    -- Блюдо должно быть активным и не удалённым
    SELECT name INTO v_dish_name
      FROM dishes
     WHERE id = (v_cond->>'free_dish_id')::uuid
       AND deleted_at IS NULL
       AND active = true;
    CONTINUE WHEN NOT FOUND;

    -- Среди подходящих берём с наибольшим порогом (самую "значимую")
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

GRANT EXECUTE ON FUNCTION get_free_item_promotion(uuid, numeric) TO service_role;
