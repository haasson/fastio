-- =====================================================================================
-- Migration 232: soft-delete для appointments + cleanup RPC + аудит-события
-- =====================================================================================
--
-- Концепция soft-delete:
--   appointments.deleted_at IS NOT NULL = услуга физически удалена из визита
--   (через «крестик» в редакторе). Это ОТДЕЛЬНО от status='cancelled' — последний
--   означает бизнес-отмену визита целиком (виден клиенту в ЛК), а deleted_at —
--   служебное удаление (скрыто из UI, остаётся для аудита/восстановления).
--
-- Что делает эта миграция:
--   1. ALTER appointments: deleted_at, deleted_by, deleted_reason + partial index.
--   2. DROP add_appointment_to_group (обёртка над add_service_to_visit, потребителей нет).
--   3. CREATE OR REPLACE add_service_to_visit:
--        - проверка что визит существует и status='active' (RAISE если нет);
--        - capacity-чек overlap → фильтр deleted_at IS NULL;
--        - сохраняет сигнатуру 228 (с p_resource_assigned_by).
--   4. CREATE OR REPLACE move_appointment:
--        - при поиске целевого визита фильтр status='active';
--        - при чистке исходного визита учитываем только не-удалённые услуги;
--        - capacity-чек → фильтр deleted_at IS NULL;
--        - сохраняет сигнатуру 228.
--   5. CREATE move_visit_to_date(p_visit_id, p_new_date):
--        атомарный перенос всех активных услуг визита на новую дату inline (один lock).
--   6. CREATE count_pending_visits(p_tenant_id):
--        бейдж «Новые» — request-визиты + active-визиты с appointments.status='new'.
--   7. processed_by FK решение: cancelled_by (миграция 182) — text без FK,
--      поэтому applying analogy: оставляем processed_by как uuid БЕЗ FK на auth.users.
--      (если впоследствии понадобится — добавим отдельной миграцией).
--   8. CREATE OR REPLACE split_visit_to_request — soft-delete вместо UPDATE status='cancelled'.
--   9. record_visit_event(p_visit_id, p_actor_id, p_event_type, p_payload) — helper:
--        пишет одну запись в appointment_events на каждую активную (deleted_at IS NULL)
--        услугу визита; trigger на UPDATE status визита для cancel-события.
--  10. enforce_visit_business_date — игнорировать удалённые (deleted_at IS NOT NULL → RETURN NEW).
--  11. Дополнительные фильтры deleted_at IS NULL в capacity-чеках всех RPC,
--      работающих с appointments (add_service_to_visit, move_appointment,
--      update_appointment, create_appointments_bulk, create_appointment, convert_visit_request).
--
-- Идемпотентность: всё через DROP IF EXISTS / CREATE OR REPLACE — миграция применяется
-- повторно без ошибок. Все CREATE OR REPLACE с явным SECURITY DEFINER и
-- SET search_path = public, pg_temp.
-- =====================================================================================


-- ─── 1. Soft-delete колонки на appointments + partial index ─────────────────────────

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS deleted_at      timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by      text,
  ADD COLUMN IF NOT EXISTS deleted_reason  text;

CREATE INDEX IF NOT EXISTS appointments_not_deleted_idx
  ON appointments (group_id) WHERE deleted_at IS NULL;


-- ─── 2. Дроп обёртки add_appointment_to_group ───────────────────────────────────────
--
-- В 225 создана как тонкий синоним поверх add_service_to_visit. Потребителей в коде
-- нет, фронт зовёт add_service_to_visit напрямую. Сигнатура из 225 (строка 276-284):
--   (uuid, uuid, uuid, timestamptz, timestamptz, text, numeric, appointment_status)

DROP FUNCTION IF EXISTS public.add_appointment_to_group(
  uuid, uuid, uuid, timestamptz, timestamptz, text, numeric, appointment_status
);


-- ─── 3. add_service_to_visit — проверка status='active' + фильтр deleted_at ─────────

