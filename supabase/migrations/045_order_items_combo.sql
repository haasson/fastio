ALTER TABLE order_items
  ADD COLUMN combo_id uuid REFERENCES combos(id) ON DELETE SET NULL;
