-- =====================================================================================
-- Migration 218: appointment_groups + appointment_requests
-- =====================================================================================
--
-- 1. appointment_groups  — объединяет appointments одного booking-акта в одну «сделку».
-- 2. appointment_requests — заявки на запись: клиент без выбора времени,
--    менеджер перезванивает и оформляет.
-- 3. appointments.group_id NOT NULL — каждая запись принадлежит группе.
-- 4. Backfill: каждой существующей appointment создаётся отдельная группа.
-- 5. Триггер recalc_appointment_group_aggregates — пересчёт status/total_* группы.
-- 6. create_appointments_bulk — новый контракт: создаёт группу, возвращает jsonb.
--
-- ⚠️  BREAKING CHANGE — create_appointments_bulk сигнатура изменена:
--     Старая (11 param, из 217):
--       (uuid×4, text×2, appointment_status, text, bool×2, jsonb)
--       → RETURNS TABLE(id uuid, service_id uuid, starts_at timestamptz, ends_at timestamptz)
--     Новая (13 param):
--       (uuid×4, text×3, appointment_status, text×2, bool×2, jsonb)
--       Добавлены: p_customer_email text (позиция 7), p_source text (позиция 12)
--       → RETURNS jsonb { group_id: uuid, appointments: [{id, service_id, starts_at, ends_at}] }
--     Клиенты storefront и admin ОБЯЗАНЫ обновить вызов до применения этой миграции.
-- =====================================================================================


-- ─── 1. appointment_groups ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS appointment_groups (
  id                     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id              uuid         REFERENCES branches(id) ON DELETE SET NULL,
  customer_id            uuid         REFERENCES customers(id) ON DELETE SET NULL,
  customer_name          text         NOT NULL,
  customer_phone         text         NOT NULL,
  customer_email         text,
  notes                  text,
  status                 text         NOT NULL DEFAULT 'new',
  total_price            numeric(12,2),
  total_duration_minutes integer,
  source                 text         NOT NULL DEFAULT 'storefront',
  request_id             uuid,        -- FK to appointment_requests добавляется ниже
  created_at             timestamptz  NOT NULL DEFAULT now(),
  updated_at             timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT appointment_groups_status_check CHECK (
    status IN ('new', 'confirmed', 'partially_cancelled', 'cancelled', 'done')
  ),
  CONSTRAINT appointment_groups_source_check CHECK (
    source IN ('storefront', 'admin', 'request')
  )
);

