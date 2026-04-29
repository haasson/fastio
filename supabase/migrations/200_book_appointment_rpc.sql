-- Migration 199: book_appointment / book_appointments_bulk RPC.
--
-- Why: storefront previously did SELECT-then-INSERT to reserve a slot. Two
-- concurrent requests on the same resource+slot both passed the SELECT and
-- both INSERT'ed (TOCTOU double-booking).
--
-- Solution: wrap "check capacity → insert" inside a SECURITY DEFINER function
-- that takes pg_advisory_xact_lock(hashtext(resource_id)) before the check.
-- Lock is released at COMMIT/ROLLBACK automatically. capacity-aware: a resource
-- with capacity=N allows N parallel overlapping bookings.
--
-- These functions are intended for service_role usage from server endpoints
-- (storefront /api/appointments/{index,bulk}.post.ts). They do NOT bypass
-- tenant_id/service/resource validation — that lives in the endpoint.

-- ─── Single appointment ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.book_appointment(
  p_tenant_id      uuid,
  p_branch_id      uuid,
  p_service_id     uuid,
  p_resource_id    uuid,           -- nullable: branch-only services
  p_user_id        uuid,
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
DECLARE
  v_capacity      int;
  v_overlapping   int;
  v_lock_key      text;
  v_appt_id       uuid;
  v_appt_status   appointment_status;
BEGIN
  -- Lock per-resource (or per-(branch,service) if no resource).
  v_lock_key := 'book:' || COALESCE(p_resource_id::text, p_branch_id::text || ':' || p_service_id::text);
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
    -- branch-only service (no resource): check overlapping appointments
    -- of the same service on the same branch.
    SELECT COUNT(*) INTO v_overlapping
      FROM appointments
      WHERE service_id = p_service_id
        AND branch_id IS NOT DISTINCT FROM p_branch_id
        AND resource_id IS NULL
        AND status <> 'cancelled'
        AND starts_at < p_ends_at
        AND COALESCE(actual_ends_at, ends_at) > p_starts_at;

    -- branch-only services use capacity=1 (can be relaxed later if needed).
    IF v_overlapping >= 1 THEN
      RAISE EXCEPTION 'Slot is taken' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  INSERT INTO appointments(
    tenant_id, branch_id, service_id, resource_id, user_id,
    customer_name, customer_phone,
    starts_at, ends_at,
    status, notes,
    allow_reschedule_snapshot, allow_cancel_snapshot
  ) VALUES (
    p_tenant_id, p_branch_id, p_service_id, p_resource_id, p_user_id,
    p_customer_name, p_customer_phone,
    p_starts_at, p_ends_at,
    p_status, p_notes,
    p_allow_reschedule_snapshot, p_allow_cancel_snapshot
  )
  RETURNING appointments.id, appointments.status INTO v_appt_id, v_appt_status;

  RETURN QUERY SELECT v_appt_id, v_appt_status, p_starts_at, p_ends_at;
END
$$;

REVOKE ALL ON FUNCTION public.book_appointment(
  uuid, uuid, uuid, uuid, uuid, text, text, timestamptz, timestamptz,
  appointment_status, text, boolean, boolean
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.book_appointment(
  uuid, uuid, uuid, uuid, uuid, text, text, timestamptz, timestamptz,
  appointment_status, text, boolean, boolean
) TO service_role;

-- ─── Bulk appointments ───────────────────────────────────────────────
-- Atomic: either all items insert or all roll back. Uses the same advisory
-- lock pattern per resource. Items must be a JSON array of:
--   { service_id, resource_id, starts_at, ends_at }
-- Other fields (customer_name, status, etc.) are shared across the batch.

CREATE OR REPLACE FUNCTION public.book_appointments_bulk(
  p_tenant_id      uuid,
  p_branch_id      uuid,
  p_user_id        uuid,
  p_customer_name  text,
  p_customer_phone text,
  p_status         appointment_status,
  p_notes          text,
  p_allow_reschedule_snapshot boolean,
  p_allow_cancel_snapshot     boolean,
  p_items          jsonb        -- [{service_id, resource_id, starts_at, ends_at}]
)
RETURNS TABLE(id uuid, service_id uuid, starts_at timestamptz, ends_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
  -- Pre-collect distinct lock keys, sort, then take them in order to avoid
  -- deadlocks between concurrent bulk-bookings on overlapping resource sets.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_resource_id := NULLIF(v_item->>'resource_id', '')::uuid;
    v_service_id  := (v_item->>'service_id')::uuid;
    v_lock_key    := 'book:' || COALESCE(v_resource_id::text, p_branch_id::text || ':' || v_service_id::text);
    IF NOT (v_lock_key = ANY(v_lock_keys)) THEN
      v_lock_keys := array_append(v_lock_keys, v_lock_key);
    END IF;
  END LOOP;

  PERFORM pg_advisory_xact_lock(hashtextextended(k, 0))
  FROM unnest(v_lock_keys) AS t(k)
  ORDER BY k;

  -- Validate + insert each item.
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
      tenant_id, branch_id, service_id, resource_id, user_id,
      customer_name, customer_phone,
      starts_at, ends_at,
      status, notes,
      allow_reschedule_snapshot, allow_cancel_snapshot
    ) VALUES (
      p_tenant_id, p_branch_id, v_service_id, v_resource_id, p_user_id,
      p_customer_name, p_customer_phone,
      v_starts_at, v_ends_at,
      p_status, p_notes,
      p_allow_reschedule_snapshot, p_allow_cancel_snapshot
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

REVOKE ALL ON FUNCTION public.book_appointments_bulk(
  uuid, uuid, uuid, text, text, appointment_status, text, boolean, boolean, jsonb
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.book_appointments_bulk(
  uuid, uuid, uuid, text, text, appointment_status, text, boolean, boolean, jsonb
) TO service_role;
