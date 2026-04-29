-- Migration 188: schedule_templates — переиспользуемые шаблоны графиков работы
--
-- Шаблон описывает только РАБОЧИЕ слоты. Окно времени берётся из графика
-- филиала на момент применения (template_slots ∩ branch_hours).
--
-- weekly: day_index = 0..6 (0=Sun..6=Sat, как в resource_schedules).
-- shift:  day_index = 0..cycle_length-1 (индекс дня в цикле).
--
-- Применяются к ресурсу копированием в resource_schedules / resource_disabled_slots /
-- resource_date_overrides — не FK. Изменения шаблона не трогают уже применённое.

CREATE TYPE schedule_template_type AS ENUM ('weekly', 'shift');

-- ─── schedule_templates ─────────────────────────────────────

CREATE TABLE schedule_templates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                text NOT NULL,
  type                schedule_template_type NOT NULL,
  -- shift-параметры (NULL для weekly)
  cycle_length        int CHECK (cycle_length IS NULL OR cycle_length BETWEEN 1 AND 30),
  cycle_start_date    date,
  -- референсный филиал для отрисовки сетки (NULL = использовать первый филиал тенанта)
  reference_branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (type = 'weekly' AND cycle_length IS NULL AND cycle_start_date IS NULL) OR
    (type = 'shift'  AND cycle_length IS NOT NULL AND cycle_start_date IS NOT NULL)
  )
);

CREATE INDEX idx_schedule_templates_tenant ON schedule_templates(tenant_id);

CREATE TRIGGER trg_schedule_templates_updated_at
  BEFORE UPDATE ON schedule_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── schedule_template_slots (рабочие слоты) ────────────────

CREATE TABLE schedule_template_slots (
  template_id uuid NOT NULL REFERENCES schedule_templates(id) ON DELETE CASCADE,
  day_index   smallint NOT NULL CHECK (day_index BETWEEN 0 AND 30),
  slot_time   time NOT NULL,
  PRIMARY KEY (template_id, day_index, slot_time)
);

CREATE INDEX idx_schedule_template_slots_template ON schedule_template_slots(template_id);

-- ─── RLS ────────────────────────────────────────────────────

ALTER TABLE schedule_templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_template_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_templates_tenant_member"
  ON schedule_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE tenant_id = schedule_templates.tenant_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "schedule_templates_service_role"
  ON schedule_templates FOR ALL
  USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION is_template_tenant_member(p_template_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM schedule_templates st
    JOIN tenant_members tm ON tm.tenant_id = st.tenant_id
    WHERE st.id = p_template_id AND tm.user_id = auth.uid()
  )
$$;

CREATE POLICY "schedule_template_slots_tenant_member"
  ON schedule_template_slots FOR ALL
  USING (is_template_tenant_member(template_id));

CREATE POLICY "schedule_template_slots_service_role"
  ON schedule_template_slots FOR ALL
  USING (auth.role() = 'service_role');
