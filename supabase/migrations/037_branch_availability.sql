-- dish_branch_prices: make price nullable, add active override
ALTER TABLE dish_branch_prices
  ALTER COLUMN price DROP NOT NULL,
  ADD COLUMN active boolean DEFAULT NULL;

-- combo_branch_settings: per-branch availability for combos
CREATE TABLE combo_branch_settings (
  combo_id uuid REFERENCES combos(id) ON DELETE CASCADE NOT NULL,
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
  active boolean NOT NULL DEFAULT false,
  PRIMARY KEY (combo_id, branch_id)
);

ALTER TABLE combo_branch_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members can manage combo_branch_settings"
  ON combo_branch_settings
  USING (
    EXISTS (
      SELECT 1 FROM combos c
      JOIN tenant_members tm ON tm.tenant_id = c.tenant_id
      WHERE c.id = combo_branch_settings.combo_id
        AND tm.user_id = auth.uid()
    )
  );
