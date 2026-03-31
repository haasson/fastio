-- ─────────────────────────────────────────────────────────────
-- Replace ALL has_tenant_role() RLS policies with has_permission()
-- ─────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════
-- TENANTS
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "tenants: admin can update" ON tenants;
CREATE POLICY "tenants: settings.edit can update"
  ON tenants FOR UPDATE
  USING (has_permission(id, 'settings.edit'));

-- ═══════════════════════════════════════
-- BRANCHES
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "admin+ can insert branches" ON branches;
DROP POLICY IF EXISTS "admin+ can update branches" ON branches;
DROP POLICY IF EXISTS "admin+ can delete branches" ON branches;

CREATE POLICY "branches: settings.edit can insert"
  ON branches FOR INSERT
  WITH CHECK (has_permission(tenant_id, 'settings.edit'));

CREATE POLICY "branches: settings.edit can update"
  ON branches FOR UPDATE
  USING (has_permission(tenant_id, 'settings.edit'));

CREATE POLICY "branches: settings.edit can delete"
  ON branches FOR DELETE
  USING (has_permission(tenant_id, 'settings.edit'));

-- ═══════════════════════════════════════
-- CATEGORIES
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "categories: manager can insert" ON categories;
DROP POLICY IF EXISTS "categories: manager can update" ON categories;

CREATE POLICY "categories: menu.edit can insert"
  ON categories FOR INSERT
  WITH CHECK (has_permission(tenant_id, 'menu.edit'));

CREATE POLICY "categories: menu.edit can update"
  ON categories FOR UPDATE
  USING (has_permission(tenant_id, 'menu.edit'));

CREATE POLICY "categories: menu.delete can delete"
  ON categories FOR DELETE
  USING (has_permission(tenant_id, 'menu.delete'));

-- ═══════════════════════════════════════
-- DISHES
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "dishes: manager can insert" ON dishes;
DROP POLICY IF EXISTS "dishes: manager can update" ON dishes;

CREATE POLICY "dishes: menu.edit can insert"
  ON dishes FOR INSERT
  WITH CHECK (has_permission(tenant_id, 'menu.edit'));

CREATE POLICY "dishes: menu.edit can update"
  ON dishes FOR UPDATE
  USING (has_permission(tenant_id, 'menu.edit'));

CREATE POLICY "dishes: menu.delete can delete"
  ON dishes FOR DELETE
  USING (has_permission(tenant_id, 'menu.delete'));

-- ═══════════════════════════════════════
-- MODIFIER_GROUPS
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "modifier_groups: manager can insert" ON modifier_groups;
DROP POLICY IF EXISTS "modifier_groups: manager can update" ON modifier_groups;

CREATE POLICY "modifier_groups: menu.edit can insert"
  ON modifier_groups FOR INSERT
  WITH CHECK (has_permission(tenant_id, 'menu.edit'));

CREATE POLICY "modifier_groups: menu.edit can update"
  ON modifier_groups FOR UPDATE
  USING (has_permission(tenant_id, 'menu.edit'));

-- ═══════════════════════════════════════
-- MODIFIER_OPTIONS
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "modifier_options: manager can insert" ON modifier_options;
DROP POLICY IF EXISTS "modifier_options: manager can update" ON modifier_options;
DROP POLICY IF EXISTS "modifier_options: manager can delete" ON modifier_options;

CREATE POLICY "modifier_options: menu.edit can insert"
  ON modifier_options FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM modifier_groups
    WHERE modifier_groups.id = modifier_options.group_id
      AND has_permission(modifier_groups.tenant_id, 'menu.edit')
  ));

CREATE POLICY "modifier_options: menu.edit can update"
  ON modifier_options FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM modifier_groups
    WHERE modifier_groups.id = modifier_options.group_id
      AND has_permission(modifier_groups.tenant_id, 'menu.edit')
  ));

CREATE POLICY "modifier_options: menu.edit can delete"
  ON modifier_options FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM modifier_groups
    WHERE modifier_groups.id = modifier_options.group_id
      AND has_permission(modifier_groups.tenant_id, 'menu.edit')
  ));

