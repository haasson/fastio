-- Migration 077: Add 'cancelled' status to kitchen_queue

ALTER TABLE kitchen_queue DROP CONSTRAINT IF EXISTS kitchen_queue_status_check;
ALTER TABLE kitchen_queue ADD CONSTRAINT kitchen_queue_status_check
  CHECK (status IN ('queued', 'in_progress', 'done', 'served', 'cancelled'));
