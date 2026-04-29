-- Migration 211: при создании записи со статусом 'confirmed' (auto_confirm) —
-- проставлять confirmed_at = now() и confirmed_by = p_user_id.
--
-- Раньше create_appointment / create_appointments_bulk вставляли запись со
-- status='confirmed', но confirmed_at/by оставались NULL. Это ломает аудит
-- и не сходится с логикой confirm() RPC.
--
-- Меняем тело функций через CREATE OR REPLACE — сигнатура не меняется.

CREATE OR REPLACE FUNCTION public.create_appointment(
  p_tenant_id      uuid,
  p_branch_id      uuid,
  p_service_id     uuid,
  p_resource_id    uuid,
  p_user_id        uuid,
  p_customer_id    uuid,
  p_customer_name  text,
  p_customer_phone text,
  p_starts_at      timestamptz,
  p_ends_at        timestamptz,
  p_status         appointment_status,
  p_notes          text,
  p_allow_reschedule_snapshot boolean,
  p_allow_cancel_snapshot     boolean
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
BEGIN
  IF p_resource_id IS NULL AND p_branch_id IS NULL THEN
    RAISE EXCEPTION 'create_appointment: either p_resource_id or p_branch_id must be provided' USING ERRCODE = 'P0001';
  END IF;

  v_lock_key := 'appt:' || COALESCE(p_resource_id::text, p_branch_id::text || ':' || p_service_id::text);
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

  INSERT INTO appointments(
    tenant_id, branch_id, service_id, resource_id, user_id, customer_id,
    customer_name, customer_phone,
    starts_at, ends_at,
    status, notes,
    allow_reschedule_snapshot, allow_cancel_snapshot,
    confirmed_at, confirmed_by
  ) VALUES (
    p_tenant_id, p_branch_id, p_service_id, p_resource_id, p_user_id, p_customer_id,
    p_customer_name, p_customer_phone,
    p_starts_at, p_ends_at,
    p_status, p_notes,
    p_allow_reschedule_snapshot, p_allow_cancel_snapshot,
    CASE WHEN p_status = 'confirmed' THEN now() END,
    CASE WHEN p_status = 'confirmed' THEN p_user_id END
  )
  RETURNING appointments.id, appointments.status INTO v_appt_id, v_appt_status;

  RETURN QUERY SELECT v_appt_id, v_appt_status, p_starts_at, p_ends_at;
END
$$;

CREATE OR REPLACE FUNCTION public.create_appointments_bulk(
  p_tenant_id      uuid,
  p_branch_id      uuid,
  p_user_id        uuid,
  p_customer_id    uuid,
  p_customer_name  text,
  p_customer_phone text,
  p_status         appointment_status,
  p_notes          text,
  p_allow_reschedule_snapshot boolean,
  p_allow_cancel_snapshot     boolean,
  p_items          jsonb
)
RETURNS TABLE(id uuid, service_id uuid, starts_at timestamptz, ends_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_item        jsonb;
  v_resource_id uuid;
  v_service_id  uuid;
  v_starts_at   timestamptz;
  v_ends_at     timestamptz;
  v_capacity    int;
  v_overlap     int;
  v_appt_id     uuid;
  v_lock_keys   text[] := ARRAY[]::text[];
  v_lock_key    text;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_resource_id := NULLIF(v_item->>'resource_id', '')::uuid;
    v_service_id  := (v_item->>'service_id')::uuid;
    IF v_resource_id IS NULL AND p_branch_id IS NULL THEN
      RAISE EXCEPTION 'create_appointments_bulk: each item must have resource_id, or p_branch_id must be provided' USING ERRCODE = 'P0001';
    END IF;
    v_lock_key    := 'appt:' || COALESCE(v_resource_id::text, p_branch_id::text || ':' || v_service_id::text);
    IF NOT (v_lock_key = ANY(v_lock_keys)) THEN
      v_lock_keys := array_append(v_lock_keys, v_lock_key);
    END IF;
  END LOOP;

  PERFORM pg_advisory_xact_lock(hashtextextended(k, 0))
  FROM unnest(v_lock_keys) AS t(k)
  ORDER BY k;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_resource_id := NULLIF(v_item->>'resource_id', '')::uuid;
    v_service_id  := (v_item->>'service_id')::uuid;
    v_starts_at   := (v_item->>'starts_at')::timestamptz;
    v_ends_at     := (v_item->>'ends_at')::timestamptz;

    IF v_resource_id IS NOT NULL THEN
      SELECT capacity INTO v_capacity FROM resources
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

    INSERT INTO appointments(
      tenant_id, branch_id, service_id, resource_id, user_id, customer_id,
      customer_name, customer_phone,
      starts_at, ends_at,
      status, notes,
      allow_reschedule_snapshot, allow_cancel_snapshot,
      confirmed_at, confirmed_by
    ) VALUES (
      p_tenant_id, p_branch_id, v_service_id, v_resource_id, p_user_id, p_customer_id,
      p_customer_name, p_customer_phone,
      v_starts_at, v_ends_at,
      p_status, p_notes,
      p_allow_reschedule_snapshot, p_allow_cancel_snapshot,
      CASE WHEN p_status = 'confirmed' THEN now() END,
      CASE WHEN p_status = 'confirmed' THEN p_user_id END
    )
    RETURNING appointments.id INTO v_appt_id;

    id          := v_appt_id;
    service_id  := v_service_id;
    starts_at   := v_starts_at;
    ends_at     := v_ends_at;
    RETURN NEXT;
  END LOOP;
END
$$;
