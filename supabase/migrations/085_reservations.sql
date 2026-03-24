-- Migration 085: Reservations — online table booking
--
-- Adds reservation_settings and reservations tables,
-- RLS policies, and module_configs entry.

-- ─── Enum ─────────────────────────────────────────────────

CREATE TYPE reservation_status AS ENUM (
  'pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'
);

-- ─── reservation_settings ─────────────────────────────────

CREATE TABLE reservation_settings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  enabled          boolean NOT NULL DEFAULT true,
  slot_step        int NOT NULL DEFAULT 30,         -- minutes: 15 | 30 | 60
  slot_from        time NOT NULL DEFAULT '10:00',
  slot_to          time NOT NULL DEFAULT '22:00',
  max_advance_days int NOT NULL DEFAULT 30,
  min_guests       int NOT NULL DEFAULT 1,
  max_guests       int NOT NULL DEFAULT 20,
  auto_confirm     boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── reservations ─────────────────────────────────────────

CREATE TABLE reservations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id     uuid REFERENCES branches(id),
  customer_id   uuid REFERENCES customers(id),
  guest_name    text NOT NULL,
  guest_phone   text NOT NULL,
  guest_email   text,
  guest_count   int NOT NULL,
  reserved_date date NOT NULL,
  reserved_time time NOT NULL,
  comment       text,
  status        reservation_status NOT NULL DEFAULT 'pending',
  table_id      uuid REFERENCES tables(id),
  table_name    text,
  order_id      uuid REFERENCES orders(id),
  confirmed_by  uuid REFERENCES auth.users(id),
  confirmed_at  timestamptz,
  seated_at     timestamptz,
  cancelled_at  timestamptz,
  cancel_reason text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reservations_tenant ON reservations(tenant_id);
CREATE INDEX idx_reservations_tenant_date ON reservations(tenant_id, reserved_date);
CREATE INDEX idx_reservations_customer ON reservations(customer_id);
CREATE INDEX idx_reservations_status ON reservations(tenant_id, status);

-- ─── updated_at triggers ──────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_reservation_settings_updated_at
  BEFORE UPDATE ON reservation_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_settings ENABLE ROW LEVEL SECURITY;

-- Tenant members: full access to their tenant's reservations
CREATE POLICY "reservations_tenant_member"
  ON reservations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE tenant_id = reservations.tenant_id AND user_id = auth.uid()
    )
  );

-- Service role: unrestricted (used by Edge Functions and server routes)
CREATE POLICY "reservations_service_role"
  ON reservations FOR ALL
  USING (auth.role() = 'service_role');

-- Customers: read their own reservations
CREATE POLICY "reservations_customer_own"
  ON reservations FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE auth_user_id = auth.uid()
    )
  );

-- Reservation settings: tenant members
CREATE POLICY "reservation_settings_tenant_member"
  ON reservation_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE tenant_id = reservation_settings.tenant_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "reservation_settings_service_role"
  ON reservation_settings FOR ALL
  USING (auth.role() = 'service_role');

-- ─── Module config ────────────────────────────────────────

INSERT INTO module_configs (key, name, description, icon, required_plan_key, sort_order)
VALUES ('reservations', 'Бронирование', 'Онлайн-бронирование столов с формой на сайте', 'calendarCheck', 'business', 10)
ON CONFLICT (key) DO NOTHING;

-- ─── Realtime ──────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE reservations;
