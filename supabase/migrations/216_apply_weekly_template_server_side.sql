-- Migration 216: server-computed apply_weekly_template_to_resource — drop client trust.
--
-- Раньше RPC из 202 принимала `p_schedule_rows`/`p_disabled_rows` от клиента
-- и тупо вставляла их, прописав `applied_template_id = p_template_id`.
-- Клиент мог передать любой произвольный график, не имеющий отношения к шаблону,
-- и в БД оставалась ссылка «применён шаблон X» — нарушение data integrity и
-- сломанный аудит.
--
-- Теперь функция принимает только `p_resource_id` и `p_template_id` и сама
-- вычисляет окно работы / disabled-слоты по правилам, идентичным TS-утилитам
-- из `packages/shared/src/utils/scheduleTemplate.ts` + `appointmentSlots.ts`:
--
--   1. Берём `working_hours_schedule` филиала (template.reference_branch_id →
--      первый из resource_branches → tenant) и `slot_step_minutes` из настроек.
--   2. Для каждого dow 0..6:
--      a. Из JSONB достаём open/close дня (с учётом dayOff/allDay) → minutes.
--      b. Эффективные слоты шаблона = template_slots для этого dow,
--         отфильтрованные оконом `[ceil(open/step)*step, close)` если оно есть.
--      c. Если эффективных нет — is_working=false.
--      d. Иначе schedule_row(open=first_eff, close=last_eff + step) и
--         disabled = весь grid в [first, close) минус активные слоты.
--   3. applied_template_id := p_template_id, cycle_start_date := NULL.

-- Старая 4-аргументная версия удаляется: безопасность важнее обратной совместимости.