CREATE INDEX IF NOT EXISTS appointment_groups_tenant_created_idx
  ON appointment_groups(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS appointment_groups_tenant_status_idx
  ON appointment_groups(tenant_id, status)
  WHERE status IN ('new', 'confirmed');

CREATE INDEX IF NOT EXISTS appointment_groups_customer_idx
  ON appointment_groups(customer_id)
  WHERE customer_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_appointment_groups_updated_at ON appointment_groups;
CREATE TRIGGER trg_appointment_groups_updated_at
  BEFORE UPDATE ON appointment_groups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── 2. appointments.group_id (nullable сначала, NOT NULL после backfill) ────────────

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES appointment_groups(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS appointments_group_idx ON appointments(group_id);


-- ─── 3. Backfill: одна группа на каждую существующую appointment ──────────────────────
--    source = 'admin' — легаси записи считаются оформленными администратором.
--    customer_email отсутствует в appointments (дропнут в 213), поэтому не копируется.

DO $$
DECLARE
  rec          RECORD;
  new_group_id uuid;
BEGIN
  FOR rec IN
    SELECT id,
           tenant_id, branch_id, customer_id,
           customer_name, customer_phone,
           notes, status,
           created_at, updated_at
    FROM appointments
    WHERE group_id IS NULL
  LOOP
    INSERT INTO appointment_groups (
      tenant_id, branch_id, customer_id,
      customer_name, customer_phone,
      notes, status, source,
      created_at, updated_at
    ) VALUES (
      rec.tenant_id, rec.branch_id, rec.customer_id,
      COALESCE(rec.customer_name, ''),
      COALESCE(rec.customer_phone, ''),
      rec.notes,
      CASE
        WHEN rec.status = 'confirmed' THEN 'confirmed'
        WHEN rec.status = 'cancelled' THEN 'cancelled'
        WHEN rec.status = 'done'      THEN 'done'
        ELSE                               'new'
      END,
      'admin',
      rec.created_at,
      rec.updated_at
    ) RETURNING id INTO new_group_id;

    UPDATE appointments SET group_id = new_group_id WHERE id = rec.id;
  END LOOP;
END $$;

-- Заполняем totals для backfill-групп (триггер ещё не создан, поэтому вручную)
UPDATE appointment_groups ag
SET
  total_price = (
    SELECT COALESCE(SUM(a.service_price), 0)
    FROM appointments a
    WHERE a.group_id = ag.id AND a.status <> 'cancelled'
  ),
  total_duration_minutes = (
    SELECT COALESCE(
      SUM(EXTRACT(EPOCH FROM (a.ends_at - a.starts_at))::integer / 60),
      0
    )
    FROM appointments a
    WHERE a.group_id = ag.id AND a.status <> 'cancelled'
  )
WHERE ag.total_price IS NULL;

-- После backfill — group_id NOT NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'appointments'
      AND column_name  = 'group_id'
      AND is_nullable  = 'YES'
  ) THEN
    ALTER TABLE appointments ALTER COLUMN group_id SET NOT NULL;
  END IF;
END $$;


-- ─── 4. appointment_requests ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS appointment_requests (
  id                 uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id          uuid         REFERENCES branches(id) ON DELETE SET NULL,
  customer_id        uuid         REFERENCES customers(id) ON DELETE SET NULL,
  customer_name      text         NOT NULL,
  customer_phone     text         NOT NULL,
  customer_email     text,
  notes              text,
  services           jsonb        NOT NULL DEFAULT '[]'::jsonb,
  -- структура элементов services:
  -- [{ "service_id": "uuid", "service_name": "string",
  --    "preferred_resource_id": "uuid|null",
  --    "duration_minutes": int, "price": number }]
  status             text         NOT NULL DEFAULT 'new',
  converted_group_id uuid         REFERENCES appointment_groups(id) ON DELETE SET NULL,
  processed_by       uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at       timestamptz,
  created_at         timestamptz  NOT NULL DEFAULT now(),
  updated_at         timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT appointment_requests_status_check CHECK (
    status IN ('new', 'in_progress', 'converted', 'declined')
  ),
  CONSTRAINT appointment_requests_services_not_empty CHECK (
    jsonb_array_length(services) > 0
  )
);

CREATE INDEX IF NOT EXISTS appointment_requests_tenant_created_idx
  ON appointment_requests(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS appointment_requests_tenant_status_idx
  ON appointment_requests(tenant_id, status)
  WHERE status IN ('new', 'in_progress');

DROP TRIGGER IF EXISTS trg_appointment_requests_updated_at ON appointment_requests;
CREATE TRIGGER trg_appointment_requests_updated_at
  BEFORE UPDATE ON appointment_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── 5. FK appointment_groups.request_id → appointment_requests ──────────────────────
--    Добавляем после создания appointment_requests (circular dependency обходим порядком)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema    = 'public'
      AND table_name      = 'appointment_groups'
      AND constraint_name = 'appointment_groups_request_id_fkey'
  ) THEN
    ALTER TABLE appointment_groups
      ADD CONSTRAINT appointment_groups_request_id_fkey
      FOREIGN KEY (request_id)
      REFERENCES appointment_requests(id)
      ON DELETE SET NULL;
  END IF;
END $$;


-- ─── 6. Триггер: recalc_appointment_group_aggregates ─────────────────────────────────
--
-- Пересчитывает status / total_price / total_duration_minutes группы при любом
-- изменении appointments (INSERT, UPDATE, DELETE).
--
-- Логика статуса:
--   - все cancelled (или 0 строк)              → 'cancelled'
--   - все не-cancelled done                    → 'done'
--   - есть cancelled, остальные не все done    → 'partially_cancelled'
--   - все не-cancelled confirmed               → 'confirmed'
--   - иначе                                   → 'new'

CREATE OR REPLACE FUNCTION recalc_appointment_group_aggregates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_group_ids     uuid[];
  v_gid           uuid;
  v_total         int;
  v_cancelled     int;
  v_done          int;
  v_confirmed     int;
  v_non_cancelled int;
  v_new_status    text;
  v_price         numeric;
  v_duration      int;
BEGIN
  v_group_ids := ARRAY[]::uuid[];

  IF TG_OP = 'DELETE' THEN
    IF OLD.group_id IS NOT NULL THEN
      v_group_ids := ARRAY[OLD.group_id];
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.group_id IS NOT NULL THEN
      v_group_ids := ARRAY[NEW.group_id];
    END IF;
  ELSE -- UPDATE
    IF OLD.group_id IS NOT NULL THEN
      v_group_ids := array_append(v_group_ids, OLD.group_id);
    END IF;
    -- добавляем NEW.group_id только если отличается от OLD (смена группы)
    IF NEW.group_id IS NOT NULL AND
       (OLD.group_id IS NULL OR NEW.group_id <> OLD.group_id) THEN
      v_group_ids := array_append(v_group_ids, NEW.group_id);
    END IF;
  END IF;

  FOREACH v_gid IN ARRAY v_group_ids LOOP
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE a.status = 'cancelled'),
      COUNT(*) FILTER (WHERE a.status = 'done'),
      COUNT(*) FILTER (WHERE a.status = 'confirmed')
    INTO v_total, v_cancelled, v_done, v_confirmed
    FROM appointments a
    WHERE a.group_id = v_gid;

    SELECT
      COALESCE(SUM(a.service_price), 0),
      COALESCE(SUM(
        EXTRACT(EPOCH FROM (a.ends_at - a.starts_at))::integer / 60
      ), 0)
    INTO v_price, v_duration
    FROM appointments a
    WHERE a.group_id = v_gid AND a.status <> 'cancelled';

    v_non_cancelled := v_total - v_cancelled;

    IF v_total = 0 OR v_non_cancelled = 0 THEN
      v_new_status := 'cancelled';
    ELSIF v_non_cancelled = v_done THEN
      v_new_status := 'done';
    ELSIF v_cancelled > 0 THEN
      v_new_status := 'partially_cancelled';
    ELSIF v_non_cancelled = v_confirmed THEN
      v_new_status := 'confirmed';
    ELSE
      v_new_status := 'new';
    END IF;

    UPDATE appointment_groups
    SET
      status                 = v_new_status,
      total_price            = v_price,
      total_duration_minutes = v_duration,
      updated_at             = now()
    WHERE id = v_gid;
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_recalc_group ON appointments;
CREATE TRIGGER trg_appointments_recalc_group
  AFTER INSERT OR UPDATE OR DELETE ON appointments
  FOR EACH ROW EXECUTE FUNCTION recalc_appointment_group_aggregates();


