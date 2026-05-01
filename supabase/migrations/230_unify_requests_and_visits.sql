-- =====================================================================================
-- Migration 230: заявки = стадия визита (status='request')
-- =====================================================================================
--
-- Заявка без даты (старая `appointment_requests`) концептуально = визит,
-- у которого клиент не выбрал слоты. Сливаем в одну сущность appointment_groups
-- со статусом 'request' / 'active' / 'cancelled'. Удаляем отдельную таблицу.
--
-- Изменения:
--   1. appointment_groups:
--        + status text NOT NULL DEFAULT 'active' CHECK IN ('request', 'active', 'cancelled')
--        + requested_services jsonb NULL — для request-стадии (snake_case items)
--        + processed_by uuid NULL, processed_at timestamptz NULL — аудит оформления
--        business_date — становится nullable (для request слотов нет → нет даты)
--   2. Триггер enforce_visit_business_date — пропускает NULL.
--   3. Перенос appointment_requests → appointment_groups:
--        new/in_progress → status='request'
--        declined        → status='cancelled' + processed_*
--        converted       → не переносим (уже есть active visit, на который ссылается converted_group_id)
--   4. DROP TABLE appointment_requests.
--   5. RPC create_visit_request — INSERT visit со status='request' (для storefront /api/appointments/request).
--   6. RPC convert_visit_request — превращает request в active: проставляет
--      business_date, status, processed_*, INSERT appointments через обычный capacity-чек.
--   7. Cleanup: индексы appointment_groups_tenant_status_idx (для фильтра инбокса).
-- =====================================================================================


-- ─── 1. Колонки ─────────────────────────────────────────────────────────────────────

ALTER TABLE appointment_groups
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('request', 'active', 'cancelled'));

ALTER TABLE appointment_groups
  ADD COLUMN IF NOT EXISTS requested_services jsonb;

ALTER TABLE appointment_groups
  ADD COLUMN IF NOT EXISTS processed_by uuid,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

ALTER TABLE appointment_groups ALTER COLUMN business_date DROP NOT NULL;


-- ─── 2. Триггер: пропускает request-визиты (business_date IS NULL) ──────────────────

CREATE OR REPLACE FUNCTION enforce_visit_business_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_visit_bdate date;
  v_appt_bdate  date;
BEGIN
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


-- ─── 3. Перенос данных из appointment_requests ──────────────────────────────────────
--
-- Карта статусов:
--   appointment_requests.status='new'         → appointment_groups.status='request'
--   appointment_requests.status='in_progress' → appointment_groups.status='request' + processed_*
--   appointment_requests.status='declined'    → appointment_groups.status='cancelled' + processed_*
--   appointment_requests.status='converted'   → НЕ переносим (созданный визит уже есть в БД через converted_group_id)

DO $$
DECLARE
  v_req record;
  v_new_visit_id uuid;
BEGIN
  FOR v_req IN
    SELECT * FROM appointment_requests
    WHERE status IN ('new', 'in_progress', 'declined')
  LOOP
    INSERT INTO appointment_groups (
      tenant_id, branch_id, customer_id,
      customer_name, customer_phone, customer_email,
      notes, source, business_date,
      status, requested_services,
      processed_by, processed_at,
      created_at, updated_at
    ) VALUES (
      v_req.tenant_id, v_req.branch_id, v_req.customer_id,
      v_req.customer_name, v_req.customer_phone, v_req.customer_email,
      v_req.notes, 'request', NULL,
      CASE WHEN v_req.status = 'declined' THEN 'cancelled' ELSE 'request' END,
      v_req.services,
      v_req.processed_by, v_req.processed_at,
      v_req.created_at, v_req.updated_at
    )
    RETURNING id INTO v_new_visit_id;
  END LOOP;
END $$;

-- converted-заявки уже привязаны к существующим visit-ам через
-- appointment_groups.request_id (оно проставлялось при оформлении). Просто отбрасываем.
-- Сама колонка request_id и FK на appointment_requests тоже уходят — больше не нужны.
ALTER TABLE appointment_groups
  DROP CONSTRAINT IF EXISTS appointment_groups_request_id_fkey;
ALTER TABLE appointment_groups
  DROP COLUMN IF EXISTS request_id;
DROP TABLE IF EXISTS appointment_requests;


-- ─── 4. Индекс для инбокс-фильтрации ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS appointment_groups_tenant_status_idx
  ON appointment_groups (tenant_id, status, created_at DESC);


-- ─── 5. RPC create_visit_request ────────────────────────────────────────────────────
--
-- Заводит request-визит без appointments. Используется storefront /api/appointments/request.

CREATE OR REPLACE FUNCTION public.create_visit_request(
  p_tenant_id          uuid,
  p_branch_id          uuid,
  p_customer_id        uuid,
  p_customer_name      text,
  p_customer_phone     text,
  p_customer_email     text,
  p_notes              text,
  p_requested_services jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_visit_id uuid;
BEGIN
  IF jsonb_array_length(p_requested_services) = 0 THEN
    RAISE EXCEPTION 'create_visit_request: requested_services must be non-empty'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO appointment_groups (
    tenant_id, branch_id, customer_id,
    customer_name, customer_phone, customer_email,
    notes, source, business_date,
    status, requested_services
  ) VALUES (
    p_tenant_id, p_branch_id, p_customer_id,
    p_customer_name, p_customer_phone, p_customer_email,
    p_notes, 'request', NULL,
    'request', p_requested_services
  )
  RETURNING id INTO v_visit_id;

  RETURN jsonb_build_object('id', v_visit_id);
END
$$;

REVOKE ALL ON FUNCTION public.create_visit_request(
  uuid, uuid, uuid, text, text, text, text, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_visit_request(
  uuid, uuid, uuid, text, text, text, text, jsonb
) TO service_role;


-- ─── 6. RPC convert_visit_request ───────────────────────────────────────────────────
--
-- Превращает request в active: проставляет business_date по items, status='active',
-- processed_*; INSERT appointments с capacity-чеком (через ту же логику что bulk).
-- Используется admin при «Оформить запись».

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

  -- Фаза 1: locks + business_date
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

  -- Фаза 2: проставляем business_date + статус ДО вставки appointments,
  -- иначе триггер enforce_visit_business_date упадёт (он читает текущий business_date).
  UPDATE appointment_groups
  SET business_date      = v_business_date,
      status             = 'active',
      processed_by       = p_user_id,
      processed_at       = now(),
      requested_services = NULL,
      updated_at         = now()
  WHERE id = p_visit_id;

  -- Фаза 3: INSERT appointments
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
