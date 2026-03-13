-- Idempotency key для защиты от дублей при повторном сабмите заказа.
-- UUID генерится на клиенте при открытии формы оформления заказа.
-- Nullable — чтобы не сломать существующие заказы без ключа.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_idx
  ON orders(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