-- ═══════════════════════════════════════
-- DISH_MODIFIER_GROUPS
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "dish_modifier_groups: manager can insert" ON dish_modifier_groups;
DROP POLICY IF EXISTS "dish_modifier_groups: manager can update" ON dish_modifier_groups;
DROP POLICY IF EXISTS "dish_modifier_groups: manager can delete" ON dish_modifier_groups;

CREATE POLICY "dish_modifier_groups: menu.edit can insert"
  ON dish_modifier_groups FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM dishes d
    WHERE d.id = dish_modifier_groups.dish_id
      AND has_permission(d.tenant_id, 'menu.edit')
  ));

CREATE POLICY "dish_modifier_groups: menu.edit can update"
  ON dish_modifier_groups FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM dishes d
    WHERE d.id = dish_modifier_groups.dish_id
      AND has_permission(d.tenant_id, 'menu.edit')
  ));

CREATE POLICY "dish_modifier_groups: menu.edit can delete"
  ON dish_modifier_groups FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM dishes d
    WHERE d.id = dish_modifier_groups.dish_id
      AND has_permission(d.tenant_id, 'menu.edit')
  ));

-- ═══════════════════════════════════════
-- DISH_MODIFIER_OPTIONS
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "dish_modifier_options: manager can insert" ON dish_modifier_options;
DROP POLICY IF EXISTS "dish_modifier_options: manager can update" ON dish_modifier_options;
DROP POLICY IF EXISTS "dish_modifier_options: manager can delete" ON dish_modifier_options;

CREATE POLICY "dish_modifier_options: menu.edit can insert"
  ON dish_modifier_options FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM dishes d
    WHERE d.id = dish_modifier_options.dish_id
      AND has_permission(d.tenant_id, 'menu.edit')
  ));

CREATE POLICY "dish_modifier_options: menu.edit can update"
  ON dish_modifier_options FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM dishes d
    WHERE d.id = dish_modifier_options.dish_id
      AND has_permission(d.tenant_id, 'menu.edit')
  ));

CREATE POLICY "dish_modifier_options: menu.edit can delete"
  ON dish_modifier_options FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM dishes d
    WHERE d.id = dish_modifier_options.dish_id
      AND has_permission(d.tenant_id, 'menu.edit')
  ));

-- ═══════════════════════════════════════
-- ADDONS
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "addons: manager can insert" ON addons;
DROP POLICY IF EXISTS "addons: manager can update" ON addons;

CREATE POLICY "addons: menu.edit can insert"
  ON addons FOR INSERT
  WITH CHECK (has_permission(tenant_id, 'menu.edit'));

CREATE POLICY "addons: menu.edit can update"
  ON addons FOR UPDATE
  USING (has_permission(tenant_id, 'menu.edit'));

-- ═══════════════════════════════════════
-- ADDON_PRESETS
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "addon_presets: manager can insert" ON addon_presets;
DROP POLICY IF EXISTS "addon_presets: manager can update" ON addon_presets;

CREATE POLICY "addon_presets: menu.edit can insert"
  ON addon_presets FOR INSERT
  WITH CHECK (has_permission(tenant_id, 'menu.edit'));

CREATE POLICY "addon_presets: menu.edit can update"
  ON addon_presets FOR UPDATE
  USING (has_permission(tenant_id, 'menu.edit'));

-- ═══════════════════════════════════════
-- ADDON_PRESET_ITEMS
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "addon_preset_items: manager can insert" ON addon_preset_items;
DROP POLICY IF EXISTS "addon_preset_items: manager can delete" ON addon_preset_items;

CREATE POLICY "addon_preset_items: menu.edit can insert"
  ON addon_preset_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM addon_presets p
    WHERE p.id = addon_preset_items.preset_id
      AND has_permission(p.tenant_id, 'menu.edit')
  ));

CREATE POLICY "addon_preset_items: menu.edit can delete"
  ON addon_preset_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM addon_presets p
    WHERE p.id = addon_preset_items.preset_id
      AND has_permission(p.tenant_id, 'menu.edit')
  ));

