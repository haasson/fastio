-- Migration 185: Переход с dish_id на service_id
--
-- Убираем is_bookable/duration с dishes (услуги теперь отдельная сущность).
-- Пересоздаём service_resources с service_id вместо dish_id.
-- В appointments заменяем dish_id → service_id.
--
-- Note: если есть существующие appointments — нужен ручной перенос данных.
-- В dev окружении записей нет, поэтому ADD COLUMN + SET NOT NULL работает напрямую.

-- ─── dishes: убираем поля услуг ──────────────────────────

ALTER TABLE dishes
  DROP COLUMN IF EXISTS is_bookable,
  DROP COLUMN IF EXISTS duration;

DROP INDEX IF EXISTS idx_dishes_tenant_bookable;

-- ─── service_resources: dish_id → service_id ─────────────

DROP TABLE IF EXISTS service_resources;

CREATE TABLE service_resources (
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  service_id  uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  PRIMARY KEY (resource_id, service_id)
);

CREATE INDEX idx_service_resources_service ON service_resources(service_id);
CREATE INDEX idx_service_resources_resource ON service_resources(resource_id);

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

-- ─── appointments: dish_id → service_id ──────────────────

ALTER TABLE appointments DROP COLUMN IF EXISTS dish_id;
ALTER TABLE appointments ADD COLUMN service_id uuid REFERENCES services(id) ON DELETE RESTRICT;
ALTER TABLE appointments ALTER COLUMN service_id SET NOT NULL;

CREATE INDEX idx_appointments_service ON appointments(service_id);
