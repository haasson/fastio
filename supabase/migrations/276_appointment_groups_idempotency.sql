-- Idempotency-Key support для /api/appointments/bulk: повторный POST с тем же
-- ключом не должен создавать дубль группы. Уникальность scope-нулевая
-- per-tenant — повторяет паттерн orders_idempotency_key_per_tenant_idx (миграция 262).

ALTER TABLE appointment_groups
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS appointment_groups_idempotency_key_per_tenant_idx
  ON appointment_groups(tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
