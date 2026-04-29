-- Migration 180: Resource schedules — расписание ресурсов
--
-- Двухуровневая модель: базовый недельный шаблон (resource_schedules + resource_disabled_slots)
-- + переопределения на конкретную дату (resource_date_overrides + resource_date_disabled_slots).
--
-- Логика расчёта слотов:
-- 1. Если есть date_override → берём его, иначе base schedule по day_of_week
-- 2. Генерируем слоты с шагом slot_step_minutes от open_time до close_time
-- 3. Убираем disabled_slots (обед, перерывы)
-- 4. Убираем слоты, где starts_at + duration выходит за close_time
-- 5. Убираем слоты, пересекающиеся с существующими записями

-- ─── resource_schedules (базовый недельный шаблон) ───────

CREATE TABLE resource_schedules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sun, 1=Mon, ..., 6=Sat
  is_working  boolean NOT NULL DEFAULT true,
  open_time   time,   -- null если is_working=false
  close_time  time,   -- null если is_working=false
  UNIQUE (resource_id, day_of_week)
);

CREATE INDEX idx_resource_schedules_resource ON resource_schedules(resource_id);

-- ─── resource_disabled_slots (выключенные слоты в шаблоне) ──

CREATE TABLE resource_disabled_slots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  slot_time   time NOT NULL,  -- например '13:00'
  UNIQUE (resource_id, day_of_week, slot_time)
);

CREATE INDEX idx_resource_disabled_slots_resource ON resource_disabled_slots(resource_id);

-- ─── resource_date_overrides (переопределение на конкретную дату) ─

CREATE TABLE resource_date_overrides (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  date        date NOT NULL,
  is_working  boolean NOT NULL DEFAULT false,
  open_time   time,   -- null если is_working=false
  close_time  time,   -- null если is_working=false
  UNIQUE (resource_id, date)
);

CREATE INDEX idx_resource_date_overrides_resource ON resource_date_overrides(resource_id);
CREATE INDEX idx_resource_date_overrides_date ON resource_date_overrides(resource_id, date);

-- ─── resource_date_disabled_slots (выключенные слоты на конкретную дату) ─

CREATE TABLE resource_date_disabled_slots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  date        date NOT NULL,
  slot_time   time NOT NULL,
  UNIQUE (resource_id, date, slot_time)
);

CREATE INDEX idx_resource_date_disabled_slots_resource ON resource_date_disabled_slots(resource_id);
CREATE INDEX idx_resource_date_disabled_slots_date ON resource_date_disabled_slots(resource_id, date);

-- ─── RLS ──────────────────────────────────────────────────

ALTER TABLE resource_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_disabled_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_date_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_date_disabled_slots ENABLE ROW LEVEL SECURITY;

-- Хелпер: проверка членства через resource_id
-- (ресурс → tenant_id → tenant_members)
CREATE OR REPLACE FUNCTION is_resource_tenant_member(p_resource_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM resources r
    JOIN tenant_members tm ON tm.tenant_id = r.tenant_id
    WHERE r.id = p_resource_id AND tm.user_id = auth.uid()
  )
$$;

-- resource_schedules
CREATE POLICY "resource_schedules_tenant_member"
  ON resource_schedules FOR ALL
  USING (is_resource_tenant_member(resource_id));

CREATE POLICY "resource_schedules_service_role"
  ON resource_schedules FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "resource_schedules_public_read"
  ON resource_schedules FOR SELECT
  USING (true);

-- resource_disabled_slots
CREATE POLICY "resource_disabled_slots_tenant_member"
  ON resource_disabled_slots FOR ALL
  USING (is_resource_tenant_member(resource_id));

CREATE POLICY "resource_disabled_slots_service_role"
  ON resource_disabled_slots FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "resource_disabled_slots_public_read"
  ON resource_disabled_slots FOR SELECT
  USING (true);

-- resource_date_overrides
CREATE POLICY "resource_date_overrides_tenant_member"
  ON resource_date_overrides FOR ALL
  USING (is_resource_tenant_member(resource_id));

CREATE POLICY "resource_date_overrides_service_role"
  ON resource_date_overrides FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "resource_date_overrides_public_read"
  ON resource_date_overrides FOR SELECT
  USING (true);

-- resource_date_disabled_slots
CREATE POLICY "resource_date_disabled_slots_tenant_member"
  ON resource_date_disabled_slots FOR ALL
  USING (is_resource_tenant_member(resource_id));

CREATE POLICY "resource_date_disabled_slots_service_role"
  ON resource_date_disabled_slots FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "resource_date_disabled_slots_public_read"
  ON resource_date_disabled_slots FOR SELECT
  USING (true);