-- ─── 7. RLS: appointment_groups ──────────────────────────────────────────────────────

ALTER TABLE appointment_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointment_groups_tenant_member"   ON appointment_groups;
DROP POLICY IF EXISTS "appointment_groups_customer_select" ON appointment_groups;
DROP POLICY IF EXISTS "appointment_groups_service_role"    ON appointment_groups;

-- Члены тенанта: полный CRUD
CREATE POLICY "appointment_groups_tenant_member"
  ON appointment_groups FOR ALL
  USING (is_tenant_member(tenant_id));

-- Авторизованный клиент: SELECT своих групп (для будущего ЛК)
CREATE POLICY "appointment_groups_customer_select"
  ON appointment_groups FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE auth_user_id = auth.uid()
    )
  );

-- Service role: полный доступ
CREATE POLICY "appointment_groups_service_role"
  ON appointment_groups FOR ALL
  USING (auth.role() = 'service_role');


-- ─── 8. RLS: appointment_requests ────────────────────────────────────────────────────

ALTER TABLE appointment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointment_requests_tenant_member" ON appointment_requests;
DROP POLICY IF EXISTS "appointment_requests_anon_insert"   ON appointment_requests;
DROP POLICY IF EXISTS "appointment_requests_service_role"  ON appointment_requests;

