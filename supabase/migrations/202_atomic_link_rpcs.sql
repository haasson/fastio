-- Migration 202: atomic helpers for many-to-many link tables and template apply.
--
-- The admin client previously did delete-then-insert as two requests, which
-- left half-written state if the second request failed. These RPCs move both
-- operations into a single transaction.
--
-- Authentication: each RPC checks is_tenant_member(tenant_id) on the parent
-- entity, so RLS-equivalent permission is enforced even though the function
-- runs as SECURITY DEFINER.

-- ─── services_set_branch_ids ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.services_set_branch_ids(
  p_service_id uuid,
  p_branch_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM services WHERE id = p_service_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Service not found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT is_tenant_member(v_tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member' USING ERRCODE = '42501';
  END IF;

  DELETE FROM service_branches WHERE service_id = p_service_id;
  IF array_length(p_branch_ids, 1) > 0 THEN
    INSERT INTO service_branches(service_id, branch_id)
    SELECT p_service_id, b FROM unnest(p_branch_ids) AS b;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.services_set_branch_ids(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.services_set_branch_ids(uuid, uuid[]) TO authenticated;

-- ─── resources_set_branch_ids ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.resources_set_branch_ids(
  p_resource_id uuid,
  p_branch_ids  uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM resources WHERE id = p_resource_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Resource not found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT is_tenant_member(v_tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member' USING ERRCODE = '42501';
  END IF;

  DELETE FROM resource_branches WHERE resource_id = p_resource_id;
  IF array_length(p_branch_ids, 1) > 0 THEN
    INSERT INTO resource_branches(resource_id, branch_id)
    SELECT p_resource_id, b FROM unnest(p_branch_ids) AS b;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.resources_set_branch_ids(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resources_set_branch_ids(uuid, uuid[]) TO authenticated;

-- ─── resources_set_service_ids ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.resources_set_service_ids(
  p_resource_id uuid,
  p_service_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM resources WHERE id = p_resource_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Resource not found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT is_tenant_member(v_tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member' USING ERRCODE = '42501';
  END IF;

  DELETE FROM service_resources WHERE resource_id = p_resource_id;
  IF array_length(p_service_ids, 1) > 0 THEN
    INSERT INTO service_resources(resource_id, service_id)
    SELECT p_resource_id, s FROM unnest(p_service_ids) AS s;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.resources_set_service_ids(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resources_set_service_ids(uuid, uuid[]) TO authenticated;

-- ─── resources_set_category_ids ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.resources_set_category_ids(
  p_resource_id  uuid,
  p_category_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM resources WHERE id = p_resource_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Resource not found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT is_tenant_member(v_tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member' USING ERRCODE = '42501';
  END IF;

  DELETE FROM resource_categories WHERE resource_id = p_resource_id;
  IF array_length(p_category_ids, 1) > 0 THEN
    INSERT INTO resource_categories(resource_id, category_id)
    SELECT p_resource_id, c FROM unnest(p_category_ids) AS c;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.resources_set_category_ids(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resources_set_category_ids(uuid, uuid[]) TO authenticated;

-- ─── schedule_templates_update ──────────────────────────────────────
-- Update template fields + replace slots in one transaction.

CREATE OR REPLACE FUNCTION public.schedule_templates_update(
  p_id                  uuid,
  p_name                text,
  p_type                text,
  p_cycle_length        int,
  p_reference_branch_id uuid,
  p_slots               jsonb       -- [{day_index, slot_time}]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM schedule_templates WHERE id = p_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Template not found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT is_tenant_member(v_tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member' USING ERRCODE = '42501';
  END IF;

  UPDATE schedule_templates
     SET name = p_name,
         type = p_type,
         cycle_length = p_cycle_length,
         reference_branch_id = p_reference_branch_id
   WHERE id = p_id;

  DELETE FROM schedule_template_slots WHERE template_id = p_id;

  IF p_slots IS NOT NULL AND jsonb_array_length(p_slots) > 0 THEN
    INSERT INTO schedule_template_slots(template_id, day_index, slot_time)
    SELECT p_id,
           (s->>'day_index')::int,
           (s->>'slot_time')::time
      FROM jsonb_array_elements(p_slots) AS s;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.schedule_templates_update(uuid, text, text, int, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.schedule_templates_update(uuid, text, text, int, uuid, jsonb) TO authenticated;

-- ─── apply_weekly_template_to_resource ──────────────────────────────
-- Replaces resource_schedules + resource_disabled_slots and pins
-- applied_template_id atomically.

CREATE OR REPLACE FUNCTION public.apply_weekly_template_to_resource(
  p_resource_id   uuid,
  p_template_id   uuid,
  p_schedule_rows jsonb,  -- [{day_of_week, is_working, open_time, close_time}]
  p_disabled_rows jsonb   -- [{day_of_week, slot_time}]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM resources WHERE id = p_resource_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Resource not found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT is_tenant_member(v_tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member' USING ERRCODE = '42501';
  END IF;

  DELETE FROM resource_schedules      WHERE resource_id = p_resource_id;
  DELETE FROM resource_disabled_slots WHERE resource_id = p_resource_id;

  IF p_schedule_rows IS NOT NULL AND jsonb_array_length(p_schedule_rows) > 0 THEN
    INSERT INTO resource_schedules(resource_id, day_of_week, is_working, open_time, close_time)
    SELECT p_resource_id,
           (r->>'day_of_week')::int,
           (r->>'is_working')::boolean,
           NULLIF(r->>'open_time', '')::time,
           NULLIF(r->>'close_time', '')::time
      FROM jsonb_array_elements(p_schedule_rows) AS r;
  END IF;

  IF p_disabled_rows IS NOT NULL AND jsonb_array_length(p_disabled_rows) > 0 THEN
    INSERT INTO resource_disabled_slots(resource_id, day_of_week, slot_time)
    SELECT p_resource_id,
           (r->>'day_of_week')::int,
           (r->>'slot_time')::time
      FROM jsonb_array_elements(p_disabled_rows) AS r;
  END IF;

  UPDATE resources
     SET applied_template_id = p_template_id,
         cycle_start_date = NULL
   WHERE id = p_resource_id;
END
$$;

REVOKE ALL ON FUNCTION public.apply_weekly_template_to_resource(uuid, uuid, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_weekly_template_to_resource(uuid, uuid, jsonb, jsonb) TO authenticated;

-- ─── apply_shift_template_to_resource ───────────────────────────────
-- Wipes materialized overrides + base weekly schedule and anchors the
-- resource to a shift template + cycle_start_date in one transaction.

CREATE OR REPLACE FUNCTION public.apply_shift_template_to_resource(
  p_resource_id     uuid,
  p_template_id     uuid,
  p_cycle_start_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM resources WHERE id = p_resource_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Resource not found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT is_tenant_member(v_tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member' USING ERRCODE = '42501';
  END IF;

  DELETE FROM resource_date_overrides       WHERE resource_id = p_resource_id;
  DELETE FROM resource_date_disabled_slots  WHERE resource_id = p_resource_id;
  DELETE FROM resource_schedules            WHERE resource_id = p_resource_id;
  DELETE FROM resource_disabled_slots       WHERE resource_id = p_resource_id;

  UPDATE resources
     SET applied_template_id = p_template_id,
         cycle_start_date    = p_cycle_start_date
   WHERE id = p_resource_id;
END
$$;

REVOKE ALL ON FUNCTION public.apply_shift_template_to_resource(uuid, uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_shift_template_to_resource(uuid, uuid, date) TO authenticated;