-- ═══════════════════════════════════════
-- DISH_ADDONS
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "dish_addons: manager can insert" ON dish_addons;
DROP POLICY IF EXISTS "dish_addons: manager can delete" ON dish_addons;

CREATE POLICY "dish_addons: menu.edit can insert"
  ON dish_addons FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM dishes d
    WHERE d.id = dish_addons.dish_id
      AND has_permission(d.tenant_id, 'menu.edit')
  ));

CREATE POLICY "dish_addons: menu.edit can delete"
  ON dish_addons FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM dishes d
    WHERE d.id = dish_addons.dish_id
      AND has_permission(d.tenant_id, 'menu.edit')
  ));

-- ═══════════════════════════════════════
-- DISH_BRANCH_PRICES
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "manager+ can manage dish branch prices" ON dish_branch_prices;

CREATE POLICY "dish_branch_prices: menu.edit can manage"
  ON dish_branch_prices FOR ALL
  USING (has_permission((SELECT branches.tenant_id FROM branches WHERE branches.id = dish_branch_prices.branch_id), 'menu.edit'));

-- ═══════════════════════════════════════
-- COMBOS
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "combos: manager can insert" ON combos;
DROP POLICY IF EXISTS "combos: manager can update" ON combos;
DROP POLICY IF EXISTS "combos: manager can delete" ON combos;

CREATE POLICY "combos: menu.edit can insert"
  ON combos FOR INSERT
  WITH CHECK (has_permission(tenant_id, 'menu.edit'));

CREATE POLICY "combos: menu.edit can update"
  ON combos FOR UPDATE
  USING (has_permission(tenant_id, 'menu.edit'));

CREATE POLICY "combos: menu.delete can delete"
  ON combos FOR DELETE
  USING (has_permission(tenant_id, 'menu.delete'));

-- ═══════════════════════════════════════
-- COMBO_ITEMS
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "combo_items: manager can insert" ON combo_items;
DROP POLICY IF EXISTS "combo_items: manager can update" ON combo_items;
DROP POLICY IF EXISTS "combo_items: manager can delete" ON combo_items;

CREATE POLICY "combo_items: menu.edit can insert"
  ON combo_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM combos c
    WHERE c.id = combo_items.combo_id
      AND has_permission(c.tenant_id, 'menu.edit')
  ));

CREATE POLICY "combo_items: menu.edit can update"
  ON combo_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM combos c
    WHERE c.id = combo_items.combo_id
      AND has_permission(c.tenant_id, 'menu.edit')
  ));

CREATE POLICY "combo_items: menu.edit can delete"
  ON combo_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM combos c
    WHERE c.id = combo_items.combo_id
      AND has_permission(c.tenant_id, 'menu.edit')
  ));

-- ═══════════════════════════════════════
-- DISH_TAGS
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "dish_tags: manager can insert" ON dish_tags;
DROP POLICY IF EXISTS "dish_tags: manager can update" ON dish_tags;
DROP POLICY IF EXISTS "dish_tags: manager can delete" ON dish_tags;

CREATE POLICY "dish_tags: menu.edit can insert"
  ON dish_tags FOR INSERT
  WITH CHECK (has_permission(tenant_id, 'menu.edit'));

CREATE POLICY "dish_tags: menu.edit can update"
  ON dish_tags FOR UPDATE
  USING (has_permission(tenant_id, 'menu.edit'));

CREATE POLICY "dish_tags: menu.edit can delete"
  ON dish_tags FOR DELETE
  USING (has_permission(tenant_id, 'menu.edit'));

-- ═══════════════════════════════════════
-- DISH_TAG_ASSIGNMENTS
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "dta: manager can insert" ON dish_tag_assignments;
DROP POLICY IF EXISTS "dta: manager can update" ON dish_tag_assignments;
DROP POLICY IF EXISTS "dta: manager can delete" ON dish_tag_assignments;

