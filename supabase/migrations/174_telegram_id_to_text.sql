-- Switch telegram_id from bigint to text.
-- Reason: supabase-js returns bigint as a JS Number; values >= 2^53 lose precision on roundtrip.
-- Telegram IDs are well below 2^53 today (~10^10) but will eventually drift past it.
-- Storing as text removes the precision risk for free.

ALTER TABLE customers          ALTER COLUMN telegram_id TYPE text USING telegram_id::text;
ALTER TABLE customer_sessions  ALTER COLUMN telegram_id TYPE text USING telegram_id::text;
