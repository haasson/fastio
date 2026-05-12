-- Глобальный UNIQUE на idempotency_key был DoS-вектором: при предсказуемых ключах
-- сторонний актор мог занять ключ INSERT'ом, и следующий заказ настоящего тенанта
-- падал с 23505. Уносим уникальность в scope тенанта.
DROP INDEX IF EXISTS orders_idempotency_key_idx;

CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_per_tenant_idx
  ON orders(tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