CREATE OR REPLACE FUNCTION public.add_service_to_visit(
  p_visit_id              uuid,
  p_service_id            uuid,
  p_resource_id           uuid,
  p_starts_at             timestamptz,
  p_ends_at               timestamptz,
  p_service_name          text,
  p_service_price         numeric,
  p_status                appointment_status DEFAULT 'new',
  p_resource_assigned_by  text               DEFAULT NULL
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
    RAISE EXCEPTION 'add_service_to_visit: визит % не найден', p_visit_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_visit.status <> 'active' THEN
    RAISE EXCEPTION 'add_service_to_visit: нельзя добавить услугу в визит со статусом %',
      v_visit.status USING ERRCODE = 'P0001';
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
      AND deleted_at IS NULL
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
      AND deleted_at IS NULL
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
    group_id,
    resource_assigned_by
  ) VALUES (
    v_visit.tenant_id, v_visit.branch_id, p_service_id, p_resource_id,
    v_visit.customer_id, v_visit.customer_name, v_visit.customer_phone,
    p_starts_at, p_ends_at,
    p_status, v_visit.notes,
    p_service_name, p_service_price,
    p_visit_id,
    p_resource_assigned_by
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
  uuid, uuid, uuid, timestamptz, timestamptz, text, numeric, appointment_status, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_service_to_visit(
  uuid, uuid, uuid, timestamptz, timestamptz, text, numeric, appointment_status, text
) TO service_role;


-- ─── 4. move_appointment — фильтр status='active' + soft-delete-aware cleanup ──────

CREATE OR REPLACE FUNCTION public.move_appointment(
  p_appt_id               uuid,
  p_starts_at             timestamptz,
  p_ends_at               timestamptz,
  p_resource_id           uuid DEFAULT NULL,
  p_service_id            uuid DEFAULT NULL,
  p_resource_assigned_by  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_appt           appointments%ROWTYPE;
  v_old_visit      appointment_groups%ROWTYPE;
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

  IF v_appt.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot move deleted appointment' USING ERRCODE = 'P0001';
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

  IF p_resource_id IS NOT NULL THEN
    v_lock_key := 'appt:' || p_resource_id::text;
  ELSIF v_appt.branch_id IS NOT NULL THEN
    v_lock_key := 'appt:' || v_appt.branch_id::text || ':' || v_service_id::text;
  ELSE
    RAISE EXCEPTION 'move_appointment: resource_id or branch_id must be set'
      USING ERRCODE = 'P0001';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));

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
      AND deleted_at IS NULL
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
      AND deleted_at IS NULL
      AND starts_at < p_ends_at
      AND COALESCE(actual_ends_at, ends_at) > p_starts_at;

    IF v_overlap >= 1 THEN
      RAISE EXCEPTION 'Slot is taken' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF v_new_bdate = v_old_visit.business_date THEN
    UPDATE appointments
    SET starts_at            = p_starts_at,
        ends_at              = p_ends_at,
        resource_id          = p_resource_id,
        service_id           = v_service_id,
        resource_assigned_by = COALESCE(p_resource_assigned_by, resource_assigned_by)
    WHERE id = p_appt_id;

    RETURN jsonb_build_object(
      'id', p_appt_id,
      'visit_id', v_old_visit.id,
      'visit_changed', false
    );
  END IF;

  -- Поиск целевого визита: только status='active' (request/cancelled — не клеим).
  SELECT id INTO v_target_id
  FROM appointment_groups
  WHERE tenant_id = v_old_visit.tenant_id
    AND branch_id IS NOT DISTINCT FROM v_old_visit.branch_id
    AND business_date = v_new_bdate
    AND status = 'active'
    AND (
      (v_old_visit.customer_id IS NOT NULL AND customer_id = v_old_visit.customer_id)
      OR (v_old_visit.customer_id IS NULL AND customer_phone = v_old_visit.customer_phone)
    )
  ORDER BY created_at
  LIMIT 1;

  IF v_target_id IS NULL THEN
    INSERT INTO appointment_groups (
      tenant_id, branch_id, customer_id,
      customer_name, customer_phone, customer_email,
      notes, source, business_date,
      status
    ) VALUES (
      v_old_visit.tenant_id, v_old_visit.branch_id, v_old_visit.customer_id,
      v_old_visit.customer_name, v_old_visit.customer_phone, v_old_visit.customer_email,
      v_old_visit.notes, v_old_visit.source, v_new_bdate,
      'active'
    )
    RETURNING id INTO v_target_id;
  END IF;

  UPDATE appointments
  SET group_id             = v_target_id,
      starts_at            = p_starts_at,
      ends_at              = p_ends_at,
      resource_id          = p_resource_id,
      service_id           = v_service_id,
      resource_assigned_by = COALESCE(p_resource_assigned_by, resource_assigned_by)
  WHERE id = p_appt_id;

  -- Чистка исходного визита: учитываем только не-удалённые услуги.
  IF NOT EXISTS (
    SELECT 1 FROM appointments
    WHERE group_id = v_old_visit.id AND deleted_at IS NULL
  ) THEN
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

