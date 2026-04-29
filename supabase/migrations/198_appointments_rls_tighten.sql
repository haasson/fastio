-- Migration 198: Tighten appointments RLS — close two security holes.
--
-- 1. Anon insert policy was too permissive: any anon could INSERT a row in
--    any tenant with any service_id/resource_id/status. Server endpoints already
--    use service_role for guest bookings, so the public anon path is unnecessary.
--
-- 2. "appointments_own_user FOR ALL USING (...)" had no WITH CHECK, so an
--    authenticated user could INSERT/UPDATE rows referencing arbitrary tenants/
--    resources/services. Split into FOR SELECT/DELETE (read+cancel own) and a
--    narrow FOR UPDATE that pins tenant_id to the caller's tenant memberships
--    and forbids re-pointing the row to someone else's user_id.
--
-- Reference: reservations RLS (085_reservations.sql) follows the same pattern —
-- only tenant_member + service_role + own SELECT.

-- ─── Drop the loose policies ──────────────────────────────────────────

DROP POLICY IF EXISTS "appointments_anon_insert" ON appointments;
DROP POLICY IF EXISTS "appointments_own_user"    ON appointments;

-- ─── Re-add scoped own-user policies ─────────────────────────────────

-- Read own appointments (history, account page).
CREATE POLICY "appointments_own_user_select"
  ON appointments FOR SELECT
  USING (user_id = auth.uid());

-- Delete own appointments (defensive — clients normally cancel via server,
-- but this preserves the previous capability for direct-API users).
CREATE POLICY "appointments_own_user_delete"
  ON appointments FOR DELETE
  USING (user_id = auth.uid());

-- Update own appointments — only when staying within a tenant the user
-- belongs to, never re-assigning the row to another user.
CREATE POLICY "appointments_own_user_update"
  ON appointments FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );
