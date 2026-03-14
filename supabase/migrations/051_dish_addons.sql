-- =============================================
-- Добавки к блюдам (самостоятельные платные позиции)
-- =============================================

-- 1. Каталог добавок (уровень тенанта)
CREATE TABLE addons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  weight      int,
  price       numeric NOT NULL DEFAULT 0,
  photo       text,
  active      boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0,
  deleted_at  timestamptz
);

-- 2. Пресеты (именованные наборы добавок)
CREATE TABLE addon_presets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       text NOT NULL,
  active     boolean NOT NULL DEFAULT true,
  deleted_at timestamptz
);

-- 3. Состав пресета
CREATE TABLE addon_preset_items (
  preset_id  uuid NOT NULL REFERENCES addon_presets(id) ON DELETE CASCADE,
  addon_id   uuid NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  PRIMARY KEY (preset_id, addon_id)
);

-- 4. Добавки на блюде
CREATE TABLE dish_addons (
  dish_id    uuid NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  addon_id   uuid NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  PRIMARY KEY (dish_id, addon_id)
);

-- =============================================
-- Индексы
-- =============================================

CREATE INDEX idx_addons_tenant ON addons(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_addon_presets_tenant ON addon_presets(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_addon_preset_items_preset ON addon_preset_items(preset_id);
CREATE INDEX idx_dish_addons_dish ON dish_addons(dish_id);

-- =============================================
-- Storage bucket для фото добавок
-- =============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('addon-images', 'addon-images', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "addon-images: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'addon-images');

CREATE POLICY "addon-images: manager can insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'addon-images' AND
    has_tenant_role(split_part(name, '/', 1)::uuid, 'manager')
  );

CREATE POLICY "addon-images: manager can delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'addon-images' AND
    has_tenant_role(split_part(name, '/', 1)::uuid, 'manager')
  );

-- =============================================
-- RLS
-- =============================================

ALTER TABLE addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE addon_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE addon_preset_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE dish_addons ENABLE ROW LEVEL SECURITY;

-- addons: public read (active, not deleted), member read all, manager+ write
CREATE POLICY "addons: public read"
  ON addons FOR SELECT
  USING (active = true AND deleted_at IS NULL);

CREATE POLICY "addons: member can select all"
  ON addons FOR SELECT
  USING (is_tenant_member(tenant_id));

CREATE POLICY "addons: manager can insert"
  ON addons FOR INSERT
  WITH CHECK (has_tenant_role(tenant_id, 'manager'));

CREATE POLICY "addons: manager can update"
  ON addons FOR UPDATE
  USING (has_tenant_role(tenant_id, 'manager'));

-- addon_presets: member read, manager+ write
CREATE POLICY "addon_presets: public read"
  ON addon_presets FOR SELECT
  USING (active = true AND deleted_at IS NULL);

CREATE POLICY "addon_presets: member can select all"
  ON addon_presets FOR SELECT
  USING (is_tenant_member(tenant_id));

CREATE POLICY "addon_presets: manager can insert"
  ON addon_presets FOR INSERT
  WITH CHECK (has_tenant_role(tenant_id, 'manager'));

CREATE POLICY "addon_presets: manager can update"
  ON addon_presets FOR UPDATE
  USING (has_tenant_role(tenant_id, 'manager'));

-- addon_preset_items: public read, manager+ write (через preset)
CREATE POLICY "addon_preset_items: public read"
  ON addon_preset_items FOR SELECT
  USING (true);

CREATE POLICY "addon_preset_items: manager can insert"
  ON addon_preset_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM addon_presets p
    WHERE p.id = preset_id AND has_tenant_role(p.tenant_id, 'manager')
  ));

CREATE POLICY "addon_preset_items: manager can delete"
  ON addon_preset_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM addon_presets p
    WHERE p.id = preset_id AND has_tenant_role(p.tenant_id, 'manager')
  ));

-- dish_addons: public read, manager+ write (через dish)
CREATE POLICY "dish_addons: public read"
  ON dish_addons FOR SELECT
  USING (true);

CREATE POLICY "dish_addons: manager can insert"
  ON dish_addons FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM dishes d
    WHERE d.id = dish_id AND has_tenant_role(d.tenant_id, 'manager')
  ));

CREATE POLICY "dish_addons: manager can delete"
  ON dish_addons FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM dishes d
    WHERE d.id = dish_id AND has_tenant_role(d.tenant_id, 'manager')
  ));
