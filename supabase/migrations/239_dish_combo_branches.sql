-- Junction "блюдо ↔ филиал". Пусто = во всех филиалах (как у service_branches).
CREATE TABLE dish_branches (
  dish_id   uuid NOT NULL REFERENCES dishes(id)   ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  PRIMARY KEY (dish_id, branch_id)
);

CREATE INDEX idx_dish_branches_branch ON dish_branches(branch_id);

ALTER TABLE dish_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dish_branches_tenant_member"
  ON dish_branches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dishes d
      JOIN tenant_members tm ON tm.tenant_id = d.tenant_id
      WHERE d.id = dish_branches.dish_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "dish_branches_service_role"
  ON dish_branches FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "dish_branches_public_read"
  ON dish_branches FOR SELECT USING (true);

-- Аналогичный junction для комбо. Старая combo_branch_settings (миграция 037) была дропнута
-- в 129_drop_branch_availability.sql — здесь возвращаем per-branch availability в новом паттерне
-- (junction-таблица, пусто = во всех филиалах).
CREATE TABLE combo_branches (
  combo_id  uuid NOT NULL REFERENCES combos(id)   ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  PRIMARY KEY (combo_id, branch_id)
);

CREATE INDEX idx_combo_branches_branch ON combo_branches(branch_id);

ALTER TABLE combo_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "combo_branches_tenant_member"
  ON combo_branches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM combos c
      JOIN tenant_members tm ON tm.tenant_id = c.tenant_id
      WHERE c.id = combo_branches.combo_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "combo_branches_service_role"
  ON combo_branches FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "combo_branches_public_read"
  ON combo_branches FOR SELECT USING (true);
