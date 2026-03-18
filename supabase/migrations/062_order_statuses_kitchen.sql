ALTER TABLE order_statuses
  ADD COLUMN IF NOT EXISTS kitchen_visible BOOLEAN NOT NULL DEFAULT false;

-- Enable kitchen_visible for 'new' and 'in_progress' groups by default
UPDATE order_statuses
SET kitchen_visible = true
WHERE group_type IN ('new', 'in_progress');
