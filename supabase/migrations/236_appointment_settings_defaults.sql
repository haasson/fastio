-- Дефолтные значения для услуг: используются при создании новых услуг и bulk-применении
ALTER TABLE appointment_settings
  ADD COLUMN IF NOT EXISTS default_is_bookable         BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_booking_mode        TEXT    NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS default_allow_resource_choice BOOLEAN NOT NULL DEFAULT true;
