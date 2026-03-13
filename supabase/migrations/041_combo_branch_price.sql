-- combo_branch_settings: add price override support
ALTER TABLE combo_branch_settings
  ALTER COLUMN active DROP NOT NULL,
  ALTER COLUMN active DROP DEFAULT,
  ALTER COLUMN active SET DEFAULT NULL,
  ADD COLUMN price numeric DEFAULT NULL;
