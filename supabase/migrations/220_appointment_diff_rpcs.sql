-- =====================================================================================
-- Migration 220: add_appointment_to_group + update_appointment RPCs
-- =====================================================================================
--
-- 1. add_appointment_to_group — добавляет один appointment в существующую группу
--    с capacity-проверкой и advisory lock (TOCTOU-защита).
--    customer_id/name/phone копируются из группы.
--    Триггер recalc_appointment_group_aggregates пересчитает total_* автоматически.
--
-- 2. update_appointment — изменяет resource_id, слот (starts_at/ends_at) и/или
--    снапшот услуги (service_id/name/price). Capacity-чек — только при смене слота.
--    Поля customer_*, status, actual_ends_at, confirmed_*, cancelled_*, group_id
--    НЕ трогаются этим RPC.
--
-- Оба RPC: SECURITY DEFINER, grantee = service_role.
-- =====================================================================================


-- ─── 1. add_appointment_to_group ─────────────────────────────────────────────────────

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

  -- 3. Закрытую группу не редактируем
  IF v_group.status IN ('cancelled', 'done') THEN
    RAISE EXCEPTION 'Cannot add to closed group' USING ERRCODE = 'P0001';
  END IF;

  -- 4. Advisory lock: resource_id или branch+service
  IF p_resource_id IS NOT NULL THEN
    v_lock_key := 'appt:' || p_resource_id::text;
  ELSIF v_group.branch_id IS NOT NULL THEN
    v_lock_key := 'appt:' || v_group.branch_id::text || ':' || p_service_id::text;
  ELSE
    RAISE EXCEPTION 'add_appointment_to_group: resource_id or group.branch_id must be set'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));

  -- 5. Capacity check
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

  -- 6. INSERT: копируем customer_*/notes из группы
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


-- ─── 2. update_appointment ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_appointment(
  p_id            uuid,
  p_resource_id   uuid,               -- новый resource (NULL = branch-only)
  p_starts_at     timestamptz,
  p_ends_at       timestamptz,
  p_service_id    uuid    DEFAULT NULL,  -- NULL = не менять
  p_service_name  text    DEFAULT NULL,  -- NULL = не менять
  p_service_price numeric DEFAULT NULL   -- NULL = не менять
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
  -- 1. Найти запись
  SELECT * INTO v_appt
  FROM appointments
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Auth check
  IF auth.role() <> 'service_role' AND NOT is_tenant_member(v_appt.tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member' USING ERRCODE = 'P0001';
  END IF;

  -- 3. Status check
  IF v_appt.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot update cancelled appointment' USING ERRCODE = 'P0001';
  END IF;
  IF v_appt.status = 'done' THEN
    RAISE EXCEPTION 'Cannot update completed appointment' USING ERRCODE = 'P0001';
  END IF;

  -- 4. Advisory lock по новому слоту
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

  -- 5. Capacity check — только если слот или ресурс изменился
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

  -- 6. Финальные значения снапшота (NULL-аргумент = не менять)
  v_service_id    := COALESCE(p_service_id,    v_appt.service_id);
  v_service_name  := COALESCE(p_service_name,  v_appt.service_name);
  v_service_price := COALESCE(p_service_price, v_appt.service_price);

  -- 7. UPDATE
  UPDATE appointments SET
    resource_id   = p_resource_id,
    starts_at     = p_starts_at,
    ends_at       = p_ends_at,
    service_id    = v_service_id,
    service_name  = v_service_name,
    service_price = v_service_price
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
  uuid, uuid, timestamptz, timestamptz, uuid, text, numeric
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.update_appointment(
  uuid, uuid, timestamptz, timestamptz, uuid, text, numeric
) TO service_role;
