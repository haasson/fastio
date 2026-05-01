-- =====================================================================================
-- Migration 225: RPC для домена «визиты» — починка create_appointment + move/merge
-- =====================================================================================
--
-- Чиним и добавляем:
--   1. create_appointment — был сломан с 222 (INSERT в group со status='new', а
--      колонки status больше нет). Чиним: визит создаётся с business_date
--   2. add_service_to_visit — синоним add_appointment_to_group (унифицируем
--      терминологию). Старое имя оставляем как deprecated-обёртку
--   3. move_appointment — атомарный перенос записи. Если новая business_date
--      совпадает с текущей — обычный reschedule. Если не совпадает — находит/создаёт
--      целевой визит того же tenant+branch+customer на новую дату и перевешивает
--   4. merge_visits — объединяет два визита одного бизнес-дня. Перенос appointments
--      из source в target + проставление source.merged_into_id = target.id.
--      Между разными датами merge не делаем: пусть фронт оркестрирует через
--      move_appointment по каждой услуге, потом merge на остатке
-- =====================================================================================


-- ─── 1. create_appointment — починка ─────────────────────────────────────────────────
--
-- Сигнатура совпадает с версией 219, чтобы фронт не ломался. Внутри:
--   - вычисляем business_date, создаём визит, потом appointment
--   - триггер enforce_visit_business_date валидирует совпадение

CREATE OR REPLACE FUNCTION public.create_appointment(
  p_tenant_id                 uuid,
  p_branch_id                 uuid,
  p_service_id                uuid,
  p_resource_id               uuid,
  p_user_id                   uuid,
  p_customer_id               uuid,
  p_customer_name             text,
  p_customer_phone            text,
  p_starts_at                 timestamptz,
  p_ends_at                   timestamptz,
  p_status                    appointment_status,
  p_notes                     text,
  p_allow_reschedule_snapshot boolean,
  p_allow_cancel_snapshot     boolean,
  p_service_name              text    DEFAULT '',
  p_service_price             numeric DEFAULT 0,
  p_customer_email            text    DEFAULT NULL,
  p_source                    text    DEFAULT 'storefront'
)
RETURNS TABLE(id uuid, status appointment_status, starts_at timestamptz, ends_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_capacity      int;
  v_overlapping   int;
  v_lock_key      text;
  v_appt_id       uuid;
  v_appt_status   appointment_status;
  v_group_id      uuid;
  v_business_date date;
BEGIN
  IF p_resource_id IS NULL AND p_branch_id IS NULL THEN
    RAISE EXCEPTION 'create_appointment: either p_resource_id or p_branch_id must be provided'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_source NOT IN ('storefront', 'admin', 'request') THEN
    RAISE EXCEPTION 'create_appointment: p_source must be storefront/admin/request'
      USING ERRCODE = 'P0001';
  END IF;

  v_business_date := compute_business_date(p_branch_id, p_tenant_id, p_starts_at);

  v_lock_key := 'appt:' || COALESCE(
    p_resource_id::text,
    p_branch_id::text || ':' || p_service_id::text
  );
  PERFORM pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));

  IF p_resource_id IS NOT NULL THEN
    SELECT capacity INTO v_capacity FROM resources
    WHERE id = p_resource_id AND tenant_id = p_tenant_id AND is_active = true;
    IF v_capacity IS NULL THEN
      RAISE EXCEPTION 'Resource not found or inactive' USING ERRCODE = 'P0001';
    END IF;

    SELECT COUNT(*) INTO v_overlapping
    FROM appointments
    WHERE resource_id = p_resource_id
      AND status <> 'cancelled'
      AND starts_at < p_ends_at
      AND COALESCE(actual_ends_at, ends_at) > p_starts_at;

    IF v_overlapping >= v_capacity THEN
      RAISE EXCEPTION 'Slot is taken' USING ERRCODE = 'P0002';
    END IF;
  ELSE
    SELECT COUNT(*) INTO v_overlapping
    FROM appointments
    WHERE service_id = p_service_id
      AND branch_id IS NOT DISTINCT FROM p_branch_id
      AND resource_id IS NULL
      AND status <> 'cancelled'
      AND starts_at < p_ends_at
      AND COALESCE(actual_ends_at, ends_at) > p_starts_at;

    IF v_overlapping >= 1 THEN
      RAISE EXCEPTION 'Slot is taken' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  INSERT INTO appointment_groups (
    tenant_id, branch_id, customer_id,
    customer_name, customer_phone, customer_email,
    notes, source, business_date
  ) VALUES (
    p_tenant_id, p_branch_id, p_customer_id,
    p_customer_name, p_customer_phone, p_customer_email,
    p_notes, COALESCE(p_source, 'storefront'), v_business_date
  ) RETURNING appointment_groups.id INTO v_group_id;

  INSERT INTO appointments (
    tenant_id, branch_id, service_id, resource_id, user_id, customer_id,
    customer_name, customer_phone,
    starts_at, ends_at,
    status, notes,
    allow_reschedule_snapshot, allow_cancel_snapshot,
    service_name, service_price,
    group_id
  ) VALUES (
    p_tenant_id, p_branch_id, p_service_id, p_resource_id, p_user_id, p_customer_id,
    p_customer_name, p_customer_phone,
    p_starts_at, p_ends_at,
    p_status, p_notes,
    p_allow_reschedule_snapshot, p_allow_cancel_snapshot,
    p_service_name, p_service_price,
    v_group_id
  )
  RETURNING appointments.id, appointments.status INTO v_appt_id, v_appt_status;

  RETURN QUERY SELECT v_appt_id, v_appt_status, p_starts_at, p_ends_at;
