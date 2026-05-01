-- =====================================================================================
-- Migration 223: исправление триггера выхода из коробки
--
-- Проблема 222: BEFORE триггер + DELETE FROM appointment_groups с FK ON DELETE CASCADE
-- вызывал "tuple to be updated was already modified by an operation triggered by the
-- current command" при массовом UPDATE appointments (confirm/cancelAll группы).
--
-- Решение:
-- 1. FK appointments.group_id → ON DELETE SET NULL (было CASCADE)
--    При удалении группы PostgreSQL сам обнуляет group_id у всех appointments.
-- 2. AFTER триггер вместо BEFORE — не может изменить NEW, зато нет конфликтов
--    с другими строками той же команды UPDATE.
--
-- Логика: когда запись выходит из статуса 'new' → проверяем остались ли
-- другие 'new' в группе. Если нет → удаляем группу.
-- FK SET NULL автоматически обнуляет group_id у всех её appointments.
-- =====================================================================================


-- ─── 1. Сменить FK с CASCADE на SET NULL ────────────────────────────────────────────

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_group_id_fkey;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES appointment_groups(id) ON DELETE SET NULL;


-- ─── 2. Удалить BEFORE триггер из миграции 222 ──────────────────────────────────────

DROP TRIGGER IF EXISTS trg_appointments_leave_group ON appointments;
DROP FUNCTION IF EXISTS leave_appointment_group_on_status_change();


-- ─── 3. Создать AFTER триггер ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION exit_appointment_group_after()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Срабатываем только когда запись покидает статус 'new'
  IF OLD.status = 'new' AND NEW.status != 'new' AND OLD.group_id IS NOT NULL THEN
    -- В момент срабатывания AFTER-триггера текущая строка уже обновлена.
    -- Проверяем: остались ли другие 'new'-записи в группе (кроме текущей).
    IF NOT EXISTS (
      SELECT 1 FROM appointments
      WHERE group_id = OLD.group_id
        AND status = 'new'
        AND id != NEW.id
    ) THEN
      -- Группа опустела — удаляем. FK SET NULL автоматически
      -- обнуляет group_id у всех appointments этой группы.
      DELETE FROM appointment_groups WHERE id = OLD.group_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_exit_group ON appointments;
CREATE TRIGGER trg_appointments_exit_group
  AFTER UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION exit_appointment_group_after();
