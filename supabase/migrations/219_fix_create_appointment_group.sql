-- =====================================================================================
-- Migration 219: fix create_appointment + tighten anon RLS on appointment_requests
-- =====================================================================================
--
-- Fixes after 218:
--
-- 🔴 Critical: create_appointment (single) не писал group_id → INSERT в appointments
--    падал с NOT NULL violation. Теперь создаёт appointment_groups из 1 элемента
--    перед вставкой appointment.
--    Добавлены 2 параметра с DEFAULT (обратно совместимы, старые вызовы с 16 аргументами
--    продолжат работать через PG function overload resolution):
--      p_customer_email text    DEFAULT NULL   — хранится в appointment_groups
--      p_source         text    DEFAULT 'storefront' — 'storefront' | 'admin'
--
-- 🟡 Minor: политика appointment_requests_anon_insert пересоздаётся с TO anon
--    и проверкой существования тенанта (снижает DoS-вектор через публичный PostgREST).
-- =====================================================================================


-- ─── 1. create_appointment: добавляем создание группы ────────────────────────────────

-- Удаляем старую 16-param версию; новая (18-param с дефолтами) принимает 16 аргументов
-- через default resolution — обратная совместимость сохранена.
DROP FUNCTION IF EXISTS public.create_appointment(
  uuid, uuid, uuid, uuid, uuid, uuid, text, text,
  timestamptz, timestamptz, appointment_status, text, boolean, boolean, text, numeric
);

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
  p_customer_email            text    DEFAULT NULL,     -- NEW: хранится в appointment_groups
  p_source                    text    DEFAULT 'storefront' -- NEW: 'storefront' | 'admin'
)
RETURNS TABLE(id uuid, status appointment_status, starts_at timestamptz, ends_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_capacity    int;
  v_overlapping int;
  v_lock_key    text;
  v_appt_id     uuid;
  v_appt_status appointment_status;
  v_group_id    uuid;
BEGIN
  IF p_resource_id IS NULL AND p_branch_id IS NULL THEN
    RAISE EXCEPTION 'create_appointment: either p_resource_id or p_branch_id must be provided'
      USING ERRCODE = 'P0001';
  END IF;

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

  -- Создаём группу из 1 элемента перед вставкой appointment
  INSERT INTO appointment_groups (
    tenant_id, branch_id, customer_id,
    customer_name, customer_phone, customer_email,
    notes, status, source
  ) VALUES (
    p_tenant_id, p_branch_id, p_customer_id,
    p_customer_name, p_customer_phone, p_customer_email,
    p_notes, 'new', COALESCE(p_source, 'storefront')
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


-- ─── 2. appointment_requests_anon_insert: ужесточаем политику ────────────────────────

DROP POLICY IF EXISTS "appointment_requests_anon_insert" ON appointment_requests;

CREATE POLICY "appointment_requests_anon_insert"
  ON appointment_requests
  FOR INSERT
  TO anon
  WITH CHECK (
    tenant_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM tenants WHERE id = tenant_id)
  );