DROP FUNCTION IF EXISTS public.apply_weekly_template_to_resource(uuid, uuid, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.apply_weekly_template_to_resource(
  p_resource_id uuid,
  p_template_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id          uuid;
  v_template_tenant_id uuid;
  v_template_type      text;
  v_reference_branch_id uuid;
  v_branch_id          uuid;
  v_schedule           jsonb;
  v_slot_step          int;
  v_dow                int;
  v_iso                text;
  v_default            jsonb;
  v_day                jsonb;
  v_hours              jsonb;
  v_day_off            boolean;
  v_all_day            boolean;
  v_open_min           int;
  v_close_min          int;
  v_start_min          int;
  v_first_eff_min      int;
  v_last_eff_min       int;
  v_calc_open_min      int;
  v_calc_close_min     int;
  v_open_str           text;
  v_close_str          text;
BEGIN
  -- Permission: caller must be a tenant member of the resource's tenant.
  SELECT tenant_id INTO v_tenant_id FROM resources WHERE id = p_resource_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Resource not found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT is_tenant_member(v_tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member' USING ERRCODE = '42501';
  END IF;

  -- Validate template: same tenant, type=weekly.
  SELECT tenant_id, type, reference_branch_id
    INTO v_template_tenant_id, v_template_type, v_reference_branch_id
  FROM schedule_templates
  WHERE id = p_template_id;
  IF v_template_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Template not found' USING ERRCODE = 'P0001';
  END IF;
  IF v_template_tenant_id <> v_tenant_id THEN
    RAISE EXCEPTION 'Template belongs to a different tenant' USING ERRCODE = '42501';
  END IF;
  IF v_template_type <> 'weekly' THEN
    RAISE EXCEPTION 'Template type must be weekly' USING ERRCODE = 'P0001';
  END IF;

  -- Resolve branch schedule: template.reference_branch_id, then resource_branches[0],
  -- then tenant. Совпадает с поведением branchScheduleFor в TS.
  v_branch_id := v_reference_branch_id;
  IF v_branch_id IS NULL THEN
    SELECT branch_id INTO v_branch_id
    FROM resource_branches
    WHERE resource_id = p_resource_id
    ORDER BY branch_id
    LIMIT 1;
  END IF;

  IF v_branch_id IS NOT NULL THEN
    SELECT working_hours_schedule INTO v_schedule FROM branches WHERE id = v_branch_id;
  END IF;
  IF v_schedule IS NULL THEN
    SELECT working_hours_schedule INTO v_schedule FROM tenants WHERE id = v_tenant_id;
  END IF;

  -- slot_step_minutes из appointment_settings (default 30).
  SELECT slot_step_minutes INTO v_slot_step
  FROM appointment_settings
  WHERE tenant_id = v_tenant_id;
  IF v_slot_step IS NULL OR v_slot_step <= 0 THEN
    v_slot_step := 30;
  END IF;

  -- Очищаем существующее расписание + disabled atomically.
  DELETE FROM resource_schedules      WHERE resource_id = p_resource_id;
  DELETE FROM resource_disabled_slots WHERE resource_id = p_resource_id;

  -- Один цикл на день недели.
  FOR v_dow IN 0..6 LOOP
    -- Branch hours для dow: dow=0(Sun) → ISO '7', иначе ISO == dow.
    v_iso := CASE WHEN v_dow = 0 THEN '7' ELSE v_dow::text END;
    v_default := v_schedule -> 'default';
    v_day := v_schedule -> 'days' -> v_iso;
    v_hours := COALESCE(v_day, v_default);

    v_day_off := COALESCE((v_day ->> 'dayOff')::boolean, false);
    v_all_day := COALESCE((v_hours ->> 'allDay')::boolean, false);

    IF v_schedule IS NULL OR v_day_off THEN
      -- Нет расписания / выходной — фильтр окна не применяется,
      -- эффективные = все template_slots для этого dow.
      v_open_min  := NULL;
      v_close_min := NULL;
      v_start_min := NULL;
    ELSIF v_all_day THEN
      v_open_min  := 0;
      v_close_min := 1440;
      v_start_min := 0;
    ELSE
      v_open_min  := EXTRACT(hour FROM (NULLIF(v_hours ->> 'open',  '')::time))::int * 60
                   + EXTRACT(minute FROM (NULLIF(v_hours ->> 'open',  '')::time))::int;
      v_close_min := EXTRACT(hour FROM (NULLIF(v_hours ->> 'close', '')::time))::int * 60
                   + EXTRACT(minute FROM (NULLIF(v_hours ->> 'close', '')::time))::int;
      -- close может быть < open у overnight-графиков, но weekly-шаблоны такой
      -- режим не поддерживают — относимся как к «нет валидного окна».
      IF v_close_min <= v_open_min THEN
        v_open_min  := NULL;
        v_close_min := NULL;
        v_start_min := NULL;
      ELSE
        v_start_min := CEIL(v_open_min::numeric / v_slot_step)::int * v_slot_step;
      END IF;
    END IF;

    -- Эффективные template_slots для dow (с фильтром окна, если оно задано).
    SELECT
      MIN(EXTRACT(hour FROM slot_time)::int * 60 + EXTRACT(minute FROM slot_time)::int),
      MAX(EXTRACT(hour FROM slot_time)::int * 60 + EXTRACT(minute FROM slot_time)::int)
    INTO v_first_eff_min, v_last_eff_min
    FROM schedule_template_slots
    WHERE template_id = p_template_id
      AND day_index   = v_dow
      AND (
        v_start_min IS NULL
        OR (
          EXTRACT(hour FROM slot_time)::int * 60 + EXTRACT(minute FROM slot_time)::int >= v_start_min
          AND EXTRACT(hour FROM slot_time)::int * 60 + EXTRACT(minute FROM slot_time)::int  < v_close_min
        )
      );

    IF v_first_eff_min IS NULL THEN
      INSERT INTO resource_schedules(resource_id, day_of_week, is_working, open_time, close_time)
      VALUES (p_resource_id, v_dow, false, NULL, NULL);
      CONTINUE;
    END IF;

    v_calc_open_min  := v_first_eff_min;
    v_calc_close_min := v_last_eff_min + v_slot_step;
    -- close_time может быть '24:00' — Postgres time принимает 24:00:00.
    -- Чтобы избежать time-wraparound при interval-арифметике, формируем строкой.
    v_open_str  := lpad((v_calc_open_min  / 60)::text, 2, '0') || ':' || lpad((v_calc_open_min  % 60)::text, 2, '0');
    v_close_str := lpad((v_calc_close_min / 60)::text, 2, '0') || ':' || lpad((v_calc_close_min % 60)::text, 2, '0');

    INSERT INTO resource_schedules(resource_id, day_of_week, is_working, open_time, close_time)
    VALUES (p_resource_id, v_dow, true, v_open_str::time, v_close_str::time);

    -- Disabled = весь grid в [calc_open, calc_close) минус активные слоты.
    INSERT INTO resource_disabled_slots(resource_id, day_of_week, slot_time)
    SELECT p_resource_id, v_dow, (lpad((m / 60)::text, 2, '0') || ':' || lpad((m % 60)::text, 2, '0'))::time
    FROM generate_series(v_calc_open_min, v_calc_close_min - 1, v_slot_step) AS m
    WHERE NOT EXISTS (
      SELECT 1
      FROM schedule_template_slots
      WHERE template_id = p_template_id
        AND day_index   = v_dow
        AND EXTRACT(hour FROM slot_time)::int * 60 + EXTRACT(minute FROM slot_time)::int = m
        AND (
          v_start_min IS NULL
          OR (
            EXTRACT(hour FROM slot_time)::int * 60 + EXTRACT(minute FROM slot_time)::int >= v_start_min
            AND EXTRACT(hour FROM slot_time)::int * 60 + EXTRACT(minute FROM slot_time)::int  < v_close_min
          )
        )
    );
  END LOOP;

  UPDATE resources
     SET applied_template_id = p_template_id,
         cycle_start_date    = NULL
   WHERE id = p_resource_id;
END
$$;

REVOKE ALL ON FUNCTION public.apply_weekly_template_to_resource(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_weekly_template_to_resource(uuid, uuid) TO authenticated;