CREATE POLICY "dta: menu.edit can insert"
  ON dish_tag_assignments FOR INSERT
  WITH CHECK (has_permission(tenant_id, 'menu.edit'));

CREATE POLICY "dta: menu.edit can update"
  ON dish_tag_assignments FOR UPDATE
  USING (has_permission(tenant_id, 'menu.edit'));

CREATE POLICY "dta: menu.edit can delete"
  ON dish_tag_assignments FOR DELETE
  USING (has_permission(tenant_id, 'menu.edit'));

-- ═══════════════════════════════════════
-- COMBO_TAG_ASSIGNMENTS
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "cta: manager can insert" ON combo_tag_assignments;
DROP POLICY IF EXISTS "cta: manager can delete" ON combo_tag_assignments;

CREATE POLICY "cta: menu.edit can insert"
  ON combo_tag_assignments FOR INSERT
  WITH CHECK (has_permission(tenant_id, 'menu.edit'));

CREATE POLICY "cta: menu.edit can delete"
  ON combo_tag_assignments FOR DELETE
  USING (has_permission(tenant_id, 'menu.edit'));

-- ═══════════════════════════════════════
-- ORDER_STATUSES
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "manager+ can insert order statuses" ON order_statuses;
DROP POLICY IF EXISTS "manager+ can update order statuses" ON order_statuses;
DROP POLICY IF EXISTS "manager+ can delete order statuses" ON order_statuses;

CREATE POLICY "order_statuses: settings.edit can insert"
  ON order_statuses FOR INSERT
  WITH CHECK (has_permission(tenant_id, 'settings.edit'));

CREATE POLICY "order_statuses: settings.edit can update"
  ON order_statuses FOR UPDATE
  USING (has_permission(tenant_id, 'settings.edit'));

CREATE POLICY "order_statuses: settings.edit can delete"
  ON order_statuses FOR DELETE
  USING (has_permission(tenant_id, 'settings.edit'));

-- ═══════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "tables: manager can insert" ON tables;
DROP POLICY IF EXISTS "tables: manager can update" ON tables;
DROP POLICY IF EXISTS "tables: manager can delete" ON tables;

CREATE POLICY "tables: settings.edit can insert"
  ON tables FOR INSERT
  WITH CHECK (has_permission(tenant_id, 'settings.edit'));

CREATE POLICY "tables: settings.edit can update"
  ON tables FOR UPDATE
  USING (has_permission(tenant_id, 'settings.edit'));

CREATE POLICY "tables: settings.edit can delete"
  ON tables FOR DELETE
  USING (has_permission(tenant_id, 'settings.edit'));

-- ═══════════════════════════════════════
-- TABLE_CALL_TYPES
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "table_call_types: manager can insert" ON table_call_types;
DROP POLICY IF EXISTS "table_call_types: manager can update" ON table_call_types;
DROP POLICY IF EXISTS "table_call_types: manager can delete" ON table_call_types;

CREATE POLICY "table_call_types: settings.edit can insert"
  ON table_call_types FOR INSERT
  WITH CHECK (has_permission(tenant_id, 'settings.edit'));

CREATE POLICY "table_call_types: settings.edit can update"
  ON table_call_types FOR UPDATE
  USING (has_permission(tenant_id, 'settings.edit'));

CREATE POLICY "table_call_types: settings.edit can delete"
  ON table_call_types FOR DELETE
  USING (has_permission(tenant_id, 'settings.edit'));

-- ═══════════════════════════════════════
-- PROMOTIONS
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "promotions: manager can insert" ON promotions;
DROP POLICY IF EXISTS "promotions: manager can update" ON promotions;
DROP POLICY IF EXISTS "promotions: manager can delete" ON promotions;

CREATE POLICY "promotions: promos.manage can insert"
  ON promotions FOR INSERT
  WITH CHECK (has_permission(tenant_id, 'promos.manage'));

CREATE POLICY "promotions: promos.manage can update"
  ON promotions FOR UPDATE
  USING (has_permission(tenant_id, 'promos.manage'));

