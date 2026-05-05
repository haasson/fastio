-- Migration 249: переписка RPC шаблонов под новую таблицу schedule_template_days.
--
-- Изменения:
-- - schedule_templates_update: p_slots → p_days (jsonb [{day_index, is_working, open_time, close_time}]).
-- - apply_weekly_template_to_resource: убираем server-side компиляцию слотов.
--   Теперь это простой COPY из schedule_template_days в resource_schedules
--   1:1, без обрезки по часам филиала и без disabled_slots. Шаблон сам по себе
--   декларирует валидное окно работы, а если админу нужно ограничение
--   филиала — он задаёт правильные часы в шаблоне.
-- - apply_shift_template_to_resource: семантика прежняя (anchor template_id +
--   cycle_start_date). Сигнатура не меняется.

-- ─── DROP старых сигнатур ────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.schedule_templates_update(uuid, text, text, int, uuid, jsonb);
DROP FUNCTION IF EXISTS public.apply_weekly_template_to_resource(uuid, uuid);

-- ─── schedule_templates_update ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.schedule_templates_update(
  p_id                  uuid,
  p_name                text,
  p_type                text,
  p_cycle_length        int,
  p_reference_branch_id uuid,
  p_days                jsonb       -- [{day_index, is_working, open_time, close_time}]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM schedule_templates WHERE id = p_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Template not found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT is_tenant_member(v_tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member' USING ERRCODE = '42501';
  END IF;

  UPDATE schedule_templates
     SET name = p_name,
         type = p_type,
         cycle_length = p_cycle_length,
         reference_branch_id = p_reference_branch_id
   WHERE id = p_id;

  DELETE FROM schedule_template_days WHERE template_id = p_id;

  IF p_days IS NOT NULL AND jsonb_array_length(p_days) > 0 THEN
    INSERT INTO schedule_template_days(template_id, day_index, is_working, open_time, close_time)
    SELECT p_id,
           (d->>'day_index')::int,
           COALESCE((d->>'is_working')::boolean, true),
           NULLIF(d->>'open_time', '')::time,
           NULLIF(d->>'close_time', '')::time
      FROM jsonb_array_elements(p_days) AS d;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.schedule_templates_update(uuid, text, text, int, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.schedule_templates_update(uuid, text, text, int, uuid, jsonb) TO authenticated;

-- ─── apply_weekly_template_to_resource ───────────────────────────────────
-- 1:1 копия часов шаблона в resource_schedules. Без обрезки по филиалу,
-- без вычисления disabled_slots (внутри шаблона перерывов больше нет).

CREATE OR REPLACE FUNCTION public.apply_weekly_template_to_resource(
  p_resource_id   uuid,
  p_template_id   uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id     uuid;
  v_tpl_tenant_id uuid;
  v_tpl_type      text;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM resources WHERE id = p_resource_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Resource not found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT is_tenant_member(v_tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member' USING ERRCODE = '42501';
  END IF;

  SELECT tenant_id, type INTO v_tpl_tenant_id, v_tpl_type
  FROM schedule_templates WHERE id = p_template_id;
  IF v_tpl_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Template not found' USING ERRCODE = 'P0001';
  END IF;
  IF v_tpl_tenant_id <> v_tenant_id THEN
    RAISE EXCEPTION 'Template tenant mismatch' USING ERRCODE = '42501';
  END IF;
  IF v_tpl_type <> 'weekly' THEN
    RAISE EXCEPTION 'Template is not weekly' USING ERRCODE = 'P0001';
  END IF;

  -- Очищаем существующие materialized overrides и schedule.
  DELETE FROM resource_schedules           WHERE resource_id = p_resource_id;
  DELETE FROM resource_disabled_slots      WHERE resource_id = p_resource_id;
  DELETE FROM resource_date_overrides      WHERE resource_id = p_resource_id;
  DELETE FROM resource_date_disabled_slots WHERE resource_id = p_resource_id;

  -- Копируем дни шаблона 1:1 в resource_schedules. day_index 0..6 = day_of_week.
  INSERT INTO resource_schedules(resource_id, day_of_week, is_working, open_time, close_time)
  SELECT p_resource_id,
         day_index,
         is_working,
         open_time,
         close_time
  FROM schedule_template_days
  WHERE template_id = p_template_id
    AND day_index BETWEEN 0 AND 6;

  UPDATE resources
     SET applied_template_id = p_template_id,
         cycle_start_date = NULL
   WHERE id = p_resource_id;
END
$$;

REVOKE ALL ON FUNCTION public.apply_weekly_template_to_resource(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_weekly_template_to_resource(uuid, uuid) TO authenticated;

-- ─── apply_shift_template_to_resource — без изменений по сигнатуре, но с
-- ─── валидацией tenant и type (миграция 246 уже добавляла валидацию tenant).
-- Ничего не делаем — функция уже корректна.
