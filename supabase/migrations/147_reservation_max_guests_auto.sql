-- Add max_guests_auto flag to reservation_settings
-- When true, max_guests is derived from the largest active table capacity

ALTER TABLE reservation_settings
  ADD COLUMN IF NOT EXISTS max_guests_auto boolean NOT NULL DEFAULT false;
