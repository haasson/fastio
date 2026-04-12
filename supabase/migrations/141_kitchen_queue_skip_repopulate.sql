-- Migration 141: Prevent kitchen queue re-population for completed orders
--
-- Problem: when operator moves an order back to sourceStatusId after the kitchen
-- has finished, dishes can re-appear on the kitchen screen. The old idempotency
-- check (IF EXISTS kitchen_queue rows) fails if rows were cascade-deleted.
--
-- Fix: stamp orders.kitchen_queued_at on first queue population. The trigger
-- checks this flag instead of relying on kitchen_queue rows existing.

ALTER TABLE orders ADD COLUMN kitchen_queued_at timestamptz;

-- Backfill: mark orders that already have kitchen queue items
UPDATE orders SET kitchen_queued_at = kq.first_queued
FROM (
  SELECT order_id, min(created_at) AS first_queued
  FROM kitchen_queue
  GROUP BY order_id
) kq
WHERE orders.id = kq.order_id AND orders.kitchen_queued_at IS NULL;

-- ─── Switch trigger to BEFORE UPDATE so we can stamp NEW ──────────

DROP TRIGGER IF EXISTS trg_kitchen_queue_on_order_status ON orders;

CREATE OR REPLACE FUNCTION kitchen_queue_on_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _config     jsonb;
  _source_id  text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT kitchen_config INTO _config FROM tenants WHERE id = NEW.tenant_id;
  _source_id := _config ->> 'sourceStatusId';

  IF _source_id IS NULL OR NEW.status != _source_id THEN
    RETURN NEW;
  END IF;

  -- Already queued before — kitchen finished, don't re-populate
  IF NEW.kitchen_queued_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Stamp the order and populate kitchen queue
  NEW.kitchen_queued_at := now();
  PERFORM kitchen_queue_populate(NEW.id, NEW.tenant_id, NEW.delivery_type);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_kitchen_queue_on_order_status
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION kitchen_queue_on_order_status();
