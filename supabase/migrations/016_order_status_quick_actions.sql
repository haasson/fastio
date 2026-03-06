ALTER TABLE order_statuses
  ADD COLUMN quick_actions jsonb NOT NULL DEFAULT '[]'::jsonb;
