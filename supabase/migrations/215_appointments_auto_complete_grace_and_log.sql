-- Migration 215: grace period for auto-cancel + log system status transitions.
--
-- Проблемы 197:
--
-- 1. После долгого простоя cron'а (рестарт сервера, отключение pg_cron, миграция)
--    при первом запуске мгновенно пометит cancelled ВСЕ просроченные «новые»
--    записи без шанса админу разобраться. Особенно опасно если админ был не за
--    компьютером несколько часов и теперь возвращается к разбору заявок.
--
-- 2. Триггер `log_appointment_created` ловит только INSERT. Системная отмена/
--    завершение через cron не пишется в `appointment_events` — потом не понять,
--    кто/когда отменил запись (видим только финальный статус, не переход).
--
-- Фикс:
--   - cron получает 15-минутный grace для no_show ('new');
--   - триггер AFTER UPDATE логирует переходы статуса с actor_role='system'
--     для cancelled_by='system' и для confirmed → done без `cancelled_*`.

-- ─── 1. Reschedule cron with grace period ────────────────────

SELECT cron.unschedule('appointments-auto-complete');

SELECT cron.schedule(
  'appointments-auto-complete',
  '*/30 * * * *',
  $$
  -- new past their slot + grace 15 минут — клиент не явился и админ даже
  -- не подтвердил. Grace защищает от мгновенной массовой отмены при долгом
  -- простое cron'а: админ успевает отреагировать на свежепросроченные.
  UPDATE appointments
  SET
    status        = 'cancelled',
    cancel_reason = 'no_show',
    cancelled_by  = 'system',
    cancelled_at  = now(),
    updated_at    = now()
  WHERE status = 'new'
    AND ends_at < now() - interval '15 minutes';

  -- confirmed past их окончания + 30 минут — считаем что услуга оказана
  UPDATE appointments
  SET
    status     = 'done',
    updated_at = now()
  WHERE status = 'confirmed'
    AND COALESCE(actual_ends_at, ends_at) < now() - interval '30 minutes';
  $$
);

-- ─── 2. Trigger: log system status transitions ───────────────
--
-- AFTER UPDATE OF status — реагируем только на переход. Для не-системных
-- переходов триггер не пишет: их пишет приложение через логгер на клиенте
-- (`useAppointmentEventLogger.ts`), у него есть юзер-контекст и человеческая
-- роль.
--
-- Системные переходы: cancelled_by='system' (cron) и confirmed→done без
-- проставленных cancelled_* (тоже cron auto-complete).

CREATE OR REPLACE FUNCTION log_appointment_system_transition() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- no_show через cron
  IF NEW.status = 'cancelled'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.cancelled_by = 'system'
  THEN
    INSERT INTO appointment_events (appointment_id, tenant_id, actor_id, actor_role, event_type, meta)
    VALUES (
      NEW.id, NEW.tenant_id, NULL, 'system', 'appointment_cancelled',
      jsonb_build_object('reason', NEW.cancel_reason, 'source', 'cron')
    );
    RETURN NEW;
  END IF;

  -- auto-complete через cron: переход confirmed → done без cancelled_*
  IF NEW.status = 'done'
     AND OLD.status = 'confirmed'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.cancelled_at IS NULL
  THEN
    INSERT INTO appointment_events (appointment_id, tenant_id, actor_id, actor_role, event_type, meta)
    VALUES (
      NEW.id, NEW.tenant_id, NULL, 'system', 'appointment_completed',
      jsonb_build_object('source', 'cron')
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointment_system_transition_trigger ON appointments;
CREATE TRIGGER appointment_system_transition_trigger
  AFTER UPDATE OF status ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION log_appointment_system_transition();
