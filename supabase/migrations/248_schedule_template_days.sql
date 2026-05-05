-- Migration 248: schedule_template_days — переход с материализованных слотов на часы.
--
-- Старая модель: schedule_template_slots(template_id, day_index, slot_time) —
-- материализованный список slot-стартов "HH:MM" на каждый день шаблона.
-- Привязана к slot_step тенанта; не описывает «конец смены»; не поддерживает
-- overnight через шаблон.
--
-- Новая модель: schedule_template_days(template_id, day_index, is_working, open_time, close_time).
-- Часы работы напрямую, слоты вычисляются на runtime из (open, close, slotStep).
-- close < open означает overnight (закрытие следующего календарного дня).
--
-- Реальных тенантов в проде нет → backfill не делаем, дропаем старую таблицу.

-- ─── DROP старого хранилища (FK CASCADE на schedule_templates остаётся) ─────

DROP TABLE schedule_template_slots;

-- ─── CREATE schedule_template_days ─────────────────────────────────────────

CREATE TABLE schedule_template_days (
  template_id  uuid NOT NULL REFERENCES schedule_templates(id) ON DELETE CASCADE,
  day_index    smallint NOT NULL CHECK (day_index BETWEEN 0 AND 30),
  is_working   boolean NOT NULL DEFAULT true,
  open_time    time,
  close_time   time,
  PRIMARY KEY (template_id, day_index),
  -- isWorking=false ⇒ часы NULL. isWorking=true ⇒ оба заданы и не равны.
  CHECK (
    (is_working = false AND open_time IS NULL AND close_time IS NULL)
    OR
    (is_working = true AND open_time IS NOT NULL AND close_time IS NOT NULL AND open_time <> close_time)
  )
);

CREATE INDEX idx_schedule_template_days_template ON schedule_template_days(template_id);

-- ─── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE schedule_template_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_template_days_tenant_member"
  ON schedule_template_days FOR ALL
  USING (is_template_tenant_member(template_id));

CREATE POLICY "schedule_template_days_service_role"
  ON schedule_template_days FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE schedule_template_days IS
  'Часы работы по дню шаблона. day_index = 0..6 для weekly, 0..cycle_length-1 для shift. '
  'close_time < open_time ⇒ overnight (закрывается следующего календарного дня).';
