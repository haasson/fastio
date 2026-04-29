-- Migration 184: service_categories + services — услуги как отдельная сущность
--
-- Услуги хранятся отдельно от dishes. Своя таблица категорий (зеркало categories).
-- services: name, description, price, duration, photos, tags, is_bookable, sort_order.

-- ─── service_categories ──────────────────────────────────

CREATE TABLE service_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_categories_tenant ON service_categories(tenant_id);

ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_categories_tenant_member"
  ON service_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE tenant_id = service_categories.tenant_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "service_categories_service_role"
  ON service_categories FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "service_categories_public_read"
  ON service_categories FOR SELECT
  USING (active = true);

-- ─── services ─────────────────────────────────────────────

CREATE TABLE services (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id uuid REFERENCES service_categories(id) ON DELETE SET NULL,
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  price       numeric NOT NULL DEFAULT 0,
  duration    int NOT NULL,           -- длительность в минутах
  photos      text[] NOT NULL DEFAULT '{}',
  tags        text[] NOT NULL DEFAULT '{}',
  is_bookable boolean NOT NULL DEFAULT true,  -- доступна онлайн-запись
  active      boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_services_tenant ON services(tenant_id);
CREATE INDEX idx_services_tenant_active ON services(tenant_id, active);
CREATE INDEX idx_services_tenant_bookable ON services(tenant_id, is_bookable) WHERE is_bookable = true;
CREATE INDEX idx_services_category ON services(category_id);

CREATE TRIGGER trg_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_tenant_member"
  ON services FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE tenant_id = services.tenant_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "services_service_role"
  ON services FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "services_public_read"
  ON services FOR SELECT
  USING (active = true);
