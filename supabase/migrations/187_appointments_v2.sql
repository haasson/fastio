-- Migration 187: services-by-branch, resource-by-category, capacity, open-ended booking
--
-- Главные изменения модели записи на услуги:
-- 1. service_branches: услуги делятся по филиалам (пусто = все).
-- 2. resource_categories: ресурс наследует все услуги категории (auto-assign).
-- 3. resources.capacity: 1+ параллельных бронирований на ресурс (бильярд, велосипеды).
-- 4. services.booking_mode: fixed (стрижка) | open_ended (бильярд, продлеваемое).
-- 5. services.allow_resource_choice: per-service (был глобальный в appointment_settings).
-- 6. appointments.actual_ends_at: фактическое окончание для open_ended.
--
-- В dev окружении записей нет, миграция деструктивна для appointment_settings.allow_resource_choice.

-- ─── service_branches: услуга ↔ филиал (пусто = все) ────────

CREATE TABLE service_branches (
  service_id uuid NOT NULL REFERENCES services(id)  ON DELETE CASCADE,
  branch_id  uuid NOT NULL REFERENCES branches(id)  ON DELETE CASCADE,
  PRIMARY KEY (service_id, branch_id)
);

CREATE INDEX idx_service_branches_branch ON service_branches(branch_id);

ALTER TABLE service_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_branches_tenant_member"
  ON service_branches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM services s
      JOIN tenant_members tm ON tm.tenant_id = s.tenant_id
      WHERE s.id = service_branches.service_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "service_branches_service_role"
  ON service_branches FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "service_branches_public_read"
  ON service_branches FOR SELECT
  USING (true);

-- ─── resource_categories: ресурс ↔ категория (auto-assign) ──

CREATE TABLE resource_categories (
  resource_id uuid NOT NULL REFERENCES resources(id)  ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (resource_id, category_id)
);

CREATE INDEX idx_resource_categories_category ON resource_categories(category_id);

ALTER TABLE resource_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resource_categories_tenant_member"
  ON resource_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM resources r
      JOIN tenant_members tm ON tm.tenant_id = r.tenant_id
      WHERE r.id = resource_categories.resource_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "resource_categories_service_role"
  ON resource_categories FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "resource_categories_public_read"
  ON resource_categories FOR SELECT
  USING (true);

-- ─── resources.capacity ─────────────────────────────────────

ALTER TABLE resources
  ADD COLUMN capacity int NOT NULL DEFAULT 1 CHECK (capacity >= 1);

COMMENT ON COLUMN resources.capacity IS
  'Сколько параллельных бронирований допустимо одновременно (10 столов = 10).';

-- ─── services: booking_mode + allow_resource_choice ─────────

ALTER TABLE services
  ADD COLUMN booking_mode text NOT NULL DEFAULT 'fixed'
    CHECK (booking_mode IN ('fixed', 'open_ended')),
  ADD COLUMN allow_resource_choice boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN services.booking_mode IS
  'fixed — длительность жёсткая. open_ended — клиент бронирует старт, окончание ставит админ.';

COMMENT ON COLUMN services.allow_resource_choice IS
  'Может ли клиент выбрать конкретного исполнителя в storefront.';

-- ─── appointments.actual_ends_at ────────────────────────────

ALTER TABLE appointments
  ADD COLUMN actual_ends_at timestamptz;

COMMENT ON COLUMN appointments.actual_ends_at IS
  'Фактическое время окончания (для open_ended). NULL = используем ends_at.';

-- ─── appointment_settings: убираем allow_resource_choice ────
-- (переехало на услугу)

ALTER TABLE appointment_settings DROP COLUMN IF EXISTS allow_resource_choice;
