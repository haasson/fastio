-- =====================================================================================
-- Migration 221: allow p_source='request' in create_appointments_bulk
-- =====================================================================================
--
-- AppointmentSource = 'storefront' | 'admin' | 'request' (см. 218 + типы в shared).
-- В 218 RPC валидировал только 'storefront'/'admin' — путь конвертации заявки в группу
-- (admin кликает «Оформить запись») оставался без своего значения source и помечался
-- как 'admin'. Добавляем 'request' в whitelist, остальные части RPC не трогаем.
-- =====================================================================================

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

  -- Фаза 2: создаём группу
  INSERT INTO appointment_groups (
    tenant_id, branch_id, customer_id,
    customer_name, customer_phone, customer_email,
    notes, status, source
  ) VALUES (
    p_tenant_id, p_branch_id, p_customer_id,
    p_customer_name, p_customer_phone, p_customer_email,
    p_notes, 'new', p_source
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
