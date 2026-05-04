-- Атомарная пересборка списка филиалов для блюда / комбо в одной транзакции.
-- В админке сейчас insert/delete junction идёт двумя запросами: при падении
-- второго оставались зомби-ряды. RPC снимает эту проблему — один запрос,
-- одна транзакция, без try/catch с ручным откатом на клиенте.
-- Шаблон копирует services_set_branch_ids из миграции 202.

-- ─── dishes_set_branch_ids ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.dishes_set_branch_ids(
  p_dish_id    uuid,
  p_branch_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM dishes WHERE id = p_dish_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Dish not found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT is_tenant_member(v_tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member' USING ERRCODE = '42501';
  END IF;

  DELETE FROM dish_branches WHERE dish_id = p_dish_id;
  IF array_length(p_branch_ids, 1) > 0 THEN
    INSERT INTO dish_branches(dish_id, branch_id)
    SELECT p_dish_id, b FROM unnest(p_branch_ids) AS b;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.dishes_set_branch_ids(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dishes_set_branch_ids(uuid, uuid[]) TO authenticated;

-- ─── combos_set_branch_ids ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.combos_set_branch_ids(
  p_combo_id   uuid,
  p_branch_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM combos WHERE id = p_combo_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Combo not found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT is_tenant_member(v_tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member' USING ERRCODE = '42501';
  END IF;

  DELETE FROM combo_branches WHERE combo_id = p_combo_id;
  IF array_length(p_branch_ids, 1) > 0 THEN
    INSERT INTO combo_branches(combo_id, branch_id)
    SELECT p_combo_id, b FROM unnest(p_branch_ids) AS b;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.combos_set_branch_ids(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.combos_set_branch_ids(uuid, uuid[]) TO authenticated;
