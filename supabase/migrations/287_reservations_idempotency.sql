-- PREPROD-014: idempotency-key для бронирования столов.
-- В отличие от orders (mig 039/262) у reservations его не было — двойной тап /
-- refresh во время submit / медленная сеть → 2 одинаковые брони. UNIQUE per
-- tenant (как в 262 для orders) — глобальный UNIQUE был DoS-вектором: внешний
-- актор мог занять предсказуемый ключ и валить чужие резервации.

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS reservations_idempotency_key_per_tenant_idx
  ON reservations (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