-- Члены тенанта: полный CRUD
CREATE POLICY "appointment_requests_tenant_member"
  ON appointment_requests FOR ALL
  USING (is_tenant_member(tenant_id));

-- Аноним: только INSERT (заявка из storefront без авторизации).
-- ⚠️ ВНИМАНИЕ: эта политика ослаблена (без `TO anon`, без проверки существования
-- тенанта) и сразу же ужесточается в migration 219. Пока обе миграции
-- применяются последовательно одной командой (`supabase migration up`),
-- «окно» нулевое. Не разбивать применение на шаги между 218 и 219.
CREATE POLICY "appointment_requests_anon_insert"
  ON appointment_requests FOR INSERT
  WITH CHECK (tenant_id IS NOT NULL);

-- Service role: полный доступ
CREATE POLICY "appointment_requests_service_role"
  ON appointment_requests FOR ALL
  USING (auth.role() = 'service_role');


-- ─── 9. Realtime ─────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'appointment_groups'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE appointment_groups;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'appointment_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE appointment_requests;
  END IF;
END $$;


-- ─── 10. create_appointments_bulk — новый контракт ────────────────────────────────────
--
-- Старая функция (из 217, 11 param) удаляется, создаётся новая с 13 param.
-- Главные отличия:
--   + создаёт appointment_groups запись и возвращает group_id
--   + принимает p_customer_email (позиция 7) и p_source (позиция 12)
--   + возвращает jsonb вместо TABLE

DROP FUNCTION IF EXISTS public.create_appointments_bulk(
  uuid, uuid, uuid, uuid, text, text, appointment_status, text, boolean, boolean, jsonb
);

CREATE OR REPLACE FUNCTION public.create_appointments_bulk(
  p_tenant_id                 uuid,
  p_branch_id                 uuid,
  p_user_id                   uuid,
  p_customer_id               uuid,
  p_customer_name             text,
  p_customer_phone            text,
  p_customer_email            text,              -- хранится в appointment_groups
  p_status                    appointment_status,
  p_notes                     text,
  p_allow_reschedule_snapshot boolean,
  p_allow_cancel_snapshot     boolean,
  p_source                    text,              -- 'storefront' | 'admin'
  p_items                     jsonb              -- [{service_id, resource_id, starts_at, ends_at, service_name, service_price}]
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
BEGIN
  IF p_source NOT IN ('storefront', 'admin') THEN
    RAISE EXCEPTION 'create_appointments_bulk: p_source must be ''storefront'' or ''admin'''
      USING ERRCODE = 'P0001';
  END IF;

  -- Фаза 1: собираем lock-ключи для TOCTOU-защиты
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_resource_id := NULLIF(v_item->>'resource_id', '')::uuid;
    v_service_id  := (v_item->>'service_id')::uuid;
    IF v_resource_id IS NULL AND p_branch_id IS NULL THEN
      RAISE EXCEPTION 'create_appointments_bulk: item requires resource_id or p_branch_id must be set'
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

  -- Фаза 2: создаём группу
  -- status стартует как 'new'; триггер пересчитает после вставки каждого appointment
  INSERT INTO appointment_groups (
    tenant_id, branch_id, customer_id,
    customer_name, customer_phone, customer_email,
    notes, status, source
  ) VALUES (
    p_tenant_id, p_branch_id, p_customer_id,
    p_customer_name, p_customer_phone, p_customer_email,
    p_notes, 'new', p_source
  ) RETURNING id INTO v_group_id;

  -- Фаза 3: вставляем appointments с group_id
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
