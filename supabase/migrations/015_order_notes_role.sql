ALTER TABLE order_notes
  ADD COLUMN IF NOT EXISTS author_role text NOT NULL DEFAULT 'staff';
