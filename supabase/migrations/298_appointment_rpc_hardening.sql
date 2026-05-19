-- Migration 298: appointment RPC hardening
--
-- 1. PREPROD-135: services.duration ограничен 1 ≤ duration ≤ 1440 минут.
--    Без проверки RPC create/update_appointment пропускал слоты вроде ends_at-starts_at
--    = 3 дня, ломая планировщик кухни / таймлайн / capacity-логику. Constraint —
--    дёшево, идемпотентно, ловит и админский UI, и сторфронтные броньки.
--
-- 2. PREPROD-143: cancel_appointment_by_customer RPC. Storefront ранее делал прямой
--    UPDATE через service_role клиент, без записи в appointment_events → менеджер
--    в админке не видел «отменено клиентом», audit-trail терялся. RPC берёт row-lock,
--    проверяет ownership и allow_cancel_snapshot, ставит status='cancelled' +
--    cancelled_by='customer' + cancelled_at=now() и пишет событие в appointment_events
--    с actor_role='customer'. Возвращает envelope {ok: bool, reason?: text}.

-- ─── 1. CHECK constraint на services.duration ─────────────────────────────────────

-- Defensive cleanup перед constraint: legacy-данные могут содержать duration=0
-- (миграция 184 ставит default 0) или test-сидов с очень большими значениями.
-- Без clamp'а ADD CONSTRAINT упадёт на проверке существующих строк и сделает
-- ROLLBACK всей миграции. Clamp в безопасный диапазон сохраняет работоспособность.
UPDATE services SET duration = 1 WHERE duration <= 0;
UPDATE services SET duration = 1440 WHERE duration > 1440;

ALTER TABLE services DROP CONSTRAINT IF EXISTS services_duration_range_check;
ALTER TABLE services
  ADD CONSTRAINT services_duration_range_check
  CHECK (duration > 0 AND duration <= 1440);

-- ─── 2. RPC cancel_appointment_by_customer ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cancel_appointment_by_customer(
  p_appointment_id uuid,
  p_customer_id    uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_appt          appointments%ROWTYPE;
  v_allow_setting boolean;
  v_allow_cancel  boolean;
BEGIN
  IF p_appointment_id IS NULL OR p_customer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_args');
  END IF;

  -- Row-lock: сериализуем concurrent попытки отмены/обновления записи.
  SELECT * INTO v_appt
    FROM appointments
   WHERE id = p_appointment_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- Ownership: клиент может отменить только свою запись.
  IF v_appt.customer_id IS DISTINCT FROM p_customer_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF v_appt.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_cancelled');
  END IF;

  IF v_appt.status = 'done' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_done');
  END IF;

  -- allow_cancel_snapshot (момент бронирования) > текущая настройка тенанта.
  -- Если snapshot null — fallback на actual setting; если и его нет — default true.
  IF v_appt.allow_cancel_snapshot IS NOT NULL THEN
    v_allow_cancel := v_appt.allow_cancel_snapshot;
  ELSE
    SELECT allow_client_cancellation INTO v_allow_setting
      FROM appointment_settings
     WHERE tenant_id = v_appt.tenant_id;
    v_allow_cancel := COALESCE(v_allow_setting, true);
  END IF;

  IF NOT v_allow_cancel THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cancel_disabled');
  END IF;

  UPDATE appointments
     SET status       = 'cancelled',
         cancelled_by = 'customer',
         cancelled_at = now()
   WHERE id = p_appointment_id;

  -- Audit event. actor_id = customer.id (НЕ auth.users.id), потому что
  -- Telegram-only клиенты живут без auth-user. Колонка actor_id у нас FK на
  -- auth.users → пишем NULL и кладём customer_id в meta для трассируемости.
  INSERT INTO appointment_events (
    appointment_id, tenant_id, actor_id, actor_role, event_type, meta
  ) VALUES (
    p_appointment_id,
    v_appt.tenant_id,
    NULL,
    'customer',
    'appointment_cancelled',
    jsonb_build_object('source', 'customer', 'customer_id', p_customer_id)
  );

  RETURN jsonb_build_object('ok', true, 'id', p_appointment_id);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_appointment_by_customer(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_appointment_by_customer(uuid, uuid) TO service_role;
