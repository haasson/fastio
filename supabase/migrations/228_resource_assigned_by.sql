-- =====================================================================================
-- Migration 228: appointments.resource_assigned_by — кто назначил мастера
-- =====================================================================================
--
-- Колонка отвечает на вопрос: «Этого мастера выбрал клиент сам, подобрала система,
-- или менеджер назначил вручную?». Нужно для UI (бейдж «автоподбор» в карточке)
-- и для статистики «сколько броней реально с осознанным выбором».
--
-- Значения:
--   'client' — клиент с витрины явно выбрал этого мастера.
--   'auto'   — клиент выбрал «любой», бэк подобрал автоматически (round-robin).
--   'admin'  — менеджер из админки назначил/переназначил.
--   NULL     — флаг не задан (старые записи; новые без явного указания).
--
-- Backfill: всем существующим ставим 'client' — это самое нейтральное значение,
-- т.к. до сих пор фронт всегда подбирал и слал конкретного, без признака autoподбора.
-- =====================================================================================

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS resource_assigned_by text;

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_resource_assigned_by_check;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_resource_assigned_by_check
  CHECK (resource_assigned_by IS NULL OR resource_assigned_by IN ('client', 'auto', 'admin'));

UPDATE appointments
SET resource_assigned_by = 'client'
WHERE resource_assigned_by IS NULL;


-- ─── create_appointments_bulk: пробрасываем resource_assigned_by из items ──────────

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
    notes, source, business_date
  ) VALUES (
    p_tenant_id, p_branch_id, p_customer_id,
    p_customer_name, p_customer_phone, p_customer_email,
    p_notes, p_source, v_business_date
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


-- ─── create_appointment: добавляем p_resource_assigned_by ──────────────────────────

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


-- ─── add_service_to_visit: добавляем p_resource_assigned_by ────────────────────────

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
    RAISE EXCEPTION 'Visit not found' USING ERRCODE = 'P0001';
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


-- ─── update_appointment: добавляем p_resource_assigned_by (NULL = не менять) ───────

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


-- ─── move_appointment: добавляем p_resource_assigned_by ────────────────────────────

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

  SELECT id INTO v_target_id
  FROM appointment_groups
  WHERE tenant_id = v_old_visit.tenant_id
    AND branch_id IS NOT DISTINCT FROM v_old_visit.branch_id
    AND business_date = v_new_bdate
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
      notes, source, business_date
    ) VALUES (
      v_old_visit.tenant_id, v_old_visit.branch_id, v_old_visit.customer_id,
      v_old_visit.customer_name, v_old_visit.customer_phone, v_old_visit.customer_email,
      v_old_visit.notes, v_old_visit.source, v_new_bdate
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
