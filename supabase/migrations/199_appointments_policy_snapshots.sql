-- Migration 199: snapshot allow_reschedule / allow_cancel on appointment.
--
-- Why: cancel.post.ts checks the live appointment_settings.* values. If admin
-- tightens the rules ("clients can no longer cancel") after a booking is made,
-- the customer suddenly loses the right they originally had.
--
-- Fix: capture the relevant policy bits at INSERT time. Server endpoints
-- write today's settings into the snapshot columns. cancel/reschedule
-- endpoints read the snapshot, falling back to live settings only when the
-- snapshot is NULL (legacy rows from before this migration).

ALTER TABLE appointments
  ADD COLUMN allow_reschedule_snapshot boolean,
  ADD COLUMN allow_cancel_snapshot     boolean;

COMMENT ON COLUMN appointments.allow_reschedule_snapshot IS
  'Snapshot of appointment_settings.allow_client_reschedule at booking time. NULL = use live settings.';
COMMENT ON COLUMN appointments.allow_cancel_snapshot IS
  'Snapshot of appointment_settings.allow_client_cancellation at booking time. NULL = use live settings.';
