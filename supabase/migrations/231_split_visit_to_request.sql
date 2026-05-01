-- =====================================================================================
-- Migration 231: RPC split_visit_to_request
-- =====================================================================================
--
-- Разделение визита: выбранные услуги уезжают в новую заявку (request-визит)
-- того же клиента и того же филиала. Дату/слоты в новой заявке менеджер
-- выберет позже на её странице.
--
-- Что делает:
--   1. Берёт исходный visit + указанные appointment_ids.
--   2. Создаёт новый appointment_groups со status='request', копирует customer_*,
--      branch, source='admin'. requested_services собирается из выбранных
--      appointments (имя, цена, длительность из существующих, preferredResourceId
--      = текущий мастер).
--   3. Отменяет выбранные appointments в исходном визите (status='cancelled' с
--      причиной "разделено в новую заявку"). НЕ переносит их в новый визит как
--      appointments — там их пока нет, есть только requested_services.
--   4. Возвращает id нового визита.
--
-- Если все услуги выбраны → исходный визит остаётся пустым (все appointments
-- cancelled). Менеджер может его сам отменить.
-- =====================================================================================

CREATE OR REPLACE FUNCTION public.split_visit_to_request(
  p_visit_id        uuid,
  p_appointment_ids uuid[],
  p_user_id         uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_visit            appointment_groups%ROWTYPE;
  v_new_visit_id     uuid;
  v_requested_services jsonb;
  v_count            int;
BEGIN
  IF p_appointment_ids IS NULL OR array_length(p_appointment_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'split_visit_to_request: p_appointment_ids must be non-empty'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_visit FROM appointment_groups WHERE id = p_visit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Visit not found' USING ERRCODE = 'P0001';
  END IF;
  IF v_visit.status <> 'active' THEN
    RAISE EXCEPTION 'Visit must be active to split (status=%)', v_visit.status
      USING ERRCODE = 'P0001';
  END IF;
  IF auth.role() <> 'service_role' AND NOT is_tenant_member(v_visit.tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member' USING ERRCODE = 'P0001';
  END IF;

  -- Проверяем, что все указанные appointments принадлежат этому визиту.
  SELECT COUNT(*) INTO v_count
  FROM appointments
  WHERE id = ANY(p_appointment_ids)
    AND group_id = p_visit_id
    AND status NOT IN ('cancelled', 'done');
  IF v_count <> array_length(p_appointment_ids, 1) THEN
    RAISE EXCEPTION 'split_visit_to_request: some appointments do not belong to visit or are closed'
      USING ERRCODE = 'P0001';
  END IF;

  -- Собираем requested_services из выбранных appointments. preferred_resource_id =
  -- текущий resource_id (если был задан клиентом или менеджером — переносим).
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'service_id',            a.service_id,
    'service_name',          a.service_name,
    'preferred_resource_id', a.resource_id,
    'duration_minutes',      EXTRACT(EPOCH FROM (a.ends_at - a.starts_at))::int / 60,
    'price',                 a.service_price
  ) ORDER BY a.starts_at), '[]'::jsonb)
  INTO v_requested_services
  FROM appointments a
  WHERE a.id = ANY(p_appointment_ids);

  -- Создаём новый request-визит.
  INSERT INTO appointment_groups (
    tenant_id, branch_id, customer_id,
    customer_name, customer_phone, customer_email,
    notes, source, business_date,
    status, requested_services
  ) VALUES (
    v_visit.tenant_id, v_visit.branch_id, v_visit.customer_id,
    v_visit.customer_name, v_visit.customer_phone, v_visit.customer_email,
    v_visit.notes, 'admin', NULL,
    'request', v_requested_services
  )
  RETURNING id INTO v_new_visit_id;

  -- Отменяем перенесённые услуги в исходном визите.
  UPDATE appointments
  SET status        = 'cancelled',
      cancelled_at  = now(),
      cancelled_by  = 'admin',
      cancel_reason = 'Перенесено в заявку ' || v_new_visit_id::text
  WHERE id = ANY(p_appointment_ids);

  RETURN jsonb_build_object(
    'new_visit_id', v_new_visit_id,
    'moved_count',  array_length(p_appointment_ids, 1)
  );
END
$$;

REVOKE ALL ON FUNCTION public.split_visit_to_request(uuid, uuid[], uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.split_visit_to_request(uuid, uuid[], uuid) TO service_role;
