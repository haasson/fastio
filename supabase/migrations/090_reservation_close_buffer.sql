-- Migration 090: add close_buffer_minutes to reservation_settings
--
-- Column was referenced in the application layer but missing from the schema.
-- Default 60 matches the fallback that was hardcoded in the API mapper.

ALTER TABLE reservation_settings
  ADD COLUMN close_buffer_minutes int NOT NULL DEFAULT 60;
