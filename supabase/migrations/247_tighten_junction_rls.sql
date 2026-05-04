-- Migration 247: Tighten junction table RLS — close cross-tenant leaks.
-- (Изначально создана с номером 234 — переименована из-за коллизии с
-- 234_order_items_tenant_id.sql, применённой раньше.)
--
-- Problem: the following junction/schedule tables had USING (true) on their
-- public SELECT policy, meaning any anon user could read ALL tenants' data via
-- a direct PostgREST request (e.g. GET /rest/v1/dish_modifier_groups).
--
-- These tables have no tenant_id of their own; they link to a parent table
-- that does. The fix: replace USING (true) with an EXISTS subquery that checks
-- membership in the parent's tenant via is_tenant_member() / explicit join.
--
-- Tables fixed:
--   Food module:
--     dish_modifier_groups, dish_modifier_options    (migration 024)
--     dish_addons, addon_preset_items                (migration 051)
--     combo_items                                    (migration 036)
--   Appointments module:
--     resource_branches                              (migration 179)
--     resource_schedules, resource_disabled_slots,
--     resource_date_overrides,
--     resource_date_disabled_slots                   (migration 180)
--     service_resources                              (migration 185)
--     service_branches, resource_categories          (migration 187)
--
-- Notes:
--   • Storefront server uses service_role — bypasses RLS entirely, unaffected.
--   • Admin panel uses authenticated JWT + is_tenant_member() — works as before.
--   • Anon direct PostgREST SELECT is now blocked (that's the goal).
--   • Write policies (INSERT/UPDATE/DELETE) are not touched — they were already
--     correctly scoped.

-- ══════════════════════════════════════════════════════════════════════════════
-- FOOD MODULE
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── dish_modifier_groups ─────────────────────────────────────────────────────
-- dish_id → dishes.tenant_id

DROP POLICY IF EXISTS "dish_modifier_groups: public read" ON dish_modifier_groups;

CREATE POLICY "dish_modifier_groups_tenant_read"
  ON dish_modifier_groups FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM dishes d
    WHERE d.id = dish_modifier_groups.dish_id
      AND is_tenant_member(d.tenant_id)
  ));

DROP POLICY IF EXISTS "dish_modifier_groups_service_role" ON dish_modifier_groups;
CREATE POLICY "dish_modifier_groups_service_role"
  ON dish_modifier_groups FOR SELECT
  USING (auth.role() = 'service_role');

-- ─── dish_modifier_options ────────────────────────────────────────────────────
-- dish_id → dishes.tenant_id

DROP POLICY IF EXISTS "dish_modifier_options: public read" ON dish_modifier_options;

CREATE POLICY "dish_modifier_options_tenant_read"
  ON dish_modifier_options FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM dishes d
    WHERE d.id = dish_modifier_options.dish_id
      AND is_tenant_member(d.tenant_id)
  ));

DROP POLICY IF EXISTS "dish_modifier_options_service_role" ON dish_modifier_options;
CREATE POLICY "dish_modifier_options_service_role"
  ON dish_modifier_options FOR SELECT
  USING (auth.role() = 'service_role');

-- ─── dish_addons ──────────────────────────────────────────────────────────────
-- dish_id → dishes.tenant_id

DROP POLICY IF EXISTS "dish_addons: public read" ON dish_addons;

CREATE POLICY "dish_addons_tenant_read"
  ON dish_addons FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM dishes d
    WHERE d.id = dish_addons.dish_id
      AND is_tenant_member(d.tenant_id)
  ));

DROP POLICY IF EXISTS "dish_addons_service_role" ON dish_addons;
CREATE POLICY "dish_addons_service_role"
  ON dish_addons FOR SELECT
  USING (auth.role() = 'service_role');

-- ─── addon_preset_items ───────────────────────────────────────────────────────
-- preset_id → addon_presets.tenant_id

DROP POLICY IF EXISTS "addon_preset_items: public read" ON addon_preset_items;

CREATE POLICY "addon_preset_items_tenant_read"
  ON addon_preset_items FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM addon_presets p
    WHERE p.id = addon_preset_items.preset_id
      AND is_tenant_member(p.tenant_id)
  ));

DROP POLICY IF EXISTS "addon_preset_items_service_role" ON addon_preset_items;
CREATE POLICY "addon_preset_items_service_role"
  ON addon_preset_items FOR SELECT
  USING (auth.role() = 'service_role');

