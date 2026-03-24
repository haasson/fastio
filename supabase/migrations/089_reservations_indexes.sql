-- Migration 089: Additional indexes for reservations
--
-- Covers the most common query patterns:
-- - list by tenant + branch (sidebar branch filter)
-- - list by tenant + date + branch + status (filtered views)

CREATE INDEX idx_reservations_branch
  ON reservations(tenant_id, branch_id);

CREATE INDEX idx_reservations_date_branch_status
  ON reservations(tenant_id, reserved_date, branch_id, status);
