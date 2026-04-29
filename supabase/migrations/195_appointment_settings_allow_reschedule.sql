-- Тогл: клиент может изменить (перенести) запись через личный кабинет.
-- Дедлайн используется тот же, что и для отмены (cancellation_deadline_hours).
-- По дефолту — false: исторически клиент мог только отменить, перенос — новая фича.

ALTER TABLE appointment_settings
  ADD COLUMN allow_client_reschedule boolean NOT NULL DEFAULT false;
