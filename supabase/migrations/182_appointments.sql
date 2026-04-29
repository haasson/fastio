-- Migration 182: Appointments — записи клиентов на услуги
--
-- Хранит запись: услуга, ресурс (исполнитель), клиент (user_id или гость),
-- время начала/конца, статус, снапшот контактов.

-- ─── Enum ─────────────────────────────────────────────────

CREATE TYPE appointment_status AS ENUM (
  'new',       -- создана, ждёт подтверждения
  'confirmed', -- подтверждена администратором
  'cancelled', -- отменена (клиентом или администратором)
  'done'       -- завершена
);

-- ─── appointments ─────────────────────────────────────────

CREATE TABLE appointments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id       uuid REFERENCES branches(id) ON DELETE SET NULL,
  dish_id         uuid NOT NULL REFERENCES dishes(id) ON DELETE RESTRICT,
  resource_id     uuid REFERENCES resources(id) ON DELETE SET NULL,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,  -- null для гостевых записей
  -- снапшот контактов клиента (заполняется всегда)
  customer_name   text NOT NULL,
  customer_phone  text NOT NULL,
  customer_email  text,
  -- время
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz NOT NULL,
  -- прочее
  status          appointment_status NOT NULL DEFAULT 'new',
  notes           text,
  cancel_reason   text,
  cancelled_by    text,  -- 'client' | 'admin'
  cancelled_at    timestamptz,
  confirmed_at    timestamptz,
  confirmed_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_appointments_tenant ON appointments(tenant_id);
CREATE INDEX idx_appointments_tenant_status ON appointments(tenant_id, status);
CREATE INDEX idx_appointments_tenant_starts ON appointments(tenant_id, starts_at);
CREATE INDEX idx_appointments_resource ON appointments(resource_id, starts_at);
CREATE INDEX idx_appointments_user ON appointments(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_appointments_branch ON appointments(branch_id);

-- ─── updated_at trigger ───────────────────────────────────

CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Члены тенанта: полный доступ к записям своего тенанта
CREATE POLICY "appointments_tenant_member"
  ON appointments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE tenant_id = appointments.tenant_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "appointments_service_role"
  ON appointments FOR ALL
  USING (auth.role() = 'service_role');

-- Клиент видит и отменяет свои записи
CREATE POLICY "appointments_own_user"
  ON appointments FOR ALL
  USING (user_id = auth.uid());

-- Анонимное создание (гостевые записи) — только INSERT
CREATE POLICY "appointments_anon_insert"
  ON appointments FOR INSERT
  WITH CHECK (user_id IS NULL);

-- ─── Realtime ──────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
