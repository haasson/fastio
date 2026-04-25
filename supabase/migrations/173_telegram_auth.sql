-- Telegram Login Widget auth for storefront customers.
-- Uses sliding-session model: token in HttpOnly cookie, SHA-256 hash in DB.
-- See memory-bank/systemPatterns.md → ADR for rationale.

-- 1. Make auth_user_id nullable (telegram users don't have a Supabase auth account)
ALTER TABLE customers ALTER COLUMN auth_user_id DROP NOT NULL;

-- 2. Add telegram_id (per-tenant unique when set)
ALTER TABLE customers ADD COLUMN telegram_id bigint;

CREATE UNIQUE INDEX customers_tenant_telegram_unique
  ON customers(tenant_id, telegram_id)
  WHERE telegram_id IS NOT NULL;

CREATE INDEX idx_customers_telegram_id ON customers(telegram_id);

-- 3. Custom sessions for telegram-authed customers.
-- token_hash = SHA-256 of the plaintext token; raw token is never persisted.
-- expires_at slides forward on each authenticated request (see customerAuth.ts).
CREATE TABLE customer_sessions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash  text        UNIQUE NOT NULL,
  customer_id uuid        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tenant_id   uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  telegram_id bigint      NOT NULL,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_sessions_expires_at ON customer_sessions(expires_at);
CREATE INDEX idx_customer_sessions_customer_id ON customer_sessions(customer_id);

ALTER TABLE customer_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customer_sessions: service role full access"
  ON customer_sessions FOR ALL USING (auth.role() = 'service_role');

-- 4. Daily cleanup of expired sessions via pg_cron.
-- Idempotent: unschedule previous job with the same name if migration is re-run.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'customer_sessions_cleanup') THEN
    PERFORM cron.unschedule('customer_sessions_cleanup');
  END IF;
END $$;

SELECT cron.schedule(
  'customer_sessions_cleanup',
  '17 3 * * *',
  $$DELETE FROM customer_sessions WHERE expires_at < now()$$
);
