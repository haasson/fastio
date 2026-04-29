-- Migration 210: CHECK-constraints на appointment_settings
--
-- Защищаем числовые поля от некорректных значений (отрицательные/нулевые),
-- которые могут сломать слот-engine и UI горизонта бронирования.

ALTER TABLE appointment_settings
  ADD CONSTRAINT appointment_settings_booking_horizon_days_positive
    CHECK (booking_horizon_days > 0);

ALTER TABLE appointment_settings
  ADD CONSTRAINT appointment_settings_slot_step_minutes_positive
    CHECK (slot_step_minutes > 0);

ALTER TABLE appointment_settings
  ADD CONSTRAINT appointment_settings_cancellation_deadline_hours_nonneg
    CHECK (cancellation_deadline_hours >= 0);