END
$$;

REVOKE ALL ON FUNCTION public.create_appointment(
  uuid, uuid, uuid, uuid, uuid, uuid, text, text,
  timestamptz, timestamptz, appointment_status, text, boolean, boolean, text, numeric,
  text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_appointment(
  uuid, uuid, uuid, uuid, uuid, uuid, text, text,
  timestamptz, timestamptz, appointment_status, text, boolean, boolean, text, numeric,
  text, text
) TO service_role;


-- ─── 2. add_service_to_visit — синоним add_appointment_to_group ─────────────────────
--
-- Старое имя add_appointment_to_group оставляем как deprecated-обёртку: оно зовёт
-- новое. Удалим в отдельной миграции после переезда фронта.

CREATE OR REPLACE FUNCTION public.add_service_to_visit(
  p_visit_id      uuid,
  p_service_id    uuid,
  p_resource_id   uuid,
  p_starts_at     timestamptz,
  p_ends_at       timestamptz,
  p_service_name  text,
  p_service_price numeric,
  p_status        appointment_status DEFAULT 'new'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_visit       appointment_groups%ROWTYPE;
  v_lock_key    text;
  v_capacity    int;
  v_overlap     int;
  v_appt_id     uuid;
BEGIN
  SELECT * INTO v_visit FROM appointment_groups WHERE id = p_visit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Visit not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_visit.merged_into_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot add to merged visit' USING ERRCODE = 'P0001';
  END IF;

  IF auth.role() <> 'service_role' AND NOT is_tenant_member(v_visit.tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member' USING ERRCODE = 'P0001';
  END IF;

  IF p_resource_id IS NOT NULL THEN
    v_lock_key := 'appt:' || p_resource_id::text;
  ELSIF v_visit.branch_id IS NOT NULL THEN
    v_lock_key := 'appt:' || v_visit.branch_id::text || ':' || p_service_id::text;
  ELSE
    RAISE EXCEPTION 'add_service_to_visit: resource_id or visit.branch_id must be set'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));

  IF p_resource_id IS NOT NULL THEN
    SELECT capacity INTO v_capacity FROM resources
    WHERE id = p_resource_id AND tenant_id = v_visit.tenant_id AND is_active = true;
    IF v_capacity IS NULL THEN
      RAISE EXCEPTION 'Resource not found or inactive' USING ERRCODE = 'P0001';
    END IF;

    SELECT COUNT(*) INTO v_overlap
    FROM appointments
    WHERE resource_id = p_resource_id
      AND status <> 'cancelled'
      AND starts_at < p_ends_at
      AND COALESCE(actual_ends_at, ends_at) > p_starts_at;

    IF v_overlap >= v_capacity THEN
      RAISE EXCEPTION 'Slot is taken' USING ERRCODE = 'P0002';
    END IF;
  ELSE
    SELECT COUNT(*) INTO v_overlap
    FROM appointments
    WHERE service_id = p_service_id
      AND branch_id IS NOT DISTINCT FROM v_visit.branch_id
      AND resource_id IS NULL
      AND status <> 'cancelled'
      AND starts_at < p_ends_at
      AND COALESCE(actual_ends_at, ends_at) > p_starts_at;

    IF v_overlap >= 1 THEN
      RAISE EXCEPTION 'Slot is taken' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  INSERT INTO appointments (
    tenant_id, branch_id, service_id, resource_id,
    customer_id, customer_name, customer_phone,
    starts_at, ends_at,
    status, notes,
    service_name, service_price,
    group_id
  ) VALUES (
    v_visit.tenant_id, v_visit.branch_id, p_service_id, p_resource_id,
    v_visit.customer_id, v_visit.customer_name, v_visit.customer_phone,
    p_starts_at, p_ends_at,
    p_status, v_visit.notes,
    p_service_name, p_service_price,
    p_visit_id
  )
  RETURNING appointments.id INTO v_appt_id;

  RETURN jsonb_build_object(
    'id',         v_appt_id,
    'service_id', p_service_id,
    'starts_at',  p_starts_at,
    'ends_at',    p_ends_at
  );
END
$$;

REVOKE ALL ON FUNCTION public.add_service_to_visit(
  uuid, uuid, uuid, timestamptz, timestamptz, text, numeric, appointment_status
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_service_to_visit(
  uuid, uuid, uuid, timestamptz, timestamptz, text, numeric, appointment_status
) TO service_role;


-- Старое имя — тонкая обёртка. Удалим после переезда фронта.

CREATE OR REPLACE FUNCTION public.add_appointment_to_group(
  p_group_id      uuid,
  p_service_id    uuid,
  p_resource_id   uuid,
  p_starts_at     timestamptz,
  p_ends_at       timestamptz,
  p_service_name  text,
  p_service_price numeric,
  p_status        appointment_status DEFAULT 'new'
)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.add_service_to_visit(
    p_group_id, p_service_id, p_resource_id, p_starts_at, p_ends_at,
    p_service_name, p_service_price, p_status
  );
$$;

REVOKE ALL ON FUNCTION public.add_appointment_to_group(
  uuid, uuid, uuid, timestamptz, timestamptz, text, numeric, appointment_status
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_appointment_to_group(
  uuid, uuid, uuid, timestamptz, timestamptz, text, numeric, appointment_status
) TO service_role;


-- ─── 3. move_appointment ────────────────────────────────────────────────────────────
--
-- Атомарный перенос записи. Если новая business_date совпадает с текущим визитом —
-- обычный reschedule (то же что update_appointment, но имя более явное). Если
-- не совпадает — находим существующий визит того же tenant+branch+customer на
-- новую дату или создаём новый, перевешиваем group_id + меняем слот.
--
-- Идентичность клиента: customer_id если есть, иначе по customer_phone (т.к.
-- гости без аккаунта).

CREATE OR REPLACE FUNCTION public.move_appointment(
  p_appt_id     uuid,
  p_starts_at   timestamptz,
  p_ends_at     timestamptz,
  p_resource_id uuid DEFAULT NULL,
  p_service_id  uuid DEFAULT NULL  -- NULL = не менять
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_appt           appointments%ROWTYPE;
  v_old_visit      appointment_groups%ROWTYPE;
  v_target_visit   appointment_groups%ROWTYPE;
  v_new_bdate      date;
  v_target_id      uuid;
  v_lock_key       text;
  v_capacity       int;
  v_overlap        int;
  v_service_id     uuid;
BEGIN
  SELECT * INTO v_appt FROM appointments WHERE id = p_appt_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found' USING ERRCODE = 'P0001';
  END IF;

  IF auth.role() <> 'service_role' AND NOT is_tenant_member(v_appt.tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member' USING ERRCODE = 'P0001';
  END IF;

  IF v_appt.status IN ('cancelled', 'done') THEN
    RAISE EXCEPTION 'Cannot move % appointment', v_appt.status USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_old_visit FROM appointment_groups WHERE id = v_appt.group_id;
  v_service_id := COALESCE(p_service_id, v_appt.service_id);
  v_new_bdate := compute_business_date(v_appt.branch_id, v_appt.tenant_id, p_starts_at);

  -- Advisory lock на новый слот
  IF p_resource_id IS NOT NULL THEN
    v_lock_key := 'appt:' || p_resource_id::text;
  ELSIF v_appt.branch_id IS NOT NULL THEN
    v_lock_key := 'appt:' || v_appt.branch_id::text || ':' || v_service_id::text;
  ELSE
    RAISE EXCEPTION 'move_appointment: resource_id or branch_id must be set'
      USING ERRCODE = 'P0001';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));

  -- Capacity check на новом слоте (исключаем текущую запись)
  IF p_resource_id IS NOT NULL THEN
    SELECT capacity INTO v_capacity FROM resources
    WHERE id = p_resource_id AND tenant_id = v_appt.tenant_id AND is_active = true;
    IF v_capacity IS NULL THEN
      RAISE EXCEPTION 'Resource not found or inactive' USING ERRCODE = 'P0001';
    END IF;

    SELECT COUNT(*) INTO v_overlap
    FROM appointments
    WHERE resource_id = p_resource_id
      AND id <> p_appt_id
      AND status <> 'cancelled'
      AND starts_at < p_ends_at
      AND COALESCE(actual_ends_at, ends_at) > p_starts_at;

    IF v_overlap >= v_capacity THEN
      RAISE EXCEPTION 'Slot is taken' USING ERRCODE = 'P0002';
    END IF;
  ELSE
    SELECT COUNT(*) INTO v_overlap
    FROM appointments
    WHERE service_id = v_service_id
      AND branch_id IS NOT DISTINCT FROM v_appt.branch_id
      AND resource_id IS NULL
      AND id <> p_appt_id
      AND status <> 'cancelled'
      AND starts_at < p_ends_at
      AND COALESCE(actual_ends_at, ends_at) > p_starts_at;

    IF v_overlap >= 1 THEN
      RAISE EXCEPTION 'Slot is taken' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  -- Если business_date не меняется — простой reschedule в текущем визите
  IF v_new_bdate = v_old_visit.business_date THEN
    UPDATE appointments
    SET starts_at   = p_starts_at,
        ends_at     = p_ends_at,
        resource_id = p_resource_id,
        service_id  = v_service_id
    WHERE id = p_appt_id;

    RETURN jsonb_build_object(
      'id', p_appt_id,
      'visit_id', v_old_visit.id,
      'visit_changed', false
    );
  END IF;

  -- Иначе — ищем существующий визит того же tenant+branch+customer на новую дату
  SELECT id INTO v_target_id
  FROM appointment_groups
  WHERE tenant_id = v_old_visit.tenant_id
    AND branch_id IS NOT DISTINCT FROM v_old_visit.branch_id
    AND business_date = v_new_bdate
    AND merged_into_id IS NULL
    AND (
      (v_old_visit.customer_id IS NOT NULL AND customer_id = v_old_visit.customer_id)
      OR (v_old_visit.customer_id IS NULL AND customer_phone = v_old_visit.customer_phone)
    )
  ORDER BY created_at
  LIMIT 1;

  -- Не нашли — создаём новый визит, копируя метаданные
  IF v_target_id IS NULL THEN
    INSERT INTO appointment_groups (
      tenant_id, branch_id, customer_id,
      customer_name, customer_phone, customer_email,
      notes, source, business_date
    ) VALUES (
      v_old_visit.tenant_id, v_old_visit.branch_id, v_old_visit.customer_id,
      v_old_visit.customer_name, v_old_visit.customer_phone, v_old_visit.customer_email,
      v_old_visit.notes, v_old_visit.source, v_new_bdate
    )
    RETURNING id INTO v_target_id;
  END IF;

  -- Перевешиваем appointment + меняем слот.
  -- ВАЖНО: триггер enforce_visit_business_date навешан на UPDATE OF starts_at, branch_id, group_id.
  -- Чтобы он увидел новый group_id, а не старый — обновляем всё одной командой.
  UPDATE appointments
  SET group_id    = v_target_id,
      starts_at   = p_starts_at,
      ends_at     = p_ends_at,
      resource_id = p_resource_id,
      service_id  = v_service_id
  WHERE id = p_appt_id;

  -- Если старый визит остался пустым — удаляем (FK RESTRICT, поэтому проверим)
  IF NOT EXISTS (SELECT 1 FROM appointments WHERE group_id = v_old_visit.id) THEN
    DELETE FROM appointment_groups WHERE id = v_old_visit.id;
  END IF;

  RETURN jsonb_build_object(
    'id', p_appt_id,
    'visit_id', v_target_id,
    'visit_changed', true,
    'old_visit_id', v_old_visit.id
  );
END
$$;

REVOKE ALL ON FUNCTION public.move_appointment(uuid, timestamptz, timestamptz, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_appointment(uuid, timestamptz, timestamptz, uuid, uuid) TO service_role;


-- ─── 4. merge_visits ────────────────────────────────────────────────────────────────
--
-- Объединяет source → target. Требования:
--   - Один tenant, один branch, один customer (id или phone, см. логику ниже)
--   - Одна business_date (между разными датами — фронт оркестрирует через
--     серию move_appointment, потом merge_visits на остатке)
--   - Оба визита не объединены ранее (merged_into_id IS NULL)
-- Семантика:
--   - Все appointments из source перевешиваются в target (group_id := target.id)
--   - source.merged_into_id := target.id (визит остаётся в БД ради аудита/ссылок,
--     но в инбоксе/таймлайне фильтруется)
--   - Capacity проверять не нужно: эти appointments уже валидны в своих слотах,
--     новый визит не меняет их starts_at/resource_id

CREATE OR REPLACE FUNCTION public.merge_visits(
  p_source_id uuid,
  p_target_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_source appointment_groups%ROWTYPE;
  v_target appointment_groups%ROWTYPE;
  v_moved  int;
BEGIN
  IF p_source_id = p_target_id THEN
    RAISE EXCEPTION 'merge_visits: source and target must differ' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_source FROM appointment_groups WHERE id = p_source_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source visit not found' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_target FROM appointment_groups WHERE id = p_target_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target visit not found' USING ERRCODE = 'P0001';
  END IF;

  IF auth.role() <> 'service_role' AND NOT is_tenant_member(v_source.tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member' USING ERRCODE = 'P0001';
  END IF;

  IF v_source.tenant_id <> v_target.tenant_id THEN
    RAISE EXCEPTION 'merge_visits: визиты разных тенантов' USING ERRCODE = 'P0001';
  END IF;
  IF v_source.branch_id IS DISTINCT FROM v_target.branch_id THEN
    RAISE EXCEPTION 'merge_visits: визиты разных филиалов' USING ERRCODE = 'P0001';
  END IF;
  IF v_source.business_date <> v_target.business_date THEN
    RAISE EXCEPTION 'merge_visits: визиты разных бизнес-дней (% и %)',
      v_source.business_date, v_target.business_date
      USING ERRCODE = 'P0001';
  END IF;
  IF v_source.merged_into_id IS NOT NULL OR v_target.merged_into_id IS NOT NULL THEN
    RAISE EXCEPTION 'merge_visits: один из визитов уже объединён' USING ERRCODE = 'P0001';
  END IF;

  -- Идентичность клиента: совпадение customer_id ИЛИ customer_phone
  IF v_source.customer_id IS NOT NULL AND v_target.customer_id IS NOT NULL THEN
    IF v_source.customer_id <> v_target.customer_id THEN
      RAISE EXCEPTION 'merge_visits: визиты разных клиентов' USING ERRCODE = 'P0001';
    END IF;
  ELSIF v_source.customer_phone <> v_target.customer_phone THEN
    RAISE EXCEPTION 'merge_visits: визиты разных клиентов (по телефону)' USING ERRCODE = 'P0001';
  END IF;

  UPDATE appointments
  SET group_id = p_target_id
  WHERE group_id = p_source_id;
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  UPDATE appointment_groups
  SET merged_into_id = p_target_id,
      updated_at     = now()
  WHERE id = p_source_id;

  RETURN jsonb_build_object(
    'source_id', p_source_id,
    'target_id', p_target_id,
    'moved_appointments', v_moved
  );
END
$$;

REVOKE ALL ON FUNCTION public.merge_visits(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_visits(uuid, uuid) TO service_role;
