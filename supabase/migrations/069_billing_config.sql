-- ═══════════════════════════════════════════════════════════════════════════════
-- billing_config: singleton table for billing settings
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE billing_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  grace_period_days int NOT NULL DEFAULT 3
);

ALTER TABLE billing_config ENABLE ROW LEVEL SECURITY;

-- Read for authenticated users (admin needs to show banner)
CREATE POLICY "billing_config: anyone can select" ON billing_config
  FOR SELECT USING (true);

-- Write only via service_role (backoffice)

INSERT INTO billing_config (grace_period_days) VALUES (3);

-- ═══════════════════════════════════════════════════════════════════════════════
-- billing_charge_subscription: update to read grace_period_days from config
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION billing_charge_subscription(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant tenants;
  v_plan plans;
  v_price numeric;
  v_status text;
  v_renews_at timestamptz;
  v_past_due_at timestamptz;
  v_trial_ends_at timestamptz;
  v_grace_days int;
BEGIN
  -- Read grace period from config
  SELECT grace_period_days INTO v_grace_days FROM billing_config LIMIT 1;
  IF v_grace_days IS NULL THEN v_grace_days := 3; END IF;

  SELECT * INTO v_tenant FROM tenants WHERE id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tenant not found'; END IF;

  v_status := v_tenant.subscription->>'status';
  v_renews_at := (v_tenant.subscription->>'renewsAt')::timestamptz;
  v_past_due_at := (v_tenant.subscription->>'pastDueAt')::timestamptz;
  v_trial_ends_at := (v_tenant.subscription->>'trialEndsAt')::timestamptz;

  -- Find plan
  SELECT * INTO v_plan FROM plans WHERE key = v_tenant.subscription->>'plan' AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found: %', v_tenant.subscription->>'plan'; END IF;

  -- Use priceOverride if set, otherwise plan price
  v_price := COALESCE((v_tenant.subscription->>'priceOverride')::numeric, v_plan.price);

  -- Trial expired → treat as first charge
  IF v_status = 'trial' AND v_trial_ends_at IS NOT NULL AND v_trial_ends_at <= now() THEN
    v_status := 'active';
    v_renews_at := now();
  END IF;

  -- Not yet due (null renewsAt = never charged, treat as due)
  IF v_renews_at IS NOT NULL AND v_renews_at > now() AND v_status = 'active' THEN
    RETURN 'not_due';
  END IF;

  -- Free plan (or priceOverride=0): just extend
  IF v_price = 0 THEN
    SET LOCAL app.billing_function = 'true';
    UPDATE tenants SET subscription = jsonb_set(
      jsonb_set(subscription, '{renewsAt}', to_jsonb(to_char(now() + interval '30 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))),
      '{status}', '"active"'
    ) WHERE id = p_tenant_id;
    RETURN 'free';
  END IF;

  -- Enough balance → charge
  IF v_tenant.balance >= v_price THEN
    SET LOCAL app.billing_function = 'true';
    UPDATE tenants
    SET balance = balance - v_price,
        subscription = jsonb_set(
          jsonb_set(
            jsonb_set(subscription, '{renewsAt}', to_jsonb(to_char(now() + interval '30 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))),
            '{status}', '"active"'
          ),
          '{pastDueAt}', 'null'
        )
    WHERE id = p_tenant_id;

    INSERT INTO billing_transactions (tenant_id, type, amount, description, plan_id)
    VALUES (p_tenant_id, 'charge', -v_price, 'Ежемесячная подписка: ' || v_plan.name, v_plan.id);

    RETURN 'charged';
  END IF;

  -- Not enough balance: past_due or suspended
  IF v_status != 'past_due' THEN
    SET LOCAL app.billing_function = 'true';
    UPDATE tenants SET subscription = jsonb_set(
      jsonb_set(
        jsonb_set(subscription, '{status}', '"past_due"'),
        '{pastDueAt}', to_jsonb(to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
      ),
      '{gracePeriodDays}', to_jsonb(v_grace_days)
    ) WHERE id = p_tenant_id;
    RETURN 'past_due';
  END IF;

  -- Already past_due: check grace period
  IF v_past_due_at IS NOT NULL AND v_past_due_at + (v_grace_days || ' days')::interval < now() THEN
    SET LOCAL app.billing_function = 'true';
    UPDATE tenants SET subscription = jsonb_set(subscription, '{status}', '"suspended"')
    WHERE id = p_tenant_id;
    RETURN 'suspended';
  END IF;

  RETURN 'past_due_waiting';
END;
$$;
