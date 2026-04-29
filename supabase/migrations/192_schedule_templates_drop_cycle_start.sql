-- Шаблон расписания не должен хранить дату старта цикла:
-- это просто шаблон, дата старта задаётся при применении к конкретному сотруднику.
-- Удаляем cycle_start_date и старый CHECK, добавляем новый без него.

DO $$
DECLARE
  c text;
BEGIN
  SELECT conname INTO c
  FROM pg_constraint
  WHERE conrelid = 'schedule_templates'::regclass
    AND contype  = 'c'
    AND pg_get_constraintdef(oid) LIKE '%cycle_start_date%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE schedule_templates DROP CONSTRAINT %I', c);
  END IF;
END $$;

ALTER TABLE schedule_templates
  DROP COLUMN IF EXISTS cycle_start_date;

ALTER TABLE schedule_templates
  ADD CONSTRAINT schedule_templates_type_cycle_check CHECK (
    (type = 'weekly' AND cycle_length IS NULL) OR
    (type = 'shift'  AND cycle_length IS NOT NULL)
  );
