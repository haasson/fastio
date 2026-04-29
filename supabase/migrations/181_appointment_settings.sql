-- Migration 181: Appointment settings — настройки модуля записи
--
-- Одна строка на тенанта, содержит все параметры модуля:
-- лейбл ресурса, формат имён, автоподтверждение, горизонт бронирования и т.д.

-- ─── Enum ─────────────────────────────────────────────────

CREATE TYPE staff_name_format AS ENUM (
  'first_name',              -- "Анна"
  'first_name_last_initial', -- "Анна К."
  'full_name'                -- "Анна Краснова"
);

-- ─── appointment_settings ─────────────────────────────────

CREATE TABLE appointment_settings (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  resource_label              text NOT NULL DEFAULT 'мастер',  -- "мастер" | "тренер" | "инструктор" | своё
  allow_resource_choice       boolean NOT NULL DEFAULT true,   -- клиент может выбрать конкретного исполнителя
  staff_name_format           staff_name_format NOT NULL DEFAULT 'first_name',
  auto_confirm                boolean NOT NULL DEFAULT false,
  booking_horizon_days        int NOT NULL DEFAULT 30,         -- за сколько дней вперёд доступна запись
  slot_step_minutes           int NOT NULL DEFAULT 30,         -- шаг слота (15, 30, 60)
  allow_client_cancellation   boolean NOT NULL DEFAULT true,
  cancellation_deadline_hours int NOT NULL DEFAULT 2,          -- за сколько часов до записи можно отменить
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_appointment_settings_updated_at
  BEFORE UPDATE ON appointment_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────

ALTER TABLE appointment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointment_settings_tenant_member"
  ON appointment_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE tenant_id = appointment_settings.tenant_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "appointment_settings_service_role"
  ON appointment_settings FOR ALL
  USING (auth.role() = 'service_role');

-- Storefront читает настройки для отображения (лейбл ресурса, формат имён, горизонт)
CREATE POLICY "appointment_settings_public_read"
  ON appointment_settings FOR SELECT
  USING (true);
