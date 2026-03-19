-- Trigger: prevent tenants from directly modifying subscription/balance
CREATE OR REPLACE FUNCTION prevent_billing_self_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN RETURN NEW; END IF;
  IF current_setting('app.billing_function', true) = 'true' THEN RETURN NEW; END IF;

  IF NEW.subscription IS DISTINCT FROM OLD.subscription THEN
    RAISE EXCEPTION 'Cannot modify subscription directly';
  END IF;
  IF NEW.balance IS DISTINCT FROM OLD.balance THEN
    RAISE EXCEPTION 'Cannot modify balance directly';
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_prevent_billing_self_update
  BEFORE UPDATE ON tenants FOR EACH ROW
  EXECUTE FUNCTION prevent_billing_self_update();
