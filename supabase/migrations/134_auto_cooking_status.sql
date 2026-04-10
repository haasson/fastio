-- Migration 134: Auto-advance order to "cooking" status
--
-- When the first kitchen_queue item of an order transitions from 'queued'
-- to 'in_progress' (chef claims) or 'done' (assembler collects skip_kitchen item),
-- automatically advance the order to the configured cookingStatusId.

CREATE OR REPLACE FUNCTION kitchen_queue_check_cooking_started()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _config        jsonb;
  _target_id     text;
  _tenant_id     uuid;
  _old_status    text;
  _old_name      text;
  _new_name      text;
  _already_started boolean;
BEGIN
  -- Only react to queued -> in_progress or queued -> done
  IF OLD.status != 'queued' OR NEW.status NOT IN ('in_progress', 'done') THEN
    RETURN NEW;
  END IF;

  -- Lock order row first to serialize concurrent claims on the same order
  SELECT t.kitchen_config, o.tenant_id, o.status
  INTO _config, _tenant_id, _old_status
  FROM orders o
  JOIN tenants t ON t.id = o.tenant_id
  WHERE o.id = NEW.order_id
  FOR UPDATE OF o;

  -- Check if any other item in this order already left 'queued' state
  -- (after lock, so we see committed changes from concurrent transactions)
  SELECT EXISTS (
    SELECT 1 FROM kitchen_queue
    WHERE order_id = NEW.order_id
      AND id != NEW.id
      AND status != 'queued'
  ) INTO _already_started;

  IF _already_started THEN
    RETURN NEW;
  END IF;

  _target_id := _config ->> 'cookingStatusId';

  IF _target_id IS NULL OR _target_id = _old_status THEN
    RETURN NEW;
  END IF;

  SELECT name INTO _old_name FROM order_statuses WHERE id = _old_status::uuid;
  SELECT name INTO _new_name FROM order_statuses WHERE id = _target_id::uuid;

  UPDATE orders SET status = _target_id WHERE id = NEW.order_id;

  INSERT INTO order_events (order_id, tenant_id, actor_id, actor_name, actor_role, event_type, meta)
  VALUES (
    NEW.order_id, _tenant_id, NULL, 'Кухня', NULL, 'status_changed',
    jsonb_build_object('from_id', _old_status, 'from_name', _old_name, 'to_id', _target_id, 'to_name', _new_name, 'auto', true)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_kitchen_queue_cooking_started
  AFTER UPDATE ON kitchen_queue
  FOR EACH ROW
  EXECUTE FUNCTION kitchen_queue_check_cooking_started();
