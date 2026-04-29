-- Migration 183: Dishes bookable — поля is_bookable/duration + junction service_resources
--
-- Услуга хранится как обычный Dish. Добавляем:
-- - is_bookable: флаг "доступна онлайн-запись"
-- - duration: длительность услуги в минутах
-- - service_resources: many-to-many dish ↔ resource

-- ─── Поля на dishes ───────────────────────────────────────

ALTER TABLE dishes
  ADD COLUMN IF NOT EXISTS is_bookable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duration int;  -- в минутах, null = не задано

COMMENT ON COLUMN dishes.is_bookable IS 'Услуга доступна для онлайн-записи через модуль appointments';
COMMENT ON COLUMN dishes.duration IS 'Длительность услуги в минутах (только для is_bookable=true)';

CREATE INDEX idx_dishes_tenant_bookable ON dishes(tenant_id, is_bookable) WHERE is_bookable = true;

-- ─── service_resources (many-to-many: dish ↔ resource) ───

CREATE TABLE service_resources (
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  dish_id     uuid NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  PRIMARY KEY (resource_id, dish_id)
);

CREATE INDEX idx_service_resources_dish ON service_resources(dish_id);
CREATE INDEX idx_service_resources_resource ON service_resources(resource_id);

-- ─── RLS ──────────────────────────────────────────────────

ALTER TABLE service_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_resources_tenant_member"
  ON service_resources FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM resources r
      JOIN tenant_members tm ON tm.tenant_id = r.tenant_id
      WHERE r.id = service_resources.resource_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "service_resources_service_role"
  ON service_resources FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "service_resources_public_read"
  ON service_resources FOR SELECT
  USING (true);
