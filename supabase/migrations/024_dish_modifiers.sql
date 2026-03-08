-- =============================================
-- Модификаторы блюд (размеры, варианты, бортики)
-- =============================================

-- 1. Группы модификаторов (шаблоны на уровне тенанта)
CREATE TABLE modifier_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Опции внутри группы (шаблон — без цен)
CREATE TABLE modifier_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Привязка группы модификаторов к блюду
CREATE TABLE dish_modifier_groups (
  dish_id uuid NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  PRIMARY KEY (dish_id, group_id)
);

-- 4. Привязка конкретных опций к блюду с ценами
CREATE TABLE dish_modifier_options (
  dish_id uuid NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES modifier_options(id) ON DELETE CASCADE,
  price_delta numeric NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  PRIMARY KEY (dish_id, option_id)
);

-- =============================================
-- Индексы
-- =============================================

CREATE INDEX idx_modifier_groups_tenant ON modifier_groups(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_modifier_options_group ON modifier_options(group_id);
CREATE INDEX idx_dish_modifier_groups_dish ON dish_modifier_groups(dish_id);
CREATE INDEX idx_dish_modifier_options_dish ON dish_modifier_options(dish_id);

-- =============================================
-- RLS
-- =============================================

ALTER TABLE modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE dish_modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE dish_modifier_options ENABLE ROW LEVEL SECURITY;

-- modifier_groups: public read (active, not deleted), member read all, manager+ write
CREATE POLICY "modifier_groups: public read"
  ON modifier_groups FOR SELECT
  USING (active = true AND deleted_at IS NULL);

CREATE POLICY "modifier_groups: member can select all"
  ON modifier_groups FOR SELECT
  USING (is_tenant_member(tenant_id));

CREATE POLICY "modifier_groups: manager can insert"
  ON modifier_groups FOR INSERT
  WITH CHECK (has_tenant_role(tenant_id, 'manager'));

CREATE POLICY "modifier_groups: manager can update"
  ON modifier_groups FOR UPDATE
  USING (has_tenant_role(tenant_id, 'manager'));

-- modifier_options: public read, manager+ write (через parent group)
CREATE POLICY "modifier_options: public read"
  ON modifier_options FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM modifier_groups
    WHERE id = group_id AND active = true AND deleted_at IS NULL
  ));

CREATE POLICY "modifier_options: member can select all"
  ON modifier_options FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM modifier_groups
    WHERE id = group_id AND is_tenant_member(tenant_id)
  ));

CREATE POLICY "modifier_options: manager can insert"
  ON modifier_options FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM modifier_groups
    WHERE id = group_id AND has_tenant_role(tenant_id, 'manager')
  ));

CREATE POLICY "modifier_options: manager can update"
  ON modifier_options FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM modifier_groups
    WHERE id = group_id AND has_tenant_role(tenant_id, 'manager')
  ));

CREATE POLICY "modifier_options: manager can delete"
  ON modifier_options FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM modifier_groups
    WHERE id = group_id AND has_tenant_role(tenant_id, 'manager')
  ));

-- dish_modifier_groups: public read, manager+ write (через dish)
CREATE POLICY "dish_modifier_groups: public read"
  ON dish_modifier_groups FOR SELECT
  USING (true);

CREATE POLICY "dish_modifier_groups: manager can insert"
  ON dish_modifier_groups FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM dishes d
    WHERE d.id = dish_id AND has_tenant_role(d.tenant_id, 'manager')
  ));

CREATE POLICY "dish_modifier_groups: manager can update"
  ON dish_modifier_groups FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM dishes d
    WHERE d.id = dish_id AND has_tenant_role(d.tenant_id, 'manager')
  ));

CREATE POLICY "dish_modifier_groups: manager can delete"
  ON dish_modifier_groups FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM dishes d
    WHERE d.id = dish_id AND has_tenant_role(d.tenant_id, 'manager')
  ));

-- dish_modifier_options: public read, manager+ write (через dish)
CREATE POLICY "dish_modifier_options: public read"
  ON dish_modifier_options FOR SELECT
  USING (true);

CREATE POLICY "dish_modifier_options: manager can insert"
  ON dish_modifier_options FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM dishes d
    WHERE d.id = dish_id AND has_tenant_role(d.tenant_id, 'manager')
  ));

CREATE POLICY "dish_modifier_options: manager can update"
  ON dish_modifier_options FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM dishes d
    WHERE d.id = dish_id AND has_tenant_role(d.tenant_id, 'manager')
  ));

CREATE POLICY "dish_modifier_options: manager can delete"
  ON dish_modifier_options FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM dishes d
    WHERE d.id = dish_id AND has_tenant_role(d.tenant_id, 'manager')
  ));
