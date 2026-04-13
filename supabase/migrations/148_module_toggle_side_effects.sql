-- Trigger: side effects when tenant modules are toggled
-- Runs after UPDATE on tenants whenever the modules JSONB changes

CREATE OR REPLACE FUNCTION handle_module_toggle()
RETURNS trigger AS $$
BEGIN
  -- dineIn disabled → reset max_guests_auto in reservation_settings
  IF (OLD.modules->>'dineIn')::boolean IS DISTINCT FROM (NEW.modules->>'dineIn')::boolean
    AND (NEW.modules->>'dineIn')::boolean = false
  THEN
    UPDATE reservation_settings
    SET max_guests_auto = false
    WHERE tenant_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_module_toggle
  AFTER UPDATE OF modules ON tenants
  FOR EACH ROW
  WHEN (OLD.modules IS DISTINCT FROM NEW.modules)
  EXECUTE FUNCTION handle_module_toggle();
