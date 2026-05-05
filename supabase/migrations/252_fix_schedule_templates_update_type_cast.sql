-- Migration 252: fix schedule_templates_update — cast p_type text → schedule_template_type.
--
-- Без каста Postgres отказывает с ошибкой 42804 при UPDATE schedule_templates.type = p_type,
-- так как колонка имеет тип schedule_template_type (enum), а параметр — text.

CREATE OR REPLACE FUNCTION public.schedule_templates_update(
  p_id                  uuid,
  p_name                text,
  p_type                text,
  p_cycle_length        int,
  p_reference_branch_id uuid,
  p_days                jsonb
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
     SET name                = p_name,
         type                = p_type::schedule_template_type,
         cycle_length        = p_cycle_length,
         reference_branch_id = p_reference_branch_id
   WHERE id = p_id;

  DELETE FROM schedule_template_days WHERE template_id = p_id;

  IF p_days IS NOT NULL AND jsonb_array_length(p_days) > 0 THEN
    INSERT INTO schedule_template_days(template_id, day_index, is_working, open_time, close_time)
    SELECT p_id,
           (d->>'day_index')::int,
           COALESCE((d->>'is_working')::boolean, true),
           NULLIF(d->>'open_time', '')::time,
           NULLIF(d->>'close_time', '')::time
      FROM jsonb_array_elements(p_days) AS d;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.schedule_templates_update(uuid, text, text, int, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.schedule_templates_update(uuid, text, text, int, uuid, jsonb) TO authenticated;
