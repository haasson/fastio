-- Migration 143: Track visited statuses on orders
--
-- Array of status IDs the order has been in. Used to warn operators
-- when they try to move an order back to a status it already visited.

ALTER TABLE orders ADD COLUMN visited_statuses text[] NOT NULL DEFAULT '{}';

-- ─── Trigger: append status to visited_statuses on change ─────────

CREATE OR REPLACE FUNCTION orders_track_visited_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NOT (NEW.status = ANY(NEW.visited_statuses)) THEN
    NEW.visited_statuses := array_append(NEW.visited_statuses, NEW.status);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_track_visited_status
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION orders_track_visited_status();

-- ─── Trigger: set initial status on insert ────────────────────────

CREATE OR REPLACE FUNCTION orders_init_visited_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status IS NOT NULL THEN
    NEW.visited_statuses := ARRAY[NEW.status];
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_init_visited_status
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION orders_init_visited_status();

-- ─── Backfill from order_events ───────────────────────────────────

UPDATE orders o SET visited_statuses = sq.statuses
FROM (
  SELECT
    order_id,
    array_agg(DISTINCT status ORDER BY status) AS statuses
  FROM (
    -- Initial status from order creation
    SELECT order_id, meta ->> 'statusId' AS status
    FROM order_events
    WHERE event_type = 'order_created' AND meta ->> 'statusId' IS NOT NULL
    UNION ALL
    -- All statuses the order transitioned to
    SELECT order_id, meta ->> 'to_id' AS status
    FROM order_events
    WHERE event_type = 'status_changed' AND meta ->> 'to_id' IS NOT NULL
  ) sub
  WHERE status IS NOT NULL
  GROUP BY order_id
) sq
WHERE o.id = sq.order_id;
