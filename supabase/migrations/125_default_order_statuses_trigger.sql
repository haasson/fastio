-- ─────────────────────────────────────
-- Auto-create default order statuses when a tenant is created
-- + prevent deleting the last status with group_type = 'new'
-- ─────────────────────────────────────

-- 1. Trigger: auto-create default statuses for new tenants
CREATE OR REPLACE FUNCTION create_default_order_statuses()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO order_statuses (tenant_id, name, group_type, position) VALUES
    (NEW.id, 'Новый',        'new',         0),
    (NEW.id, 'Принят',       'in_progress', 1),
    (NEW.id, 'Готовится',    'in_progress', 2),
    (NEW.id, 'Готов',        'in_progress', 3),
    (NEW.id, 'Доставляется', 'in_progress', 4),
    (NEW.id, 'Выполнен',     'completed',   5),
    (NEW.id, 'Отменён',      'cancelled',   6);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_default_order_statuses
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION create_default_order_statuses();

-- 2. Prevent deleting the last 'new' status for a tenant
CREATE OR REPLACE FUNCTION prevent_delete_last_new_status()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  remaining int;
BEGIN
  SELECT count(*) INTO remaining
  FROM order_statuses
  WHERE tenant_id = OLD.tenant_id
    AND group_type = 'new'
    AND id != OLD.id;

  IF OLD.group_type = 'new' AND remaining = 0 THEN
    RAISE EXCEPTION 'Нельзя удалить последний статус с типом "Новые"';
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_prevent_delete_last_new_status
  BEFORE DELETE ON order_statuses
  FOR EACH ROW
  EXECUTE FUNCTION prevent_delete_last_new_status();

-- 3. Backfill: add 'new' status for tenants that are missing one
INSERT INTO order_statuses (tenant_id, name, group_type, position)
SELECT t.id, 'Новый', 'new', 0
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM order_statuses os
  WHERE os.tenant_id = t.id AND os.group_type = 'new'
);
