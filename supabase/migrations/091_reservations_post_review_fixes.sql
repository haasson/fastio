-- Migration 091: Post-review cleanup for reservations feature
--
-- 1. Drop unused slot_from / slot_to from reservation_settings.
--    These columns were added in 085 but never used — working hours
--    come from tenants.working_hours_schedule instead.
--
-- 2. Add trigram indexes for guest search.
--    ILIKE '%...%' on guest_name / guest_phone needs gin(trgm) —
--    plain btree indexes don't help with leading wildcards.

-- ─── Drop unused columns ──────────────────────────────────────

ALTER TABLE reservation_settings
  DROP COLUMN slot_from,
  DROP COLUMN slot_to;

-- ─── Trigram search indexes ───────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_reservations_guest_name_trgm
  ON reservations USING gin(guest_name gin_trgm_ops);

CREATE INDEX idx_reservations_guest_phone_trgm
  ON reservations USING gin(guest_phone gin_trgm_ops);
