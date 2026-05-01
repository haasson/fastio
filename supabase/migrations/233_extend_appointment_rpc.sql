-- =====================================================================================
-- Migration 233: extend_appointment RPC — атомарное продление с capacity-чеком
-- =====================================================================================
--
-- Проблема: appointmentsApi.extend() делал прямой UPDATE actual_ends_at без
-- overlap-проверки. Race condition: администратор продлевал open_ended запись,
-- а следующий клиент уже был забронирован — в результате два клиента в одном
-- кресле одновременно.
--
-- Фикс: advisory lock на resource + overlap-чек (с учётом capacity) внутри
-- одной транзакции. При конфликте — RAISE EXCEPTION P0002 с starts_at
-- следующей записи в ISO формате (фронт отформатирует в локальное время).
--
-- Попутно: добавляем booking_mode snapshot в appointments, чтобы фронт мог
-- показывать extend-кнопку только для open_ended записей без дополнительного
-- запроса к services.
-- =====================================================================================

-- ─── 1. booking_mode snapshot ────────────────────────────────────────────────────────

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS booking_mode text DEFAULT 'fixed';

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_booking_mode_check;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_booking_mode_check
  CHECK (booking_mode IN ('fixed', 'open_ended'));

-- Backfill: переносим режим из услуги для уже существующих записей.
-- NULL service_id (удалённая услуга) остаётся 'fixed' — дефолтное значение.
UPDATE appointments a
SET booking_mode = s.booking_mode
FROM services s
WHERE a.service_id = s.id
  AND s.booking_mode = 'open_ended'
  AND a.booking_mode IS DISTINCT FROM 'open_ended';


-- ─── 2. RPC extend_appointment ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.extend_appointment(
  p_id      uuid,
  p_minutes int
)
RETURNS appointments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec        appointments%ROWTYPE;
  v_new_end    timestamptz;
  v_capacity   int;
  v_overlap    int;
  v_next_at    timestamptz;
  v_lock_key   text;
BEGIN
  -- Первичная выборка для получения resource_id и tenant_id
  SELECT * INTO v_rec FROM appointments WHERE id = p_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Запись не найдена' USING ERRCODE = 'P0001';
  END IF;

  -- Проверяем права: только member тенанта или service_role
  IF auth.role() <> 'service_role' AND NOT is_tenant_member(v_rec.tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member' USING ERRCODE = 'P0001';
  END IF;

  IF v_rec.resource_id IS NULL THEN
    RAISE EXCEPTION 'Нельзя продлить запись без назначенного исполнителя'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_rec.status NOT IN ('new', 'confirmed') THEN
    RAISE EXCEPTION 'Нельзя продлить запись со статусом %', v_rec.status
      USING ERRCODE = 'P0001';
  END IF;

  -- Advisory lock на ресурс — исключаем параллельные продления/бронирования
  v_lock_key := 'appt:' || v_rec.resource_id::text;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));

  -- Перечитываем под локом — состояние могло измениться
  SELECT * INTO v_rec FROM appointments WHERE id = p_id AND deleted_at IS NULL;

  v_new_end := COALESCE(v_rec.actual_ends_at, v_rec.ends_at) + (p_minutes || ' minutes')::interval;

  -- Capacity ресурса
  SELECT capacity INTO v_capacity
  FROM resources
  WHERE id = v_rec.resource_id AND is_active = true AND deleted_at IS NULL;

  IF v_capacity IS NULL THEN
    RAISE EXCEPTION 'Исполнитель не найден или деактивирован' USING ERRCODE = 'P0001';
  END IF;

  -- Overlap-чек: сколько других не-отменённых записей пересекутся с окном продления?
  -- Проверяем только новый отрезок [old_end, v_new_end], а не весь [starts_at, v_new_end]:
  -- иначе для capacity>1 уже существующие параллельные записи в исходном окне
  -- ложно блокировали бы продление.
  SELECT COUNT(*) INTO v_overlap
  FROM appointments
  WHERE resource_id = v_rec.resource_id
    AND id <> p_id
    AND status NOT IN ('cancelled', 'done')
    AND deleted_at IS NULL
    AND starts_at < v_new_end
    AND COALESCE(actual_ends_at, ends_at) > COALESCE(v_rec.actual_ends_at, v_rec.ends_at);

  IF v_overlap >= v_capacity THEN
    -- Находим ближайшую следующую запись, чтобы показать юзеру конкретное время
    SELECT starts_at INTO v_next_at
    FROM appointments
    WHERE resource_id = v_rec.resource_id
      AND id <> p_id
      AND status NOT IN ('cancelled', 'done')
      AND deleted_at IS NULL
      AND starts_at >= COALESCE(v_rec.actual_ends_at, v_rec.ends_at)
    ORDER BY starts_at
    LIMIT 1;

    RAISE EXCEPTION 'OVERLAP:%',
      COALESCE(to_char(v_next_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), '')
      USING ERRCODE = 'P0002';
  END IF;

  -- Всё ок — обновляем
  UPDATE appointments
  SET actual_ends_at = v_new_end,
      updated_at     = now()
  WHERE id = p_id
  RETURNING * INTO v_rec;

  RETURN v_rec;
END;
$$;

COMMENT ON FUNCTION public.extend_appointment(uuid, int) IS
  'Продлевает open_ended запись на p_minutes минут с advisory lock + capacity-чеком. P0002 = overlap (message: OVERLAP:ISO_timestamp).';