-- ─── combo_items ──────────────────────────────────────────────────────────────
-- combo_id → combos.tenant_id

DROP POLICY IF EXISTS "combo_items: public read" ON combo_items;

CREATE POLICY "combo_items_tenant_read"
  ON combo_items FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM combos c
    WHERE c.id = combo_items.combo_id
      AND is_tenant_member(c.tenant_id)
  ));

DROP POLICY IF EXISTS "combo_items_service_role" ON combo_items;
CREATE POLICY "combo_items_service_role"
  ON combo_items FOR SELECT
  USING (auth.role() = 'service_role');

-- ══════════════════════════════════════════════════════════════════════════════
-- APPOINTMENTS MODULE
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── resource_branches ───────────────────────────────────────────────────────
-- resource_id → resources.tenant_id

DROP POLICY IF EXISTS "resource_branches_public_read" ON resource_branches;

CREATE POLICY "resource_branches_tenant_read"
  ON resource_branches FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM resources r
    WHERE r.id = resource_branches.resource_id
      AND is_tenant_member(r.tenant_id)
  ));

-- Note: resource_branches already has resource_branches_service_role policy.

-- ─── resource_schedules ──────────────────────────────────────────────────────
-- resource_id → resources.tenant_id (via is_resource_tenant_member helper)

DROP POLICY IF EXISTS "resource_schedules_public_read" ON resource_schedules;

CREATE POLICY "resource_schedules_tenant_read"
  ON resource_schedules FOR SELECT
  TO authenticated
  USING (is_resource_tenant_member(resource_id));

-- Note: resource_schedules already has resource_schedules_service_role policy.

-- ─── resource_disabled_slots ─────────────────────────────────────────────────
-- resource_id → resources.tenant_id

DROP POLICY IF EXISTS "resource_disabled_slots_public_read" ON resource_disabled_slots;

CREATE POLICY "resource_disabled_slots_tenant_read"
  ON resource_disabled_slots FOR SELECT
  TO authenticated
  USING (is_resource_tenant_member(resource_id));

-- Note: resource_disabled_slots already has resource_disabled_slots_service_role policy.

-- ─── resource_date_overrides ──────────────────────────────────────────────────
-- resource_id → resources.tenant_id

DROP POLICY IF EXISTS "resource_date_overrides_public_read" ON resource_date_overrides;

CREATE POLICY "resource_date_overrides_tenant_read"
  ON resource_date_overrides FOR SELECT
  TO authenticated
  USING (is_resource_tenant_member(resource_id));

-- Note: resource_date_overrides already has resource_date_overrides_service_role policy.

-- ─── resource_date_disabled_slots ────────────────────────────────────────────
-- resource_id → resources.tenant_id

DROP POLICY IF EXISTS "resource_date_disabled_slots_public_read" ON resource_date_disabled_slots;

CREATE POLICY "resource_date_disabled_slots_tenant_read"
  ON resource_date_disabled_slots FOR SELECT
  TO authenticated
  USING (is_resource_tenant_member(resource_id));

-- Note: resource_date_disabled_slots already has resource_date_disabled_slots_service_role policy.

-- ─── service_resources ───────────────────────────────────────────────────────
-- resource_id → resources.tenant_id

DROP POLICY IF EXISTS "service_resources_public_read" ON service_resources;

CREATE POLICY "service_resources_tenant_read"
  ON service_resources FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM resources r
    WHERE r.id = service_resources.resource_id
      AND is_tenant_member(r.tenant_id)
  ));

-- Note: service_resources already has service_resources_service_role policy.

-- ─── service_branches ────────────────────────────────────────────────────────
-- service_id → services.tenant_id

DROP POLICY IF EXISTS "service_branches_public_read" ON service_branches;

CREATE POLICY "service_branches_tenant_read"
  ON service_branches FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM services s
    WHERE s.id = service_branches.service_id
      AND is_tenant_member(s.tenant_id)
  ));

-- Note: service_branches already has service_branches_service_role policy.

-- ─── resource_categories ─────────────────────────────────────────────────────
-- resource_id → resources.tenant_id

DROP POLICY IF EXISTS "resource_categories_public_read" ON resource_categories;

CREATE POLICY "resource_categories_tenant_read"
  ON resource_categories FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM resources r
    WHERE r.id = resource_categories.resource_id
      AND is_tenant_member(r.tenant_id)
  ));

-- Note: resource_categories already has resource_categories_service_role policy.
