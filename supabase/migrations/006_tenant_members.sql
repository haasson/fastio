-- ─────────────────────────────────────
-- Enum: роли в тенанте
-- ─────────────────────────────────────
CREATE TYPE tenant_role AS ENUM ('owner', 'admin', 'manager', 'staff');

-- ─────────────────────────────────────
-- Таблица: участники тенанта
-- ─────────────────────────────────────
CREATE TABLE tenant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role tenant_role NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX idx_tenant_members_user ON tenant_members(user_id);
CREATE INDEX idx_tenant_members_tenant ON tenant_members(tenant_id);

-- ─────────────────────────────────────
-- Таблица: приглашения в тенант
-- ─────────────────────────────────────
CREATE TABLE tenant_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  role tenant_role NOT NULL DEFAULT 'staff',
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

CREATE INDEX idx_tenant_invitations_token ON tenant_invitations(token);

-- ─────────────────────────────────────
-- Backfill: все существующие owner_id → tenant_members
-- ─────────────────────────────────────
INSERT INTO tenant_members (tenant_id, user_id, role)
SELECT id, owner_id, 'owner'::tenant_role
FROM tenants;

-- ─────────────────────────────────────
-- Helper: проверка membership
-- ─────────────────────────────────────
CREATE OR REPLACE FUNCTION is_tenant_member(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_members
    WHERE tenant_id = _tenant_id
      AND user_id = auth.uid()
  );
$$;

-- ─────────────────────────────────────
-- Helper: проверка минимальной роли
-- Иерархия: owner(0) > admin(1) > manager(2) > staff(3)
-- ─────────────────────────────────────
CREATE OR REPLACE FUNCTION has_tenant_role(_tenant_id uuid, _min_role tenant_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_members
    WHERE tenant_id = _tenant_id
      AND user_id = auth.uid()
      AND ARRAY_POSITION(ARRAY['owner','admin','manager','staff']::tenant_role[], role)
       <= ARRAY_POSITION(ARRAY['owner','admin','manager','staff']::tenant_role[], _min_role)
  );
$$;

-- ─────────────────────────────────────
-- RLS на новые таблицы
-- ─────────────────────────────────────
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;

-- tenant_members: видят все участники тенанта, управляют admin+
CREATE POLICY "tenant_members: members can select"
  ON tenant_members FOR SELECT
  USING (is_tenant_member(tenant_id));

CREATE POLICY "tenant_members: admin can insert"
  ON tenant_members FOR INSERT
  WITH CHECK (has_tenant_role(tenant_id, 'admin'));

CREATE POLICY "tenant_members: admin can update"
  ON tenant_members FOR UPDATE
  USING (has_tenant_role(tenant_id, 'admin'));

CREATE POLICY "tenant_members: admin can delete"
  ON tenant_members FOR DELETE
  USING (has_tenant_role(tenant_id, 'admin'));

-- tenant_invitations: видят admin+, создают admin+
CREATE POLICY "tenant_invitations: admin can select"
  ON tenant_invitations FOR SELECT
  USING (has_tenant_role(tenant_id, 'admin'));

CREATE POLICY "tenant_invitations: admin can insert"
  ON tenant_invitations FOR INSERT
  WITH CHECK (has_tenant_role(tenant_id, 'admin'));

CREATE POLICY "tenant_invitations: admin can update"
  ON tenant_invitations FOR UPDATE
  USING (has_tenant_role(tenant_id, 'admin'));

CREATE POLICY "tenant_invitations: admin can delete"
  ON tenant_invitations FOR DELETE
  USING (has_tenant_role(tenant_id, 'admin'));

-- Realtime для tenant_members
ALTER PUBLICATION supabase_realtime ADD TABLE tenant_members;
