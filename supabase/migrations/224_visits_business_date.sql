-- =====================================================================================
-- Migration 224: appointment_groups → визиты с инвариантом «один бизнес-день»
-- =====================================================================================
--
-- Концепция: группа становится «визитом» — посещением клиента в один бизнес-день.
-- Все appointments визита обязаны принадлежать одному business_date (это
-- календарная дата открытия рабочего дня; учитывает overnight-смены, например
-- 18:00–04:00 → запись на 02:00 принадлежит «вчерашнему» бизнес-дню).
--
-- Подтверждение/отмена услуги больше НЕ выкидывает её из визита — визит живёт
-- независимо от статусов внутри. Триггер «выхода из коробки» из 222/223 удаляется.
--
-- Что меняется:
--   1. Создаём compute_business_date(branch, tenant, ts) — порт isOpenNow на SQL
--   2. Откатываем триггер 223 + FK SET NULL (вернём RESTRICT через group_id NOT NULL)
--   3. Бэкфилл standalone-appointments → создаём для них визиты
--      (группируем по tenant+branch+phone+business_date чтобы склеить «осколки»
--      одного визита, которые рассыпались после старого confirm-триггера 222/223)
--   4. Расщепляем существующие группы со смешанными business_date — каждой
--      «лишней» дате отдаём свой визит
--   5. Добавляем business_date NOT NULL + merged_into_id (для будущего merge)
--   6. appointments.group_id → NOT NULL, FK ON DELETE RESTRICT
--   7. Триггер инварианта «business_date appointment ≡ business_date визита»
--   8. Обновляем create_appointments_bulk и add_appointment_to_group:
--      bulk вычисляет business_date по items, add — проверяет совпадение
--   9. Чистим обсолетный индекс appointments_group_new_idx (статус new больше
--      не определяет вхождение в визит)
-- =====================================================================================


-- ─── 1. compute_business_date ───────────────────────────────────────────────────────
--
-- Возвращает календарную дату «бизнес-дня» для starts_at.
-- Логика повторяет shared/utils/workingHours.ts → isOpenNow:
--   - allDay (24/7) или нет расписания → календарная дата как есть
--   - предыдущий день overnight (close < open, не dayOff) и local_time <
--     close_of_prev_day → bizdate = local_date - 1
--   - иначе → bizdate = local_date

CREATE OR REPLACE FUNCTION public.compute_business_date(
  p_branch_id  uuid,
  p_tenant_id  uuid,
  p_starts_at  timestamptz
) RETURNS date
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tz            text;
  v_schedule      jsonb;
  v_default       jsonb;
  v_local_ts      timestamp;
  v_local_date    date;
  v_local_min     int;
  v_iso_dow       int;
  v_prev_iso      int;
  v_prev_day      jsonb;
  v_open_min      int;
  v_close_min     int;
BEGIN
  SELECT timezone INTO v_tz FROM tenants WHERE id = p_tenant_id;
  IF v_tz IS NULL THEN v_tz := 'Europe/Moscow'; END IF;

  IF p_branch_id IS NOT NULL THEN
    SELECT working_hours_schedule INTO v_schedule FROM branches WHERE id = p_branch_id;
  END IF;
  IF v_schedule IS NULL THEN
    SELECT working_hours_schedule INTO v_schedule FROM tenants WHERE id = p_tenant_id;
  END IF;

  v_local_ts   := (p_starts_at AT TIME ZONE v_tz);
  v_local_date := v_local_ts::date;
  v_local_min  := EXTRACT(HOUR   FROM v_local_ts)::int * 60
                + EXTRACT(MINUTE FROM v_local_ts)::int;

  IF v_schedule IS NULL THEN
    RETURN v_local_date;
  END IF;

  v_default := v_schedule -> 'default';
  IF COALESCE((v_default ->> 'allDay')::boolean, FALSE) THEN
    RETURN v_local_date;
  END IF;

  v_iso_dow  := EXTRACT(ISODOW FROM v_local_date)::int;
  v_prev_iso := CASE WHEN v_iso_dow = 1 THEN 7 ELSE v_iso_dow - 1 END;
  v_prev_day := COALESCE(v_schedule -> 'days' -> v_prev_iso::text, v_default);

  IF COALESCE((v_prev_day ->> 'dayOff')::boolean, FALSE) THEN
    RETURN v_local_date;
  END IF;

  v_open_min  := (split_part(v_prev_day ->> 'open',  ':', 1))::int * 60
               + (split_part(v_prev_day ->> 'open',  ':', 2))::int;
  v_close_min := (split_part(v_prev_day ->> 'close', ':', 1))::int * 60
               + (split_part(v_prev_day ->> 'close', ':', 2))::int;

  -- Overnight: close раньше open. close == open без allDay — degenerate, не overnight.
  IF v_close_min < v_open_min AND v_local_min < v_close_min THEN
    RETURN v_local_date - 1;
  END IF;

  RETURN v_local_date;
