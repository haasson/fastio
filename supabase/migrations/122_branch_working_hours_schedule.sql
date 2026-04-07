-- Migration 122: Унификация часов работы
-- branches.working_hours (jsonb, произвольный формат) → working_hours_schedule (WorkingHoursSchedule)
-- tenants.working_hours (legacy строка) — удаляем

ALTER TABLE branches
  RENAME COLUMN working_hours TO working_hours_schedule;

ALTER TABLE tenants
  DROP COLUMN IF EXISTS working_hours;
