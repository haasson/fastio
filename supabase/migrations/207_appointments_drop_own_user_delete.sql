-- Migration 207: drop appointments_own_user_{delete,update} policies.
--
-- Why: both let an authenticated customer mutate their own appointment row
-- directly via the Supabase JS client, bypassing
-- /api/customer/appointments/[id]/cancel — the only place that enforces
-- cancellation_deadline_hours and writes the cancellation snapshot into
-- appointment_events (199).
--
-- DELETE: the policy let the customer hard-delete the row, leaving no audit.
-- UPDATE: the policy let the customer flip status='cancelled' (or any other
-- field) without the deadline check or the event log.
--
-- After this: customers can only read their own rows directly. Cancellation
-- (and any future "self-reschedule") must go through the API. Hard
-- delete/update remain available to tenant members (admin) and service_role.

DROP POLICY IF EXISTS "appointments_own_user_delete" ON appointments;
DROP POLICY IF EXISTS "appointments_own_user_update" ON appointments;