END;
$$;


-- ─── 2. Откат триггеров «выхода из коробки» (222/223) ───────────────────────────────

DROP TRIGGER IF EXISTS trg_appointments_exit_group ON appointments;
DROP FUNCTION IF EXISTS exit_appointment_group_after();
DROP TRIGGER IF EXISTS trg_appointments_leave_group ON appointments;        -- на всякий случай (222 BEFORE-вариант)
DROP FUNCTION IF EXISTS leave_appointment_group_on_status_change();


-- ─── 3. Колонки visits (пока nullable — заполним и сделаем NOT NULL) ───────────────

ALTER TABLE appointment_groups
  ADD COLUMN IF NOT EXISTS business_date  date,
  ADD COLUMN IF NOT EXISTS merged_into_id uuid;

ALTER TABLE appointment_groups
  DROP CONSTRAINT IF EXISTS appointment_groups_merged_into_fkey;
ALTER TABLE appointment_groups
  ADD CONSTRAINT appointment_groups_merged_into_fkey
  FOREIGN KEY (merged_into_id) REFERENCES appointment_groups(id) ON DELETE SET NULL;


-- ─── 4. Бэкфилл standalone → новые визиты ──────────────────────────────────────────
--
-- Группируем стандалоны по (tenant, branch, customer_key, business_date), где
-- customer_key = COALESCE(customer_id, customer_phone, 'anon'). customer_id
-- приоритетен — телефон может меняться (особенно с Telegram-логином), а у двух
-- разных клиентов может оказаться один и тот же телефон (склейка/ошибка ввода).

DO $$
DECLARE
  v_row record;
  v_group_id uuid;
BEGIN
  FOR v_row IN
    SELECT
      a.tenant_id,
      a.branch_id,
      COALESCE(a.customer_id::text, a.customer_phone, 'anon') AS customer_key,
      compute_business_date(a.branch_id, a.tenant_id, a.starts_at) AS bdate,
      MIN(a.customer_id::text)::uuid AS customer_id,
      MIN(a.customer_phone)        AS customer_phone,
      MIN(a.customer_name)         AS customer_name,
      MIN(a.notes)                 AS notes,
      MIN(a.created_at)            AS created_at,
      array_agg(a.id)              AS appointment_ids
    FROM appointments a
    WHERE a.group_id IS NULL
    GROUP BY a.tenant_id, a.branch_id,
             COALESCE(a.customer_id::text, a.customer_phone, 'anon'),
             compute_business_date(a.branch_id, a.tenant_id, a.starts_at)
  LOOP
    INSERT INTO appointment_groups (
      tenant_id, branch_id, customer_id,
      customer_name, customer_phone, customer_email,
      notes, source, business_date, created_at
    ) VALUES (
      v_row.tenant_id, v_row.branch_id, v_row.customer_id,
      v_row.customer_name, v_row.customer_phone, NULL,
      v_row.notes, 'admin', v_row.bdate, v_row.created_at
    )
    RETURNING id INTO v_group_id;

    UPDATE appointments SET group_id = v_group_id WHERE id = ANY(v_row.appointment_ids);
  END LOOP;
END $$;