CREATE POLICY "promotions: promos.manage can delete"
  ON promotions FOR DELETE
  USING (has_permission(tenant_id, 'promos.manage'));

-- ═══════════════════════════════════════
-- PROMO_CODES
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "promo_codes: manager can insert" ON promo_codes;
DROP POLICY IF EXISTS "promo_codes: manager can update" ON promo_codes;
DROP POLICY IF EXISTS "promo_codes: manager can delete" ON promo_codes;

CREATE POLICY "promo_codes: promos.manage can insert"
  ON promo_codes FOR INSERT
  WITH CHECK (has_permission(tenant_id, 'promos.manage'));

CREATE POLICY "promo_codes: promos.manage can update"
  ON promo_codes FOR UPDATE
  USING (has_permission(tenant_id, 'promos.manage'));

CREATE POLICY "promo_codes: promos.manage can delete"
  ON promo_codes FOR DELETE
  USING (has_permission(tenant_id, 'promos.manage'));

-- ═══════════════════════════════════════
-- BANNERS
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "banners: manager can insert" ON banners;
DROP POLICY IF EXISTS "banners: manager can update" ON banners;
DROP POLICY IF EXISTS "banners: manager can delete" ON banners;

CREATE POLICY "banners: promos.manage can insert"
  ON banners FOR INSERT
  WITH CHECK (has_permission(tenant_id, 'promos.manage'));

CREATE POLICY "banners: promos.manage can update"
  ON banners FOR UPDATE
  USING (has_permission(tenant_id, 'promos.manage'));

CREATE POLICY "banners: promos.manage can delete"
  ON banners FOR DELETE
  USING (has_permission(tenant_id, 'promos.manage'));

-- ═══════════════════════════════════════
-- GALLERIES
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "galleries: manager can insert" ON galleries;
DROP POLICY IF EXISTS "galleries: manager can update" ON galleries;
DROP POLICY IF EXISTS "galleries: manager can delete" ON galleries;

CREATE POLICY "galleries: settings.edit can insert"
  ON galleries FOR INSERT
  WITH CHECK (has_permission(tenant_id, 'settings.edit'));

CREATE POLICY "galleries: settings.edit can update"
  ON galleries FOR UPDATE
  USING (has_permission(tenant_id, 'settings.edit'));

CREATE POLICY "galleries: settings.edit can delete"
  ON galleries FOR DELETE
  USING (has_permission(tenant_id, 'settings.edit'));

-- ═══════════════════════════════════════
-- GALLERY_PHOTOS
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "gallery_photos: manager can insert" ON gallery_photos;
DROP POLICY IF EXISTS "gallery_photos: manager can update" ON gallery_photos;
DROP POLICY IF EXISTS "gallery_photos: manager can delete" ON gallery_photos;

CREATE POLICY "gallery_photos: settings.edit can insert"
  ON gallery_photos FOR INSERT
  WITH CHECK (has_permission(tenant_id, 'settings.edit'));

CREATE POLICY "gallery_photos: settings.edit can update"
  ON gallery_photos FOR UPDATE
  USING (has_permission(tenant_id, 'settings.edit'));

CREATE POLICY "gallery_photos: settings.edit can delete"
  ON gallery_photos FOR DELETE
  USING (has_permission(tenant_id, 'settings.edit'));

-- ═══════════════════════════════════════
-- TENANT_MEMBERS
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "tenant_members: admin can insert" ON tenant_members;
DROP POLICY IF EXISTS "tenant_members: admin can update" ON tenant_members;
DROP POLICY IF EXISTS "tenant_members: admin can delete" ON tenant_members;

CREATE POLICY "tenant_members: team.manage can insert"
  ON tenant_members FOR INSERT
  WITH CHECK (has_permission(tenant_id, 'team.manage'));

CREATE POLICY "tenant_members: team.manage can update"
  ON tenant_members FOR UPDATE
  USING (has_permission(tenant_id, 'team.manage'));

CREATE POLICY "tenant_members: team.manage can delete"
  ON tenant_members FOR DELETE
  USING (has_permission(tenant_id, 'team.manage'));

