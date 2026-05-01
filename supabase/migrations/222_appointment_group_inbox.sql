-- =====================================================================================
-- Migration 222: appointment_groups → "inbox" (почтовая коробка входящих записей)
-- =====================================================================================
--
-- Концепция: appointment_group перестаёт быть мутабельной сущностью с агрегатным
-- статусом и превращается в «почтовую коробку» — временный контейнер входящих
-- записей (status = 'new'). Как только статус appointment меняется на что угодно
-- кроме 'new' — запись автоматически выходит из коробки (group_id → NULL).
-- Пустые группы удаляются триггером.
--
-- Что меняется:
--   1. Удаляем поля status/total_price/total_duration_minutes из appointment_groups
--   2. Делаем appointments.group_id nullable
--   3. Удаляем старый триггер/функцию пересчёта агрегатов
--   4. Создаём новый триггер «выхода из коробки»
--   5. Добавляем индекс для поиска new-записей по группе
--   6. Обновляем create_appointments_bulk — убираем status из INSERT в группу
--   7. Обновляем add_appointment_to_group — убираем проверку закрытой группы
-- =====================================================================================


-- ─── 1. Удаляем агрегатные поля из appointment_groups ───────────────────────────────

ALTER TABLE appointment_groups
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS total_price,
  DROP COLUMN IF EXISTS total_duration_minutes;

DROP INDEX IF EXISTS appointment_groups_tenant_status_idx;

ALTER TABLE appointment_groups
  DROP CONSTRAINT IF EXISTS appointment_groups_status_check;


-- ─── 2. appointments.group_id → nullable ────────────────────────────────────────────

ALTER TABLE appointments ALTER COLUMN group_id DROP NOT NULL;


-- ─── 3. Удаляем старый триггер и функцию пересчёта агрегатов ────────────────────────

DROP TRIGGER IF EXISTS trg_appointments_recalc_group ON appointments;
DROP FUNCTION IF EXISTS recalc_appointment_group_aggregates();


-- ─── 4. Триггер «выхода из коробки» ─────────────────────────────────────────────────
--
-- Срабатывает BEFORE UPDATE на appointments.
-- Условие: запись была 'new' и меняет статус на что-то другое, при этом в группе.
-- Что делает:
--   a) Обнуляет NEW.group_id (запись выходит из коробки)
--   b) Если в группе больше нет других записей со status='new' → удаляет группу

CREATE OR REPLACE FUNCTION leave_appointment_group_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_group_id uuid;
  v_remaining int;
BEGIN
  -- Срабатываем только когда: была 'new', стала не-'new', была в группе
  IF OLD.status <> 'new' OR NEW.status = 'new' OR OLD.group_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_group_id := OLD.group_id;

  -- Обнуляем group_id у изменяемой записи
  NEW.group_id := NULL;

  -- Проверяем: остались ли другие 'new'-записи в этой группе
  SELECT COUNT(*) INTO v_remaining
  FROM appointments
  WHERE group_id = v_group_id
    AND status = 'new'
    AND id <> OLD.id;

  IF v_remaining = 0 THEN
    DELETE FROM appointment_groups WHERE id = v_group_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_leave_group ON appointments;
CREATE TRIGGER trg_appointments_leave_group
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION leave_appointment_group_on_status_change();


-- ─── 5. Индекс для поиска new-записей в группе ──────────────────────────────────────

CREATE INDEX IF NOT EXISTS appointments_group_new_idx ON appointments (group_id)
  WHERE status = 'new' AND group_id IS NOT NULL;


-- ─── 6. create_appointments_bulk — убираем status из INSERT в appointment_groups ─────
--
-- Актуальная версия из migration 221 (p_source поддерживает 'storefront'|'admin'|'request').
-- Единственное изменение: INSERT в appointment_groups без поля status.

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
  v_item          jsonb;
  v_resource_id   uuid;
  v_service_id    uuid;
  v_starts_at     timestamptz;
  v_ends_at       timestamptz;
  v_service_name  text;
  v_service_price numeric;
  v_capacity      int;
  v_overlap       int;
  v_appt_id       uuid;
  v_lock_keys     text[] := ARRAY[]::text[];
  v_lock_key      text;
  v_group_id      uuid;
  v_appt_ids      uuid[] := ARRAY[]::uuid[];