-- ─── 5. Расщепление существующих визитов со смешанными business_date ───────────────
--
-- Для каждого «лишнего» business_date в группе создаём отдельный визит и
-- переносим в него appointments этой даты. Один (любой) business_date остаётся
-- в исходной группе.

DO $$
DECLARE
  v_grp record;
  v_extra record;
  v_new_id uuid;
BEGIN
  FOR v_grp IN
    SELECT
      ag.id AS group_id,
      ag.tenant_id,
      ag.branch_id,
      ag.customer_id,
      ag.customer_name,
      ag.customer_phone,
      ag.customer_email,
      ag.notes,
      ag.source,
      ag.request_id,
      ag.created_at,
      (
        SELECT compute_business_date(a.branch_id, a.tenant_id, a.starts_at)
        FROM appointments a
        WHERE a.group_id = ag.id
        ORDER BY a.starts_at
        LIMIT 1
      ) AS keep_date
    FROM appointment_groups ag
    WHERE EXISTS (
      SELECT 1
      FROM appointments a
      WHERE a.group_id = ag.id
      GROUP BY a.group_id
      HAVING COUNT(DISTINCT compute_business_date(a.branch_id, a.tenant_id, a.starts_at)) > 1
    )
  LOOP
    FOR v_extra IN
      SELECT DISTINCT compute_business_date(a.branch_id, a.tenant_id, a.starts_at) AS bdate
      FROM appointments a
      WHERE a.group_id = v_grp.group_id
        AND compute_business_date(a.branch_id, a.tenant_id, a.starts_at) <> v_grp.keep_date
    LOOP
      INSERT INTO appointment_groups (
        tenant_id, branch_id, customer_id,
        customer_name, customer_phone, customer_email,
        notes, source, request_id, business_date, created_at
      ) VALUES (
        v_grp.tenant_id, v_grp.branch_id, v_grp.customer_id,
        v_grp.customer_name, v_grp.customer_phone, v_grp.customer_email,
        v_grp.notes, v_grp.source, v_grp.request_id, v_extra.bdate, v_grp.created_at
      )
      RETURNING id INTO v_new_id;

      UPDATE appointments
      SET group_id = v_new_id
      WHERE group_id = v_grp.group_id
        AND compute_business_date(branch_id, tenant_id, starts_at) = v_extra.bdate;
    END LOOP;
  END LOOP;
END $$;


-- ─── 6. Бэкфилл business_date для всех групп + NOT NULL ────────────────────────────

UPDATE appointment_groups ag
SET business_date = sub.bdate
FROM (
  SELECT DISTINCT ON (a.group_id)
    a.group_id,
    compute_business_date(a.branch_id, a.tenant_id, a.starts_at) AS bdate
  FROM appointments a
  WHERE a.group_id IS NOT NULL
  ORDER BY a.group_id, a.starts_at
) sub
WHERE ag.id = sub.group_id
  AND ag.business_date IS NULL;

-- Зомби-визиты без appointments (могли остаться после старого confirm-триггера 222/223,
-- который удалял все услуги из группы) — удаляем, а не проставляем фолбэк-дату.
DELETE FROM appointment_groups
WHERE id NOT IN (
  SELECT DISTINCT group_id FROM appointments WHERE group_id IS NOT NULL
);

ALTER TABLE appointment_groups ALTER COLUMN business_date SET NOT NULL;


-- ─── 7. appointments.group_id → NOT NULL + FK RESTRICT ─────────────────────────────

ALTER TABLE appointments ALTER COLUMN group_id SET NOT NULL;

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_group_id_fkey;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES appointment_groups(id) ON DELETE RESTRICT;


-- ─── 8. Триггер инварианта «один бизнес-день в визите» ─────────────────────────────

CREATE OR REPLACE FUNCTION enforce_visit_business_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_visit_bdate date;
  v_appt_bdate  date;
