-- Migration 179: Cleanup failed attempt + setup correct resources tables
--
-- Удаляет результаты предыдущей неудачной попытки реализации записи:
--   - таблицы services и resource_services
--   - паразитные колонки в reservations (бронирование столиков — отдельная система)
--   - лишние колонки в resources
--
-- Добавляет правильную структуру:
--   resources (type: person|object, updated_at)
--   resource_branches (junction resource ↔ branch, может уже существовать)

-- ─── Baseline таблицы resources ──────────────────────────
-- Оригинальная миграция, создавшая `resources`, была удалена из репо как часть
-- неудачной попытки записи. На dev DB таблица уже существует, а на свежем
-- db reset / Coolify+self-hosted bootstrap её надо создать заново перед ALTER.
-- CREATE TABLE IF NOT EXISTS делает это безопасным no-op'ом на dev.

CREATE TABLE IF NOT EXISTS resources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resources_tenant ON resources(tenant_id);

-- ─── Cleanup: таблицы от прошлой попытки ─────────────────

DROP TABLE IF EXISTS resource_services CASCADE;
DROP TABLE IF EXISTS services CASCADE;

-- ─── Cleanup: лишние колонки из reservations ─────────────
-- (бронирование столиков — отдельная система, не смешивать с записью на услуги)

ALTER TABLE reservations
  DROP COLUMN IF EXISTS resource_id,
  DROP COLUMN IF EXISTS resource_name,
  DROP COLUMN IF EXISTS service_id,
  DROP COLUMN IF EXISTS service_name,
  DROP COLUMN IF EXISTS duration;

-- ─── Cleanup: лишние колонки из resources ─────────────────

ALTER TABLE resources
  DROP COLUMN IF EXISTS group_name,
  DROP COLUMN IF EXISTS color,
  DROP COLUMN IF EXISTS capacity,
  DROP COLUMN IF EXISTS slot_duration,
  DROP COLUMN IF EXISTS conflict_mode,
  DROP COLUMN IF EXISTS branch_id;

-- ─── Enum resource_type (может уже существовать от partial apply) ─

DO $$ BEGIN
  CREATE TYPE resource_type AS ENUM ('person', 'object');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── resources: добавляем правильные колонки ──────────────

ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS type resource_type NOT NULL DEFAULT 'person',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES tenant_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_resources_member ON resources(member_id) WHERE member_id IS NOT NULL;

-- ─── resource_branches ────────────────────────────────────

CREATE TABLE IF NOT EXISTS resource_branches (
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  branch_id   uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  PRIMARY KEY (resource_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_resource_branches_branch ON resource_branches(branch_id);

-- ─── updated_at trigger ───────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resources_updated_at ON resources;
CREATE TRIGGER trg_resources_updated_at
  BEFORE UPDATE ON resources
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── indexes ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_resources_tenant_active ON resources(tenant_id, is_active);

-- ─── RLS ──────────────────────────────────────────────────

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_branches ENABLE ROW LEVEL SECURITY;

-- resources
DROP POLICY IF EXISTS "resources_tenant_member" ON resources;
CREATE POLICY "resources_tenant_member"
  ON resources FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE tenant_id = resources.tenant_id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "resources_service_role" ON resources;
CREATE POLICY "resources_service_role"
  ON resources FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "resources_public_read" ON resources;
CREATE POLICY "resources_public_read"
  ON resources FOR SELECT
  USING (is_active = true);

-- resource_branches
DROP POLICY IF EXISTS "resource_branches_tenant_member" ON resource_branches;
CREATE POLICY "resource_branches_tenant_member"
  ON resource_branches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM resources r
      JOIN tenant_members tm ON tm.tenant_id = r.tenant_id
      WHERE r.id = resource_branches.resource_id AND tm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "resource_branches_service_role" ON resource_branches;
CREATE POLICY "resource_branches_service_role"
  ON resource_branches FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "resource_branches_public_read" ON resource_branches;
CREATE POLICY "resource_branches_public_read"
  ON resource_branches FOR SELECT
  USING (true);
