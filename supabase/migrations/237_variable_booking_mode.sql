-- Убираем старый constraint, обновляем данные, добавляем новый
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_booking_mode_check;
UPDATE services SET booking_mode = 'variable' WHERE booking_mode = 'open_ended';
UPDATE appointments SET booking_mode = 'variable' WHERE booking_mode = 'open_ended';
ALTER TABLE services ADD CONSTRAINT services_booking_mode_check
  CHECK (booking_mode = ANY (ARRAY['fixed'::text, 'variable'::text]));

-- Максимальная длительность для variable-услуг
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS max_duration INT NULL;

-- Дефолт максимальной длительности для тенанта (3 часа)
ALTER TABLE appointment_settings
  ADD COLUMN IF NOT EXISTS default_max_duration INT NOT NULL DEFAULT 180;