BEGIN
  SELECT business_date INTO v_visit_bdate
  FROM appointment_groups
  WHERE id = NEW.group_id;

  IF v_visit_bdate IS NULL THEN
    RAISE EXCEPTION 'Визит % не найден', NEW.group_id USING ERRCODE = 'P0001';
  END IF;

  v_appt_bdate := compute_business_date(NEW.branch_id, NEW.tenant_id, NEW.starts_at);

  IF v_appt_bdate <> v_visit_bdate THEN
    RAISE EXCEPTION
      'Запись (business_date=%) не попадает в бизнес-день визита (business_date=%)',
      v_appt_bdate, v_visit_bdate
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_enforce_visit_bdate ON appointments;
CREATE TRIGGER trg_appointments_enforce_visit_bdate
  BEFORE INSERT OR UPDATE OF starts_at, branch_id, group_id ON appointments
  FOR EACH ROW EXECUTE FUNCTION enforce_visit_business_date();


-- ─── 9. Чистим обсолетный индекс из 222 ────────────────────────────────────────────

DROP INDEX IF EXISTS appointments_group_new_idx;

-- Индекс по merged_into_id для быстрого фильтра «не объединённые» в инбоксе
CREATE INDEX IF NOT EXISTS appointment_groups_merged_into_idx
  ON appointment_groups (merged_into_id) WHERE merged_into_id IS NOT NULL;

-- Индекс по business_date для фильтра «сегодня/неделя» в инбоксе
CREATE INDEX IF NOT EXISTS appointment_groups_tenant_bdate_idx
  ON appointment_groups (tenant_id, business_date);


-- ─── 10. create_appointments_bulk: вычисляем business_date по items ────────────────
--
-- Изменения относительно версии 222:
--   - Перед INSERT в группу вычисляем business_date по первому item
--   - Проверяем что все items дают тот же business_date (иначе RAISE)
--   - INSERT в appointment_groups теперь с business_date
--   - Триггер инварианта на appointments сработает на каждый INSERT и валидирует
--     соответствие; нам остаётся только pre-validate ради нормального текста ошибки

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
  v_business_date date;
  v_item_bdate    date;
BEGIN
  IF p_source NOT IN ('storefront', 'admin', 'request') THEN
    RAISE EXCEPTION 'create_appointments_bulk: p_source must be ''storefront'', ''admin'' or ''request'''
      USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'create_appointments_bulk: items must be non-empty' USING ERRCODE = 'P0001';
  END IF;

  -- Фаза 1: собираем lock-ключи + проверяем единый business_date
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_resource_id := NULLIF(v_item->>'resource_id', '')::uuid;
    v_service_id  := (v_item->>'service_id')::uuid;
    v_starts_at   := (v_item->>'starts_at')::timestamptz;

    IF v_resource_id IS NULL AND p_branch_id IS NULL THEN
      RAISE EXCEPTION 'create_appointments_bulk: item requires resource_id or p_branch_id must be set'
        USING ERRCODE = 'P0001';
    END IF;

    v_item_bdate := compute_business_date(p_branch_id, p_tenant_id, v_starts_at);
    IF v_business_date IS NULL THEN
      v_business_date := v_item_bdate;
    ELSIF v_business_date <> v_item_bdate THEN
      RAISE EXCEPTION 'create_appointments_bulk: все услуги визита должны быть в одном бизнес-дне (получены % и %)',
        v_business_date, v_item_bdate
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

  -- Фаза 2: создаём визит с business_date
  INSERT INTO appointment_groups (
    tenant_id, branch_id, customer_id,
    customer_name, customer_phone, customer_email,
    notes, source, business_date
  ) VALUES (
    p_tenant_id, p_branch_id, p_customer_id,
    p_customer_name, p_customer_phone, p_customer_email,
    p_notes, p_source, v_business_date
  ) RETURNING id INTO v_group_id;

  -- Фаза 3: вставляем appointments
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


-- ─── 11. add_appointment_to_group: триггер инварианта валидирует за нас ────────────
--
-- Логика без изменений (capacity-чек + advisory lock + INSERT). Соответствие
-- business_date обеспечит триггер enforce_visit_business_date — даст человеческую
-- ошибку «не попадает в бизнес-день визита» с ERRCODE P0001.
-- Версия из 222 актуальна, оставляем как есть.
