-- PREPROD-018: разрешить клиенту отменять бронь из кабинета.
-- В отличие от appointments deadline-check НЕ добавляем: без предоплаты он не
-- защищает (клиент-no-show = тот же эффект что late-cancel, только без сигнала
-- тенанту). Прозрачная отмена лучше, чем тихий no-show.
--
-- Snapshot колонка: при INSERT в reservations берём текущее значение settings,
-- чтобы тенант не мог ретроактивно лишить клиента права на отмену уже сделанной
-- брони. NULL означает «брони старее миграции» (legacy fallback на live setting).

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS allow_cancel_snapshot boolean;

ALTER TABLE reservation_settings
  ADD COLUMN IF NOT EXISTS allow_client_cancellation boolean NOT NULL DEFAULT true;
