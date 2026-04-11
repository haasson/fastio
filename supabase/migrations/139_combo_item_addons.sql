ALTER TABLE combo_items
  ADD COLUMN IF NOT EXISTS addon_ids uuid[] NOT NULL DEFAULT '{}';
