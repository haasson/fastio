-- Migration 246: validate tenant of secondary uuids in atomic-link RPCs.
--
-- Контекст: RPC из 202_atomic_link_rpcs / 243_dish_combo_set_branch_ids /
-- 202.apply_shift_template_to_resource проверяют только tenant ПЕРВОГО
-- аргумента (parent entity). Member тенанта A мог передать массив
-- branch_ids / service_ids / category_ids / template_id из тенанта B —
-- ссылка успешно вставлялась в junction. Это ломало tenant-isolation
-- на уровне связей и могло проявиться как «услуга вдруг привязана к
-- чужому филиалу».
--
-- Фикс: в каждом RPC до DELETE/INSERT валидируем что все переданные uuid
-- принадлежат тому же тенанту, что и parent. Используем helper
-- `assert_uuids_in_tenant` чтобы не дублировать EXISTS-цикл по 5 раз.
--
-- apply_weekly_template_to_resource уже валидирует template_id (миграция 216).

-- ─── helper: assert_uuids_in_tenant ─────────────────────────────────
-- Проверяет что КАЖДЫЙ uuid из массива указывает на строку с указанным
-- tenant_id в таблице p_table. Бросает 42501 если хотя бы один uuid
-- принадлежит другому тенанту или не существует.
--
-- Использует динамический SQL (EXECUTE), потому что таблица — параметр.
-- Безопасно: p_table передаётся как regclass (существующая таблица),
-- format(%I) экранирует имя.

CREATE OR REPLACE FUNCTION public.assert_uuids_in_tenant(
  p_uuids     uuid[],
  p_tenant_id uuid,
  p_table     regclass
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invalid_count int;
BEGIN
  IF p_uuids IS NULL OR array_length(p_uuids, 1) IS NULL THEN
    RETURN;
  END IF;

  EXECUTE format(
    'SELECT count(*)
       FROM unnest($1) AS u(id)
      WHERE NOT EXISTS (
        SELECT 1 FROM %s t WHERE t.id = u.id AND t.tenant_id = $2
      )',
    p_table
  )
  INTO v_invalid_count
  USING p_uuids, p_tenant_id;

  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION 'One or more uuids do not belong to tenant in table %', p_table::text
      USING ERRCODE = '42501';
  END IF;
END
$$;

-- ─── services_set_branch_ids ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.services_set_branch_ids(
  p_service_id uuid,
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
  SELECT tenant_id INTO v_tenant_id FROM services WHERE id = p_service_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Service not found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT is_tenant_member(v_tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member' USING ERRCODE = '42501';
  END IF;

  PERFORM assert_uuids_in_tenant(p_branch_ids, v_tenant_id, 'branches'::regclass);

  DELETE FROM service_branches WHERE service_id = p_service_id;
  IF array_length(p_branch_ids, 1) > 0 THEN
    INSERT INTO service_branches(service_id, branch_id)
    SELECT p_service_id, b FROM unnest(p_branch_ids) AS b;
  END IF;
END
$$;

-- ─── resources_set_branch_ids ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.resources_set_branch_ids(
  p_resource_id uuid,
  p_branch_ids  uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM resources WHERE id = p_resource_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Resource not found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT is_tenant_member(v_tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member' USING ERRCODE = '42501';
  END IF;

  PERFORM assert_uuids_in_tenant(p_branch_ids, v_tenant_id, 'branches'::regclass);

  DELETE FROM resource_branches WHERE resource_id = p_resource_id;
  IF array_length(p_branch_ids, 1) > 0 THEN
    INSERT INTO resource_branches(resource_id, branch_id)
    SELECT p_resource_id, b FROM unnest(p_branch_ids) AS b;
  END IF;
END
$$;

-- ─── resources_set_service_ids ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.resources_set_service_ids(
  p_resource_id uuid,
  p_service_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM resources WHERE id = p_resource_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Resource not found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT is_tenant_member(v_tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member' USING ERRCODE = '42501';
  END IF;

  PERFORM assert_uuids_in_tenant(p_service_ids, v_tenant_id, 'services'::regclass);

  DELETE FROM service_resources WHERE resource_id = p_resource_id;
  IF array_length(p_service_ids, 1) > 0 THEN
    INSERT INTO service_resources(resource_id, service_id)
    SELECT p_resource_id, s FROM unnest(p_service_ids) AS s;
  END IF;
END
$$;

-- ─── resources_set_category_ids ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.resources_set_category_ids(
  p_resource_id  uuid,
  p_category_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM resources WHERE id = p_resource_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Resource not found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT is_tenant_member(v_tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member' USING ERRCODE = '42501';
  END IF;

  PERFORM assert_uuids_in_tenant(p_category_ids, v_tenant_id, 'categories'::regclass);

  DELETE FROM resource_categories WHERE resource_id = p_resource_id;
  IF array_length(p_category_ids, 1) > 0 THEN
    INSERT INTO resource_categories(resource_id, category_id)
    SELECT p_resource_id, c FROM unnest(p_category_ids) AS c;
  END IF;
END
$$;

-- ─── apply_shift_template_to_resource ───────────────────────────────

CREATE OR REPLACE FUNCTION public.apply_shift_template_to_resource(
  p_resource_id     uuid,
  p_template_id     uuid,
  p_cycle_start_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id          uuid;
  v_template_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM resources WHERE id = p_resource_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Resource not found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT is_tenant_member(v_tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member' USING ERRCODE = '42501';
  END IF;

  SELECT tenant_id INTO v_template_tenant_id FROM schedule_templates WHERE id = p_template_id;
  IF v_template_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Template not found' USING ERRCODE = 'P0001';
  END IF;
  IF v_template_tenant_id <> v_tenant_id THEN
    RAISE EXCEPTION 'Template belongs to a different tenant' USING ERRCODE = '42501';
  END IF;

  DELETE FROM resource_date_overrides       WHERE resource_id = p_resource_id;
  DELETE FROM resource_date_disabled_slots  WHERE resource_id = p_resource_id;
  DELETE FROM resource_schedules            WHERE resource_id = p_resource_id;
  DELETE FROM resource_disabled_slots       WHERE resource_id = p_resource_id;

  UPDATE resources
     SET applied_template_id = p_template_id,
         cycle_start_date    = p_cycle_start_date
   WHERE id = p_resource_id;
END
$$;

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

  PERFORM assert_uuids_in_tenant(p_branch_ids, v_tenant_id, 'branches'::regclass);

  DELETE FROM dish_branches WHERE dish_id = p_dish_id;
  IF array_length(p_branch_ids, 1) > 0 THEN
    INSERT INTO dish_branches(dish_id, branch_id)
    SELECT p_dish_id, b FROM unnest(p_branch_ids) AS b;
  END IF;
END
$$;

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

  PERFORM assert_uuids_in_tenant(p_branch_ids, v_tenant_id, 'branches'::regclass);

  DELETE FROM combo_branches WHERE combo_id = p_combo_id;
  IF array_length(p_branch_ids, 1) > 0 THEN
    INSERT INTO combo_branches(combo_id, branch_id)
    SELECT p_combo_id, b FROM unnest(p_branch_ids) AS b;
  END IF;
END
$$;
