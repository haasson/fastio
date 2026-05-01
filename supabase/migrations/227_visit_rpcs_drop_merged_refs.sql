-- =====================================================================================
-- Migration 227: убираем ссылки на merged_into_id из RPC после её сноса в 226
-- =====================================================================================
--
-- В 226 удалена колонка appointment_groups.merged_into_id, но в 225 RPC
-- add_service_to_visit и move_appointment ссылались на неё:
--   - add_service_to_visit: блокировка добавления в merged-визит (больше не нужна)
--   - move_appointment: фильтр merged_into_id IS NULL при поиске целевого визита
-- При вызове падает: column "merged_into_id" does not exist.
-- Перевыпускаем обе функции без этих ссылок.
-- =====================================================================================


-- ─── add_service_to_visit ───────────────────────────────────────────────────────────

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


-- ─── move_appointment ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.move_appointment(
  p_appt_id     uuid,
  p_starts_at   timestamptz,
  p_ends_at     timestamptz,
  p_resource_id uuid DEFAULT NULL,
  p_service_id  uuid DEFAULT NULL
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

  -- Поиск целевого визита того же tenant+branch+customer на новую дату.
  -- Раньше тут был ещё фильтр merged_into_id IS NULL — после 226 эта колонка
  -- не существует, объединение визитов снято.
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
  SET group_id    = v_target_id,
      starts_at   = p_starts_at,
      ends_at     = p_ends_at,
      resource_id = p_resource_id,
      service_id  = v_service_id
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