REVOKE ALL ON FUNCTION public.move_appointment(
  uuid, timestamptz, timestamptz, uuid, uuid, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_appointment(
  uuid, timestamptz, timestamptz, uuid, uuid, text
) TO service_role;


-- ─── 5. RPC move_visit_to_date — атомарный перенос всех активных услуг визита ──────
--
-- Логика:
--   - lock визит, проверяем status='active';
--   - выбираем все активные услуги (deleted_at IS NULL, status NOT IN ('cancelled','done'));
--   - вычисляем новый business_date через compute_business_date по любой услуге
--     (для всех услуг визита он один — инвариант enforce_visit_business_date);
--     по факту мы формируем new_starts_at для каждой услуги, сдвигая дату но сохраняя
--     time-of-day. Если визит ушёл на другой бизнес-день — создаём новый визит и
--     перевешиваем все услуги одним UPDATE (capacity-чек на каждую услугу inline).
--   - возвращает jsonb { visit_id, new_visit_id, moved_appointments }.
--
-- Все capacity-чеки в одной транзакции под advisory locks по каждому resource/branch_service.

CREATE OR REPLACE FUNCTION public.move_visit_to_date(
  p_visit_id uuid,
  p_new_date date,
  p_user_id  uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_visit         appointment_groups%ROWTYPE;
  v_appt          record;
  v_new_starts_at timestamptz;
  v_new_ends_at   timestamptz;
  v_new_bdate     date;
  v_target_id     uuid;
  v_lock_keys     text[] := ARRAY[]::text[];
  v_lock_key      text;
  v_capacity      int;
  v_overlap       int;
  v_moved         jsonb := '[]'::jsonb;
  v_tz            text;
  v_local_starts  timestamp;
  v_old_local_date date;
  v_appts_count   int;
  v_appt_id       uuid;
BEGIN
  SELECT * INTO v_visit FROM appointment_groups WHERE id = p_visit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'move_visit_to_date: визит % не найден', p_visit_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_visit.status <> 'active' THEN
    RAISE EXCEPTION 'move_visit_to_date: визит должен быть active (текущий status=%)',
      v_visit.status USING ERRCODE = 'P0001';
  END IF;

  IF auth.role() <> 'service_role' AND NOT is_tenant_member(v_visit.tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member' USING ERRCODE = 'P0001';
  END IF;

  -- Если дата та же — нечего двигать.
  IF v_visit.business_date = p_new_date THEN
    RETURN jsonb_build_object(
      'visit_id', p_visit_id,
      'new_visit_id', NULL,
      'moved_appointments', '[]'::jsonb,
      'noop', true
    );
  END IF;

  SELECT timezone INTO v_tz FROM tenants WHERE id = v_visit.tenant_id;
  IF v_tz IS NULL THEN v_tz := 'Europe/Moscow'; END IF;

  -- Проверяем что есть что переносить.
  SELECT COUNT(*) INTO v_appts_count
  FROM appointments
  WHERE group_id = p_visit_id
    AND deleted_at IS NULL
    AND status NOT IN ('cancelled', 'done');

  IF v_appts_count = 0 THEN
    RAISE EXCEPTION 'move_visit_to_date: в визите нет активных услуг для переноса'
      USING ERRCODE = 'P0001';
  END IF;

  -- Фаза 1: собираем lock-ключи + считаем v_new_bdate (по первой услуге).
  -- Поскольку все услуги визита в одном бизнес-дне (инвариант), достаточно посчитать один раз.
  -- Используем сдвиг календарной даты в локальной TZ: новое время = (старое местное время в новый день).
  FOR v_appt IN
    SELECT a.id, a.starts_at, a.ends_at, a.resource_id, a.service_id,
           a.branch_id, a.tenant_id
    FROM appointments a
    WHERE a.group_id = p_visit_id
      AND a.deleted_at IS NULL
      AND a.status NOT IN ('cancelled', 'done')
    ORDER BY a.starts_at
  LOOP
    v_local_starts   := (v_appt.starts_at AT TIME ZONE v_tz);
    v_old_local_date := v_local_starts::date;
    v_new_starts_at  := ((p_new_date + (v_local_starts - v_old_local_date::timestamp))
                        AT TIME ZONE v_tz);
    v_new_ends_at    := v_new_starts_at + (v_appt.ends_at - v_appt.starts_at);

    IF v_new_bdate IS NULL THEN
      v_new_bdate := compute_business_date(v_appt.branch_id, v_appt.tenant_id, v_new_starts_at);
    END IF;

    v_lock_key := 'appt:' || COALESCE(
      v_appt.resource_id::text,
      v_appt.branch_id::text || ':' || v_appt.service_id::text
    );
    IF NOT (v_lock_key = ANY(v_lock_keys)) THEN
      v_lock_keys := array_append(v_lock_keys, v_lock_key);
    END IF;
  END LOOP;

  PERFORM pg_advisory_xact_lock(hashtextextended(k, 0))
  FROM unnest(v_lock_keys) AS t(k)
  ORDER BY k;

  -- Если новый business_date совпал со старым (например, переход через overnight границу
  -- может в редких случаях держать визит в том же бизнес-дне) — просто двигаем услуги.
  IF v_new_bdate = v_visit.business_date THEN
    v_target_id := p_visit_id;
  ELSE
    -- Ищем целевой визит того же клиента на новую дату со status='active'.
    SELECT id INTO v_target_id
    FROM appointment_groups
    WHERE tenant_id = v_visit.tenant_id
      AND branch_id IS NOT DISTINCT FROM v_visit.branch_id
      AND business_date = v_new_bdate
      AND status = 'active'
      AND id <> p_visit_id
      AND (
        (v_visit.customer_id IS NOT NULL AND customer_id = v_visit.customer_id)
        OR (v_visit.customer_id IS NULL AND customer_phone = v_visit.customer_phone)
      )
    ORDER BY created_at
    LIMIT 1;

    IF v_target_id IS NULL THEN
      INSERT INTO appointment_groups (
        tenant_id, branch_id, customer_id,
        customer_name, customer_phone, customer_email,
        notes, source, business_date,
        status
      ) VALUES (
        v_visit.tenant_id, v_visit.branch_id, v_visit.customer_id,
        v_visit.customer_name, v_visit.customer_phone, v_visit.customer_email,
        v_visit.notes, v_visit.source, v_new_bdate,
        'active'
      )
      RETURNING id INTO v_target_id;
    END IF;
  END IF;

  -- Фаза 2: capacity-чек + UPDATE для каждой услуги.
  FOR v_appt IN
    SELECT a.id, a.starts_at, a.ends_at, a.resource_id, a.service_id,
           a.branch_id, a.tenant_id
    FROM appointments a
    WHERE a.group_id = p_visit_id
      AND a.deleted_at IS NULL
      AND a.status NOT IN ('cancelled', 'done')
    ORDER BY a.starts_at
  LOOP
    v_local_starts   := (v_appt.starts_at AT TIME ZONE v_tz);
    v_old_local_date := v_local_starts::date;
    v_new_starts_at  := ((p_new_date + (v_local_starts - v_old_local_date::timestamp))
                        AT TIME ZONE v_tz);
    v_new_ends_at    := v_new_starts_at + (v_appt.ends_at - v_appt.starts_at);

    IF v_appt.resource_id IS NOT NULL THEN
      SELECT capacity INTO v_capacity FROM resources
      WHERE id = v_appt.resource_id AND tenant_id = v_appt.tenant_id AND is_active = true;
      IF v_capacity IS NULL THEN
        RAISE EXCEPTION 'Resource not found or inactive' USING ERRCODE = 'P0001';
      END IF;

      SELECT COUNT(*) INTO v_overlap
      FROM appointments
      WHERE resource_id = v_appt.resource_id
        AND id <> v_appt.id
        AND status <> 'cancelled'
        AND deleted_at IS NULL
        AND starts_at < v_new_ends_at
        AND COALESCE(actual_ends_at, ends_at) > v_new_starts_at;

      IF v_overlap >= v_capacity THEN
        RAISE EXCEPTION 'move_visit_to_date: слот % занят на новую дату', v_appt.id
          USING ERRCODE = 'P0002';
      END IF;
    ELSE
      SELECT COUNT(*) INTO v_overlap
      FROM appointments
      WHERE service_id = v_appt.service_id
        AND branch_id IS NOT DISTINCT FROM v_appt.branch_id
        AND resource_id IS NULL
        AND id <> v_appt.id
        AND status <> 'cancelled'
        AND deleted_at IS NULL
        AND starts_at < v_new_ends_at
        AND COALESCE(actual_ends_at, ends_at) > v_new_starts_at;

      IF v_overlap >= 1 THEN
        RAISE EXCEPTION 'move_visit_to_date: слот % занят на новую дату', v_appt.id
          USING ERRCODE = 'P0002';
      END IF;
    END IF;

    -- Если визит остался тем же (target = source) — обновляем только время.
    -- Если target другой — обновляем group_id + время одной командой,
    -- чтобы триггер enforce_visit_business_date увидел новый group_id.
    IF v_target_id = p_visit_id THEN
      UPDATE appointments
      SET starts_at = v_new_starts_at,
          ends_at   = v_new_ends_at
      WHERE id = v_appt.id;
    ELSE
      UPDATE appointments
      SET group_id  = v_target_id,
          starts_at = v_new_starts_at,
          ends_at   = v_new_ends_at
      WHERE id = v_appt.id;
    END IF;

    v_moved := v_moved || jsonb_build_object(
      'id',         v_appt.id,
      'starts_at',  v_new_starts_at,
      'ends_at',    v_new_ends_at
    );
  END LOOP;

  -- Если все активные услуги ушли в другой визит — старый теоретически может остаться
  -- с одними soft-deleted-услугами. Не удаляем — он нужен для аудита.
  -- Но если нужно его пометить — это работа фронта (cancel или delete визита).

  -- Если перенесли в новый/другой target — обновим бизнес-дату исходника
  -- если он опустел (нет appointments вообще, включая soft-deleted).
  IF v_target_id <> p_visit_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM appointments
      WHERE group_id = p_visit_id AND deleted_at IS NULL
    ) THEN
      -- Все активные ушли — не трогаем сам визит, но обновим updated_at.
      UPDATE appointment_groups SET updated_at = now() WHERE id = p_visit_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'visit_id', p_visit_id,
    'new_visit_id', CASE WHEN v_target_id <> p_visit_id THEN v_target_id ELSE NULL END,
    'moved_appointments', v_moved,
    'noop', false
  );
END
$$;

REVOKE ALL ON FUNCTION public.move_visit_to_date(uuid, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_visit_to_date(uuid, date, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_visit_to_date(uuid, date, uuid) TO authenticated;


-- ─── 6. RPC count_pending_visits — бейдж «Новые» в инбоксе ──────────────────────────
--
-- Считает визиты, требующие внимания админа:
--   - request-визиты (status='request') — заявки
--   - active-визиты с appointments.status='new' — новые подтверждаемые брони

CREATE OR REPLACE FUNCTION public.count_pending_visits(p_tenant_id uuid)
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COUNT(*)::int FROM (
    SELECT id FROM appointment_groups
    WHERE tenant_id = p_tenant_id AND status = 'request'
    UNION
    SELECT DISTINCT a.group_id
    FROM appointments a
    JOIN appointment_groups g ON g.id = a.group_id
    WHERE g.tenant_id = p_tenant_id
      AND g.status = 'active'
      AND a.status = 'new'
      AND a.deleted_at IS NULL
  ) t;
$$;

REVOKE ALL ON FUNCTION public.count_pending_visits(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_pending_visits(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.count_pending_visits(uuid) TO authenticated;


-- ─── 7. processed_by FK — НЕ добавляем (применяем аналогию cancelled_by) ────────────
--
-- В миграции 182 cancelled_by создан как text без FK (значения 'client' | 'admin').
-- В 230 processed_by создан как uuid, но без FK. По аналогии с другими аудит-полями
-- (cancelled_by) FK не нужен — теряем ссылочную целостность, но избегаем каскадных
-- проблем при удалении пользователей. Если позже потребуется — добавится отдельной
-- миграцией. Этот пункт явно фиксируем как решение.
--
-- (no-op в SQL — просто комментарий)


-- ─── 8. record_visit_event helper + cancel-trigger ─────────────────────────────────
--
-- Семантика appointment_events: одна запись = одно событие на одну услугу.
-- Для «события визита» пишем по записи на каждую услугу визита (включая soft-deleted —
-- например, для split-события, где услуги уже soft-deleted на момент записи, надо
-- сохранить след в их истории).
--
-- Определяется ДО split_visit_to_request, т.к. он её зовёт (PERFORM).

CREATE OR REPLACE FUNCTION public.record_visit_event(
  p_visit_id   uuid,
  p_actor_id   uuid,
  p_event_type text,
  p_payload    jsonb
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM appointment_groups WHERE id = p_visit_id;
  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO appointment_events (
    appointment_id, tenant_id, actor_id, event_type, meta
  )
  SELECT
    a.id,
    v_tenant_id,
    p_actor_id,
    p_event_type,
    COALESCE(p_payload, '{}'::jsonb) || jsonb_build_object('visit_id', p_visit_id)
  FROM appointments a
  WHERE a.group_id = p_visit_id;
END
$$;

REVOKE ALL ON FUNCTION public.record_visit_event(uuid, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_visit_event(uuid, uuid, text, jsonb) TO service_role;


-- Триггер на cancel визита: пишет audit-event при UPDATE active → cancelled.
-- Не требует миграции фронта — текущий cancelAll на appointmentGroups.update({status:'cancelled'})
-- уже работает, триггер просто слушает.

CREATE OR REPLACE FUNCTION public.log_visit_cancelled()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    PERFORM public.record_visit_event(
      NEW.id,
      auth.uid(),
      'visit_cancelled',
      jsonb_build_object(
        'previous_status', OLD.status,
        'processed_by',    NEW.processed_by
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointment_groups_log_cancel ON appointment_groups;
CREATE TRIGGER trg_appointment_groups_log_cancel
  AFTER UPDATE OF status ON appointment_groups
  FOR EACH ROW EXECUTE FUNCTION public.log_visit_cancelled();


-- ─── 9. split_visit_to_request — soft-delete вместо UPDATE status='cancelled' ──────

CREATE OR REPLACE FUNCTION public.split_visit_to_request(
  p_visit_id        uuid,
  p_appointment_ids uuid[],
  p_user_id         uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_visit              appointment_groups%ROWTYPE;
  v_new_visit_id       uuid;
  v_requested_services jsonb;
  v_count              int;
BEGIN
  IF p_appointment_ids IS NULL OR array_length(p_appointment_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'split_visit_to_request: p_appointment_ids must be non-empty'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_visit FROM appointment_groups WHERE id = p_visit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Visit not found' USING ERRCODE = 'P0001';
  END IF;
  IF v_visit.status <> 'active' THEN
    RAISE EXCEPTION 'Visit must be active to split (status=%)', v_visit.status
      USING ERRCODE = 'P0001';
  END IF;
  IF auth.role() <> 'service_role' AND NOT is_tenant_member(v_visit.tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member' USING ERRCODE = 'P0001';
  END IF;

  -- Проверяем что все указанные appointments принадлежат визиту и ещё активны
  -- (не отменены, не завершены, не soft-deleted).
  SELECT COUNT(*) INTO v_count
  FROM appointments
  WHERE id = ANY(p_appointment_ids)
    AND group_id = p_visit_id
    AND status NOT IN ('cancelled', 'done')
    AND deleted_at IS NULL;
  IF v_count <> array_length(p_appointment_ids, 1) THEN
    RAISE EXCEPTION 'split_visit_to_request: some appointments do not belong to visit, are closed or deleted'
      USING ERRCODE = 'P0001';
  END IF;

  -- Собираем requested_services из выбранных appointments.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'service_id',            a.service_id,
    'service_name',          a.service_name,
    'preferred_resource_id', a.resource_id,
    'duration_minutes',      EXTRACT(EPOCH FROM (a.ends_at - a.starts_at))::int / 60,
    'price',                 a.service_price
  ) ORDER BY a.starts_at), '[]'::jsonb)
  INTO v_requested_services
  FROM appointments a
  WHERE a.id = ANY(p_appointment_ids);

  -- Создаём новый request-визит.
  INSERT INTO appointment_groups (
    tenant_id, branch_id, customer_id,
    customer_name, customer_phone, customer_email,
    notes, source, business_date,
    status, requested_services
  ) VALUES (
    v_visit.tenant_id, v_visit.branch_id, v_visit.customer_id,
    v_visit.customer_name, v_visit.customer_phone, v_visit.customer_email,
    v_visit.notes, 'admin', NULL,
    'request', v_requested_services
  )
  RETURNING id INTO v_new_visit_id;

  -- SOFT-delete переносимых услуг в исходном визите.
  -- Услуги физически удалены из визита (deleted_at), но сохранены для аудита/отката.
  -- В новом request-визите они представлены как requested_services (snapshot).
  UPDATE appointments
  SET deleted_at     = now(),
      deleted_by     = COALESCE(p_user_id::text, 'admin'),
      deleted_reason = 'Перенесено в новую заявку ' || v_new_visit_id::text || ' (split)'
  WHERE id = ANY(p_appointment_ids)
    AND deleted_at IS NULL;

  -- Записываем audit-event на исходный визит.
  PERFORM public.record_visit_event(
    p_visit_id,
    p_user_id,
    'split_to_request',
    jsonb_build_object(
      'appointment_ids', to_jsonb(p_appointment_ids),
      'new_visit_id',    v_new_visit_id
    )
  );

  RETURN jsonb_build_object(
    'new_visit_id', v_new_visit_id,
    'moved_count',  array_length(p_appointment_ids, 1)
  );
END
$$;

REVOKE ALL ON FUNCTION public.split_visit_to_request(uuid, uuid[], uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.split_visit_to_request(uuid, uuid[], uuid) TO service_role;


-- ─── 10. enforce_visit_business_date — игнорировать удалённые ──────────────────────

CREATE OR REPLACE FUNCTION enforce_visit_business_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_visit_bdate date;
  v_appt_bdate  date;
BEGIN
  -- Soft-deleted appointment не валидируем — её bdate уже не интересен.
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT business_date INTO v_visit_bdate
  FROM appointment_groups
  WHERE id = NEW.group_id;

  IF v_visit_bdate IS NULL THEN
    -- request-стадия (или невалидный визит — но FK не даст). Не валидируем.
    RETURN NEW;
  END IF;

  v_appt_bdate := compute_business_date(NEW.branch_id, NEW.tenant_id, NEW.starts_at);

  IF v_appt_bdate <> v_visit_bdate THEN
    RAISE EXCEPTION
      'Запись (business_date=%) не попадает в бизнес-день визита (business_date=%)',
      v_appt_bdate, v_visit_bdate
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;


-- ─── 11. Доп. фильтры deleted_at IS NULL в остальных capacity-RPC ──────────────────
--
-- create_appointment, update_appointment, create_appointments_bulk, convert_visit_request —
-- везде в overlap-чеках добавляем deleted_at IS NULL: soft-deleted услуги
-- не должны блокировать ресурс.

-- ── create_appointment ────────────────────────────────────────────────────────────

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
  p_source                    text    DEFAULT 'storefront',
  p_resource_assigned_by      text    DEFAULT NULL
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
      AND deleted_at IS NULL
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
      AND deleted_at IS NULL
      AND starts_at < p_ends_at
      AND COALESCE(actual_ends_at, ends_at) > p_starts_at;

    IF v_overlapping >= 1 THEN
      RAISE EXCEPTION 'Slot is taken' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  INSERT INTO appointment_groups (
    tenant_id, branch_id, customer_id,
    customer_name, customer_phone, customer_email,
    notes, source, business_date,
    status
  ) VALUES (
    p_tenant_id, p_branch_id, p_customer_id,
    p_customer_name, p_customer_phone, p_customer_email,
    p_notes, COALESCE(p_source, 'storefront'), v_business_date,
    'active'
  ) RETURNING appointment_groups.id INTO v_group_id;

  INSERT INTO appointments (
    tenant_id, branch_id, service_id, resource_id, user_id, customer_id,
    customer_name, customer_phone,
    starts_at, ends_at,
    status, notes,
    allow_reschedule_snapshot, allow_cancel_snapshot,
    service_name, service_price,
    group_id,
    resource_assigned_by
  ) VALUES (
    p_tenant_id, p_branch_id, p_service_id, p_resource_id, p_user_id, p_customer_id,
    p_customer_name, p_customer_phone,
    p_starts_at, p_ends_at,
    p_status, p_notes,
    p_allow_reschedule_snapshot, p_allow_cancel_snapshot,
    p_service_name, p_service_price,
    v_group_id,
    p_resource_assigned_by
  )
  RETURNING appointments.id, appointments.status INTO v_appt_id, v_appt_status;

  RETURN QUERY SELECT v_appt_id, v_appt_status, p_starts_at, p_ends_at;
END
$$;

REVOKE ALL ON FUNCTION public.create_appointment(
  uuid, uuid, uuid, uuid, uuid, uuid, text, text,
  timestamptz, timestamptz, appointment_status, text, boolean, boolean, text, numeric,
  text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_appointment(
  uuid, uuid, uuid, uuid, uuid, uuid, text, text,
  timestamptz, timestamptz, appointment_status, text, boolean, boolean, text, numeric,
  text, text, text
) TO service_role;


-- ── update_appointment ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_appointment(
  p_id                    uuid,
  p_resource_id           uuid,
  p_starts_at             timestamptz,
  p_ends_at               timestamptz,
  p_service_id            uuid    DEFAULT NULL,
  p_service_name          text    DEFAULT NULL,
  p_service_price         numeric DEFAULT NULL,
  p_resource_assigned_by  text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_appt          appointments%ROWTYPE;
  v_lock_key      text;
  v_capacity      int;
  v_overlap       int;
  v_slot_changed  boolean;
  v_service_id    uuid;
  v_service_name  text;
  v_service_price numeric;
BEGIN
  SELECT * INTO v_appt FROM appointments WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_appt.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot update deleted appointment' USING ERRCODE = 'P0001';
  END IF;

  IF auth.role() <> 'service_role' AND NOT is_tenant_member(v_appt.tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member' USING ERRCODE = 'P0001';
  END IF;

  IF v_appt.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot update cancelled appointment' USING ERRCODE = 'P0001';
  END IF;
  IF v_appt.status = 'done' THEN
    RAISE EXCEPTION 'Cannot update completed appointment' USING ERRCODE = 'P0001';
  END IF;

  IF p_resource_id IS NOT NULL THEN
    v_lock_key := 'appt:' || p_resource_id::text;
  ELSIF v_appt.branch_id IS NOT NULL THEN
    v_lock_key := 'appt:' || v_appt.branch_id::text
                           || ':' || COALESCE(p_service_id, v_appt.service_id)::text;
  ELSE
    RAISE EXCEPTION 'update_appointment: resource_id or appointment.branch_id must be set'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));

  v_slot_changed := (
    p_resource_id IS DISTINCT FROM v_appt.resource_id
    OR p_starts_at <> v_appt.starts_at
    OR p_ends_at   <> v_appt.ends_at
  );

  IF v_slot_changed THEN
    IF p_resource_id IS NOT NULL THEN
      SELECT capacity INTO v_capacity
      FROM resources
      WHERE id = p_resource_id AND tenant_id = v_appt.tenant_id AND is_active = true;

      IF v_capacity IS NULL THEN
        RAISE EXCEPTION 'Resource not found or inactive' USING ERRCODE = 'P0001';
      END IF;

      SELECT COUNT(*) INTO v_overlap
      FROM appointments
      WHERE resource_id = p_resource_id
        AND id <> p_id
        AND status <> 'cancelled'
        AND deleted_at IS NULL
        AND starts_at < p_ends_at
        AND COALESCE(actual_ends_at, ends_at) > p_starts_at;

      IF v_overlap >= v_capacity THEN
        RAISE EXCEPTION 'Slot is taken' USING ERRCODE = 'P0002';
      END IF;
    ELSE
      SELECT COUNT(*) INTO v_overlap
      FROM appointments
      WHERE service_id = COALESCE(p_service_id, v_appt.service_id)
        AND branch_id IS NOT DISTINCT FROM v_appt.branch_id
        AND resource_id IS NULL
        AND id <> p_id
        AND status <> 'cancelled'
        AND deleted_at IS NULL
        AND starts_at < p_ends_at
        AND COALESCE(actual_ends_at, ends_at) > p_starts_at;

      IF v_overlap >= 1 THEN
        RAISE EXCEPTION 'Slot is taken' USING ERRCODE = 'P0002';
      END IF;
    END IF;
  END IF;

  v_service_id    := COALESCE(p_service_id,    v_appt.service_id);
  v_service_name  := COALESCE(p_service_name,  v_appt.service_name);
  v_service_price := COALESCE(p_service_price, v_appt.service_price);

  UPDATE appointments SET
    resource_id          = p_resource_id,
    starts_at            = p_starts_at,
    ends_at              = p_ends_at,
    service_id           = v_service_id,
    service_name         = v_service_name,
    service_price        = v_service_price,
    resource_assigned_by = COALESCE(p_resource_assigned_by, resource_assigned_by)
  WHERE id = p_id;

  RETURN jsonb_build_object(
    'id',            p_id,
    'resource_id',   p_resource_id,
    'starts_at',     p_starts_at,
    'ends_at',       p_ends_at,
    'service_id',    v_service_id,
    'service_name',  v_service_name,
    'service_price', v_service_price
  );
END
$$;

REVOKE ALL ON FUNCTION public.update_appointment(
  uuid, uuid, timestamptz, timestamptz, uuid, text, numeric, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_appointment(
  uuid, uuid, timestamptz, timestamptz, uuid, text, numeric, text
) TO service_role;


-- ── create_appointments_bulk ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_appointments_bulk(
  p_tenant_id                 uuid,
  p_branch_id                 uuid,
  p_user_id                   uuid,
  p_customer_id               uuid,
  p_customer_name             text,
  p_customer_phone            text,
  p_customer_email            text,
  p_status                    appointment_status,
  p_notes                     text,
  p_allow_reschedule_snapshot boolean,
  p_allow_cancel_snapshot     boolean,
  p_source                    text,
  p_items                     jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_item            jsonb;
  v_resource_id     uuid;
  v_service_id      uuid;
  v_starts_at       timestamptz;
  v_ends_at         timestamptz;
  v_service_name    text;
  v_service_price   numeric;
  v_assigned_by     text;
  v_capacity        int;
  v_overlap         int;
  v_appt_id         uuid;
  v_lock_keys       text[] := ARRAY[]::text[];
  v_lock_key        text;
  v_group_id        uuid;
  v_appt_ids        uuid[] := ARRAY[]::uuid[];
  v_business_date   date;
  v_item_bdate      date;
BEGIN
  IF p_source NOT IN ('storefront', 'admin', 'request') THEN
    RAISE EXCEPTION 'create_appointments_bulk: p_source must be ''storefront'', ''admin'' or ''request'''
      USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'create_appointments_bulk: items must be non-empty' USING ERRCODE = 'P0001';
  END IF;

  -- Фаза 1: lock-ключи + business_date
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_resource_id := NULLIF(v_item->>'resource_id', '')::uuid;
    v_service_id  := (v_item->>'service_id')::uuid;
    v_starts_at   := (v_item->>'starts_at')::timestamptz;

    IF v_resource_id IS NULL AND p_branch_id IS NULL THEN
      RAISE EXCEPTION 'create_appointments_bulk: item requires resource_id or p_branch_id must be set'
        USING ERRCODE = 'P0001';
    END IF;

    v_item_bdate := compute_business_date(p_branch_id, p_tenant_id, v_starts_at);
    IF v_business_date IS NULL THEN
      v_business_date := v_item_bdate;
    ELSIF v_business_date <> v_item_bdate THEN
      RAISE EXCEPTION 'create_appointments_bulk: все услуги визита должны быть в одном бизнес-дне (получены % и %)',
        v_business_date, v_item_bdate
        USING ERRCODE = 'P0001';
    END IF;

    v_lock_key := 'appt:' || COALESCE(
      v_resource_id::text,
      p_branch_id::text || ':' || v_service_id::text
    );
    IF NOT (v_lock_key = ANY(v_lock_keys)) THEN
      v_lock_keys := array_append(v_lock_keys, v_lock_key);
    END IF;
  END LOOP;

  PERFORM pg_advisory_xact_lock(hashtextextended(k, 0))
  FROM unnest(v_lock_keys) AS t(k)
  ORDER BY k;

  -- Фаза 2: визит
  INSERT INTO appointment_groups (
    tenant_id, branch_id, customer_id,
    customer_name, customer_phone, customer_email,
    notes, source, business_date,
    status
  ) VALUES (
    p_tenant_id, p_branch_id, p_customer_id,
    p_customer_name, p_customer_phone, p_customer_email,
    p_notes, p_source, v_business_date,
    'active'
  ) RETURNING id INTO v_group_id;

  -- Фаза 3: appointments
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_resource_id   := NULLIF(v_item->>'resource_id', '')::uuid;
    v_service_id    := (v_item->>'service_id')::uuid;
    v_starts_at     := (v_item->>'starts_at')::timestamptz;
    v_ends_at       := (v_item->>'ends_at')::timestamptz;
    v_service_name  := COALESCE(v_item->>'service_name', '');
    v_service_price := COALESCE((v_item->>'service_price')::numeric, 0);
    v_assigned_by   := NULLIF(v_item->>'resource_assigned_by', '');

    IF v_resource_id IS NOT NULL THEN
      SELECT capacity INTO v_capacity
      FROM resources
      WHERE id = v_resource_id AND tenant_id = p_tenant_id AND is_active = true;
      IF v_capacity IS NULL THEN
        RAISE EXCEPTION 'Resource not found or inactive' USING ERRCODE = 'P0001';
      END IF;

      SELECT COUNT(*) INTO v_overlap
      FROM appointments
      WHERE resource_id = v_resource_id
        AND status <> 'cancelled'
        AND deleted_at IS NULL
        AND starts_at < v_ends_at
        AND COALESCE(actual_ends_at, ends_at) > v_starts_at;

      IF v_overlap >= v_capacity THEN
        RAISE EXCEPTION 'Slot is taken' USING ERRCODE = 'P0002';
      END IF;
    ELSE
      SELECT COUNT(*) INTO v_overlap
      FROM appointments
      WHERE service_id = v_service_id
        AND branch_id IS NOT DISTINCT FROM p_branch_id
        AND resource_id IS NULL
        AND status <> 'cancelled'
        AND deleted_at IS NULL
        AND starts_at < v_ends_at
        AND COALESCE(actual_ends_at, ends_at) > v_starts_at;

      IF v_overlap >= 1 THEN
        RAISE EXCEPTION 'Slot is taken' USING ERRCODE = 'P0002';
      END IF;
    END IF;

    INSERT INTO appointments (
      tenant_id, branch_id, service_id, resource_id, user_id, customer_id,
      customer_name, customer_phone,
      starts_at, ends_at,
      status, notes,
      allow_reschedule_snapshot, allow_cancel_snapshot,
      service_name, service_price,
      group_id,
      resource_assigned_by
    ) VALUES (
      p_tenant_id, p_branch_id, v_service_id, v_resource_id, p_user_id, p_customer_id,
      p_customer_name, p_customer_phone,
      v_starts_at, v_ends_at,
      p_status, p_notes,
      p_allow_reschedule_snapshot, p_allow_cancel_snapshot,
      v_service_name, v_service_price,
      v_group_id,
      v_assigned_by
    ) RETURNING appointments.id INTO v_appt_id;

    v_appt_ids := array_append(v_appt_ids, v_appt_id);
  END LOOP;

  RETURN jsonb_build_object(
    'group_id', v_group_id,
    'appointments', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id',         a.id,
          'service_id', a.service_id,
          'starts_at',  a.starts_at,
          'ends_at',    a.ends_at
        )
        ORDER BY a.starts_at
      ), '[]'::jsonb)
      FROM appointments a
      WHERE a.id = ANY(v_appt_ids)
    )
  );
END
$$;

REVOKE ALL ON FUNCTION public.create_appointments_bulk(
  uuid, uuid, uuid, uuid, text, text, text, appointment_status, text, boolean, boolean, text, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_appointments_bulk(
  uuid, uuid, uuid, uuid, text, text, text, appointment_status, text, boolean, boolean, text, jsonb
) TO service_role;


-- ── convert_visit_request ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.convert_visit_request(
  p_visit_id uuid,
  p_user_id  uuid,
  p_items    jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_visit         appointment_groups%ROWTYPE;
  v_item          jsonb;
  v_resource_id   uuid;
  v_service_id    uuid;
  v_starts_at     timestamptz;
  v_ends_at       timestamptz;
  v_service_name  text;
  v_service_price numeric;
  v_assigned_by   text;
  v_capacity      int;
  v_overlap       int;
  v_appt_id       uuid;
  v_lock_keys     text[] := ARRAY[]::text[];
  v_lock_key      text;
  v_appt_ids      uuid[] := ARRAY[]::uuid[];
  v_business_date date;
  v_item_bdate    date;
BEGIN
  SELECT * INTO v_visit FROM appointment_groups WHERE id = p_visit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Visit not found' USING ERRCODE = 'P0001';
  END IF;
  IF v_visit.status <> 'request' THEN
    RAISE EXCEPTION 'Visit is not a request (status=%)', v_visit.status USING ERRCODE = 'P0001';
  END IF;
  IF auth.role() <> 'service_role' AND NOT is_tenant_member(v_visit.tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'convert_visit_request: items must be non-empty' USING ERRCODE = 'P0001';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_resource_id := NULLIF(v_item->>'resource_id', '')::uuid;
    v_service_id  := (v_item->>'service_id')::uuid;
    v_starts_at   := (v_item->>'starts_at')::timestamptz;

    IF v_resource_id IS NULL AND v_visit.branch_id IS NULL THEN
      RAISE EXCEPTION 'convert_visit_request: item requires resource_id or visit.branch_id'
        USING ERRCODE = 'P0001';
    END IF;

    v_item_bdate := compute_business_date(v_visit.branch_id, v_visit.tenant_id, v_starts_at);
    IF v_business_date IS NULL THEN
      v_business_date := v_item_bdate;
    ELSIF v_business_date <> v_item_bdate THEN
      RAISE EXCEPTION 'convert_visit_request: все услуги визита должны быть в одном бизнес-дне (% и %)',
        v_business_date, v_item_bdate
        USING ERRCODE = 'P0001';
    END IF;

    v_lock_key := 'appt:' || COALESCE(
      v_resource_id::text,
      v_visit.branch_id::text || ':' || v_service_id::text
    );
    IF NOT (v_lock_key = ANY(v_lock_keys)) THEN
      v_lock_keys := array_append(v_lock_keys, v_lock_key);
    END IF;
  END LOOP;

  PERFORM pg_advisory_xact_lock(hashtextextended(k, 0))
  FROM unnest(v_lock_keys) AS t(k)
  ORDER BY k;

  UPDATE appointment_groups
  SET business_date      = v_business_date,
      status             = 'active',
      processed_by       = p_user_id,
      processed_at       = now(),
      requested_services = NULL,
      updated_at         = now()
  WHERE id = p_visit_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_resource_id   := NULLIF(v_item->>'resource_id', '')::uuid;
    v_service_id    := (v_item->>'service_id')::uuid;
    v_starts_at     := (v_item->>'starts_at')::timestamptz;
    v_ends_at       := (v_item->>'ends_at')::timestamptz;
    v_service_name  := COALESCE(v_item->>'service_name', '');
    v_service_price := COALESCE((v_item->>'service_price')::numeric, 0);
    v_assigned_by   := NULLIF(v_item->>'resource_assigned_by', '');

    IF v_resource_id IS NOT NULL THEN
      SELECT capacity INTO v_capacity
      FROM resources
      WHERE id = v_resource_id AND tenant_id = v_visit.tenant_id AND is_active = true;
      IF v_capacity IS NULL THEN
        RAISE EXCEPTION 'Resource not found or inactive' USING ERRCODE = 'P0001';
      END IF;

      SELECT COUNT(*) INTO v_overlap
      FROM appointments
      WHERE resource_id = v_resource_id
        AND status <> 'cancelled'
        AND deleted_at IS NULL
        AND starts_at < v_ends_at
        AND COALESCE(actual_ends_at, ends_at) > v_starts_at;

      IF v_overlap >= v_capacity THEN
        RAISE EXCEPTION 'Slot is taken' USING ERRCODE = 'P0002';
      END IF;
    ELSE
      SELECT COUNT(*) INTO v_overlap
      FROM appointments
      WHERE service_id = v_service_id
        AND branch_id IS NOT DISTINCT FROM v_visit.branch_id
        AND resource_id IS NULL
        AND status <> 'cancelled'
        AND deleted_at IS NULL
        AND starts_at < v_ends_at
        AND COALESCE(actual_ends_at, ends_at) > v_starts_at;

      IF v_overlap >= 1 THEN
        RAISE EXCEPTION 'Slot is taken' USING ERRCODE = 'P0002';
      END IF;
    END IF;

    INSERT INTO appointments (
      tenant_id, branch_id, service_id, resource_id, customer_id,
      customer_name, customer_phone,
      starts_at, ends_at,
      status, notes,
      service_name, service_price,
      group_id,
      resource_assigned_by
    ) VALUES (
      v_visit.tenant_id, v_visit.branch_id, v_service_id, v_resource_id, v_visit.customer_id,
      v_visit.customer_name, v_visit.customer_phone,
      v_starts_at, v_ends_at,
      'confirmed', v_visit.notes,
      v_service_name, v_service_price,
      p_visit_id,
      v_assigned_by
    ) RETURNING appointments.id INTO v_appt_id;

    v_appt_ids := array_append(v_appt_ids, v_appt_id);
  END LOOP;

  RETURN jsonb_build_object(
    'visit_id', p_visit_id,
    'appointments', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', a.id, 'service_id', a.service_id, 'starts_at', a.starts_at, 'ends_at', a.ends_at
      ) ORDER BY a.starts_at), '[]'::jsonb)
      FROM appointments a
      WHERE a.id = ANY(v_appt_ids)
    )
  );
END
$$;

REVOKE ALL ON FUNCTION public.convert_visit_request(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_visit_request(uuid, uuid, jsonb) TO service_role;