BEGIN
  IF p_source NOT IN ('storefront', 'admin', 'request') THEN
    RAISE EXCEPTION 'create_appointments_bulk: p_source must be ''storefront'', ''admin'' or ''request'''
      USING ERRCODE = 'P0001';
  END IF;

  -- Фаза 1: собираем lock-ключи для TOCTOU-защиты
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_resource_id := NULLIF(v_item->>'resource_id', '')::uuid;
    v_service_id  := (v_item->>'service_id')::uuid;
    IF v_resource_id IS NULL AND p_branch_id IS NULL THEN
      RAISE EXCEPTION 'create_appointments_bulk: item requires resource_id or p_branch_id must be set'
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

  -- Фаза 2: создаём группу (без status — поле удалено в migration 222)
  INSERT INTO appointment_groups (
    tenant_id, branch_id, customer_id,
    customer_name, customer_phone, customer_email,
    notes, source
  ) VALUES (
    p_tenant_id, p_branch_id, p_customer_id,
    p_customer_name, p_customer_phone, p_customer_email,
    p_notes, p_source
  ) RETURNING id INTO v_group_id;

  -- Фаза 3: вставляем appointments с group_id
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_resource_id   := NULLIF(v_item->>'resource_id', '')::uuid;
    v_service_id    := (v_item->>'service_id')::uuid;
    v_starts_at     := (v_item->>'starts_at')::timestamptz;
    v_ends_at       := (v_item->>'ends_at')::timestamptz;
    v_service_name  := COALESCE(v_item->>'service_name', '');
    v_service_price := COALESCE((v_item->>'service_price')::numeric, 0);

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
      group_id
    ) VALUES (
      p_tenant_id, p_branch_id, v_service_id, v_resource_id, p_user_id, p_customer_id,
      p_customer_name, p_customer_phone,
      v_starts_at, v_ends_at,
      p_status, p_notes,
      p_allow_reschedule_snapshot, p_allow_cancel_snapshot,
      v_service_name, v_service_price,
      v_group_id
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


-- ─── 7. add_appointment_to_group — убираем проверку закрытой группы ─────────────────
--
-- Актуальная версия из migration 220.
-- Убран блок "-- 3. Закрытую группу не редактируем" (строки 57-60 в 220):
--   IF v_group.status IN ('cancelled', 'done') THEN
--     RAISE EXCEPTION 'Cannot add to closed group' USING ERRCODE = 'P0001';
--   END IF;
-- Поле status больше не существует в appointment_groups.
-- Нумерация шагов в комментарях сдвинута соответственно.

CREATE OR REPLACE FUNCTION public.add_appointment_to_group(
  p_group_id      uuid,
  p_service_id    uuid,
  p_resource_id   uuid,               -- nullable: услуга без конкретного исполнителя
  p_starts_at     timestamptz,
  p_ends_at       timestamptz,
  p_service_name  text,
  p_service_price numeric,
  p_status        appointment_status  DEFAULT 'new'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_group       appointment_groups%ROWTYPE;
  v_lock_key    text;
  v_capacity    int;
  v_overlap     int;
  v_appt_id     uuid;
BEGIN
  -- 1. Найти группу
  SELECT * INTO v_group
  FROM appointment_groups
  WHERE id = p_group_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Group not found' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Auth check
  IF auth.role() <> 'service_role' AND NOT is_tenant_member(v_group.tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member' USING ERRCODE = 'P0001';
  END IF;

  -- 3. Advisory lock: resource_id или branch+service
  IF p_resource_id IS NOT NULL THEN
    v_lock_key := 'appt:' || p_resource_id::text;
  ELSIF v_group.branch_id IS NOT NULL THEN
    v_lock_key := 'appt:' || v_group.branch_id::text || ':' || p_service_id::text;
  ELSE
    RAISE EXCEPTION 'add_appointment_to_group: resource_id or group.branch_id must be set'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));

  -- 4. Capacity check
  IF p_resource_id IS NOT NULL THEN
    SELECT capacity INTO v_capacity
    FROM resources
    WHERE id = p_resource_id AND tenant_id = v_group.tenant_id AND is_active = true;

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
      AND branch_id IS NOT DISTINCT FROM v_group.branch_id
      AND resource_id IS NULL
      AND status <> 'cancelled'
      AND starts_at < p_ends_at
      AND COALESCE(actual_ends_at, ends_at) > p_starts_at;

    IF v_overlap >= 1 THEN
      RAISE EXCEPTION 'Slot is taken' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  -- 5. INSERT: копируем customer_*/notes из группы
  INSERT INTO appointments (
    tenant_id, branch_id, service_id, resource_id,
    customer_id, customer_name, customer_phone,
    starts_at, ends_at,
    status, notes,
    service_name, service_price,
    group_id
  ) VALUES (
    v_group.tenant_id, v_group.branch_id, p_service_id, p_resource_id,
    v_group.customer_id, v_group.customer_name, v_group.customer_phone,
    p_starts_at, p_ends_at,
    p_status, v_group.notes,
    p_service_name, p_service_price,
    p_group_id
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

REVOKE ALL ON FUNCTION public.add_appointment_to_group(
  uuid, uuid, uuid, timestamptz, timestamptz, text, numeric, appointment_status
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.add_appointment_to_group(
  uuid, uuid, uuid, timestamptz, timestamptz, text, numeric, appointment_status
) TO service_role;