-- ═══════════════════════════════════════
-- TENANT_INVITATIONS
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "tenant_invitations: admin can select" ON tenant_invitations;
DROP POLICY IF EXISTS "tenant_invitations: admin can insert" ON tenant_invitations;
DROP POLICY IF EXISTS "tenant_invitations: admin can update" ON tenant_invitations;
DROP POLICY IF EXISTS "tenant_invitations: admin can delete" ON tenant_invitations;

CREATE POLICY "tenant_invitations: team.manage can select"
  ON tenant_invitations FOR SELECT
  USING (has_permission(tenant_id, 'team.manage'));

CREATE POLICY "tenant_invitations: team.manage can insert"
  ON tenant_invitations FOR INSERT
  WITH CHECK (has_permission(tenant_id, 'team.manage'));

CREATE POLICY "tenant_invitations: team.manage can update"
  ON tenant_invitations FOR UPDATE
  USING (has_permission(tenant_id, 'team.manage'));

CREATE POLICY "tenant_invitations: team.manage can delete"
  ON tenant_invitations FOR DELETE
  USING (has_permission(tenant_id, 'team.manage'));

-- ═══════════════════════════════════════
-- TENANT_ROLES — update to use has_permission
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "tenant_roles: admin can insert" ON tenant_roles;
DROP POLICY IF EXISTS "tenant_roles: admin can update" ON tenant_roles;
DROP POLICY IF EXISTS "tenant_roles: admin can delete" ON tenant_roles;

CREATE POLICY "tenant_roles: roles.manage can insert"
  ON tenant_roles FOR INSERT
  WITH CHECK (has_permission(tenant_id, 'roles.manage'));

CREATE POLICY "tenant_roles: roles.manage can update"
  ON tenant_roles FOR UPDATE
  USING (has_permission(tenant_id, 'roles.manage'));

CREATE POLICY "tenant_roles: roles.manage can delete"
  ON tenant_roles FOR DELETE
  USING (has_permission(tenant_id, 'roles.manage'));

-- ═══════════════════════════════════════
-- STORAGE: dish-images
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "dish-images: manager can insert" ON storage.objects;
DROP POLICY IF EXISTS "dish-images: manager can delete" ON storage.objects;

CREATE POLICY "dish-images: menu.edit can insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'dish-images'
    AND has_permission((split_part(name, '/', 1))::uuid, 'menu.edit')
  );

CREATE POLICY "dish-images: menu.edit can delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'dish-images'
    AND has_permission((split_part(name, '/', 1))::uuid, 'menu.edit')
  );

-- ═══════════════════════════════════════
-- STORAGE: addon-images
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "addon-images: manager can insert" ON storage.objects;
DROP POLICY IF EXISTS "addon-images: manager can delete" ON storage.objects;

CREATE POLICY "addon-images: menu.edit can insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'addon-images'
    AND has_permission((split_part(name, '/', 1))::uuid, 'menu.edit')
  );

CREATE POLICY "addon-images: menu.edit can delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'addon-images'
    AND has_permission((split_part(name, '/', 1))::uuid, 'menu.edit')
  );

-- ═══════════════════════════════════════
-- STORAGE: tenant-assets
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "tenant-assets: manager can insert" ON storage.objects;
DROP POLICY IF EXISTS "tenant-assets: manager can update" ON storage.objects;
DROP POLICY IF EXISTS "tenant-assets: manager can delete" ON storage.objects;

CREATE POLICY "tenant-assets: settings.edit can insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'tenant-assets'
    AND has_permission((split_part(name, '/', 1))::uuid, 'settings.edit')
  );

CREATE POLICY "tenant-assets: settings.edit can update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'tenant-assets'
    AND has_permission((split_part(name, '/', 1))::uuid, 'settings.edit')
  );

CREATE POLICY "tenant-assets: settings.edit can delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'tenant-assets'
    AND has_permission((split_part(name, '/', 1))::uuid, 'settings.edit')
  );
