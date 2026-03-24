-- Migration 087: Structured working hours on tenants, replace slot_from/slot_to with buffer

-- ─── Working hours schedule on tenants ────────────────────────────────────────
-- Structure: { "default": { "open": "HH:MM", "close": "HH:MM" }, "days": { "1": {...}, ... } }
-- Keys "1"=Mon .. "7"=Sun (ISO week). Only overridden days are present in "days".

ALTER TABLE tenants
  ADD COLUMN working_hours_schedule jsonb;

-- ─── Replace slot_from/slot_to/day_overrides with close_buffer_minutes ────────

ALTER TABLE reservation_settings
  DROP COLUMN slot_from,
  DROP COLUMN slot_to,
  DROP COLUMN day_overrides,
  ADD COLUMN close_buffer_minutes int NOT NULL DEFAULT 60;
