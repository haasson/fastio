-- Migration 142: Add kitchen_completed_at flag for assembly completion
--
-- kitchen_queued_at (migration 141) — set when kitchen queue populated
-- kitchen_completed_at — set when assembler clicks "Собрано"
-- Together they form the kitchen lifecycle:
--   queued_at set, completed_at null → order on kitchen, block manual moves
--   both set → kitchen done, free to move

ALTER TABLE orders ADD COLUMN kitchen_completed_at timestamptz;

-- Backfill: orders that already passed through kitchen (have served items, no active items)
UPDATE orders o SET kitchen_completed_at = kq.last_served
FROM (
  SELECT order_id, max(served_at) AS last_served
  FROM kitchen_queue
  WHERE status = 'served'
  GROUP BY order_id
  HAVING count(*) FILTER (WHERE status IN ('queued', 'in_progress')) = 0
) kq
WHERE o.id = kq.order_id
  AND o.kitchen_queued_at IS NOT NULL
  AND o.kitchen_completed_at IS NULL;
