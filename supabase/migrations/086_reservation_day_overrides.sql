-- Migration 086: Add per-day time overrides to reservation_settings

ALTER TABLE reservation_settings
  ADD COLUMN day_overrides jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN reservation_settings.day_overrides IS
  'Per-day time window overrides. Keys: "1"=Mon .. "7"=Sun (ISO). Value: {from: "HH:MM", to: "HH:MM"}';
