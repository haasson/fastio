-- Migration 213: drop appointments.customer_email column.
--
-- Why: 182_appointments.sql added `customer_email text` as part of the
-- contact snapshot. The product decision is to communicate exclusively
-- through Telegram (today) and Max (future), so email is dead by design.
-- The column is not referenced anywhere in app code (no mapper, no RPC,
-- no frontend forms), so dropping it is safe.

ALTER TABLE appointments DROP COLUMN IF EXISTS customer_email;
