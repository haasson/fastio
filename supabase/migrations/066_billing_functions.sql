-- ═══════════════════════════════════════════════════════════════════════════════
-- billing_topup: пополнение баланса тенанта (вызывается из бэкофиса)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION billing_topup(
  p_tenant_id uuid,
  p_amount numeric,
  p_description text DEFAULT '',
  p_admin_user_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx billing_transactions;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  UPDATE tenants SET balance = balance + p_amount WHERE id = p_tenant_id;

  INSERT INTO billing_transactions (tenant_id, type, amount, description, created_by)
  VALUES (p_tenant_id, 'topup', p_amount, COALESCE(p_description, ''), p_admin_user_id)
  RETURNING * INTO v_tx;

  RETURN row_to_json(v_tx);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- billing_charge_subscription: ежедневное списание / обработка просрочки
-- priceOverride in subscription JSON overrides plan price for this tenant
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
BEGIN
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
      jsonb_set(subscription, '{status}', '"past_due"'),
      '{pastDueAt}', to_jsonb(to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
    ) WHERE id = p_tenant_id;
    RETURN 'past_due';
  END IF;

  -- Already past_due: check grace period (3 days)
  IF v_past_due_at IS NOT NULL AND v_past_due_at + interval '3 days' < now() THEN
    SET LOCAL app.billing_function = 'true';
    UPDATE tenants SET subscription = jsonb_set(subscription, '{status}', '"suspended"')
    WHERE id = p_tenant_id;
    RETURN 'suspended';
  END IF;

  RETURN 'past_due_waiting';
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- billing_change_plan: смена тарифа тенантом
-- Uses priceOverride if set for the tenant
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION billing_change_plan(
  p_tenant_id uuid,
  p_new_plan_key text,
  p_user_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant tenants;
  v_current_plan plans;
  v_new_plan plans;
  v_current_key text;
  v_price numeric;
  v_conflicting_modules text[];
  v_module_key text;
  v_module_required_plan int;
BEGIN
  SELECT * INTO v_tenant FROM tenants WHERE id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tenant not found'; END IF;

  v_current_key := v_tenant.subscription->>'plan';

  IF v_current_key = p_new_plan_key THEN
    RAISE EXCEPTION 'Already on this plan';
  END IF;

  SELECT * INTO v_new_plan FROM plans WHERE key = p_new_plan_key AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found or inactive: %', p_new_plan_key; END IF;

  SELECT * INTO v_current_plan FROM plans WHERE key = v_current_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'Current plan not found: %', v_current_key; END IF;

  -- ─── Upgrade ────────────────────────────────────────────────────────────────
  IF v_new_plan.sort_order > v_current_plan.sort_order THEN
    -- For upgrade: use new plan price (priceOverride will apply after subscription update)
    v_price := v_new_plan.price;

    IF v_price > 0 THEN
      IF v_tenant.balance < v_price THEN
        RAISE EXCEPTION 'Недостаточно средств. Необходимо: %, баланс: %', v_price, v_tenant.balance;
      END IF;

      SET LOCAL app.billing_function = 'true';
      -- On upgrade, clear priceOverride (new plan = new pricing)
      UPDATE tenants
      SET balance = balance - v_price,
          subscription = jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  subscription - 'priceOverride',
                  '{plan}', to_jsonb(p_new_plan_key)
                ),
                '{renewsAt}', to_jsonb(to_char(now() + interval '30 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
              ),
              '{status}', '"active"'
            ),
            '{pastDueAt}', 'null'
          )
      WHERE id = p_tenant_id;

      INSERT INTO billing_transactions (tenant_id, type, amount, description, plan_id, created_by)
      VALUES (p_tenant_id, 'charge', -v_price, 'Смена тарифа: ' || v_current_plan.name || ' → ' || v_new_plan.name, v_new_plan.id, p_user_id);
    ELSE
      SET LOCAL app.billing_function = 'true';
      UPDATE tenants SET subscription = jsonb_set(
        jsonb_set(
          jsonb_set(
            subscription - 'priceOverride',
            '{plan}', to_jsonb(p_new_plan_key)
          ),
          '{status}', '"active"'
        ),
        '{pastDueAt}', 'null'
      ) WHERE id = p_tenant_id;
    END IF;

    RETURN 'upgraded';
  END IF;

  -- ─── Downgrade ──────────────────────────────────────────────────────────────
  v_conflicting_modules := ARRAY[]::text[];

  FOR v_module_key IN
    SELECT unnest(ARRAY['delivery','pickup','modifiers','addons','promotions','combos','kitchen','branches','customRoles','dineIn'])
  LOOP
    IF (v_tenant.modules->>v_module_key)::boolean IS TRUE THEN
      CASE v_module_key
        WHEN 'branches', 'customRoles', 'dineIn' THEN v_module_required_plan := 2;
        ELSE v_module_required_plan := 1;
      END CASE;

      IF v_module_required_plan > v_new_plan.sort_order THEN
        v_conflicting_modules := array_append(v_conflicting_modules,
          CASE v_module_key
            WHEN 'delivery' THEN 'Доставка'
            WHEN 'pickup' THEN 'Самовывоз'
            WHEN 'modifiers' THEN 'Модификаторы'
            WHEN 'addons' THEN 'Добавки'
            WHEN 'promotions' THEN 'Акции и промокоды'
            WHEN 'combos' THEN 'Комбо'
            WHEN 'kitchen' THEN 'Кухня'
            WHEN 'branches' THEN 'Филиалы'
            WHEN 'customRoles' THEN 'Кастомные роли'
            WHEN 'dineIn' THEN 'Заказ со стола'
            ELSE v_module_key
          END
        );
      END IF;
    END IF;
  END LOOP;

  IF array_length(v_conflicting_modules, 1) > 0 THEN
    RAISE EXCEPTION 'Невозможно понизить тариф. Сначала отключите модули: %', array_to_string(v_conflicting_modules, ', ');
  END IF;

  SET LOCAL app.billing_function = 'true';
  -- On downgrade, clear priceOverride
  UPDATE tenants SET subscription = jsonb_set(subscription - 'priceOverride', '{plan}', to_jsonb(p_new_plan_key))
  WHERE id = p_tenant_id;

  RETURN 'downgraded';
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- billing_set_price_override: установить кастомную цену для тенанта (бэкофис)
-- Pass NULL to remove override and revert to plan price
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION billing_set_price_override(
  p_tenant_id uuid,
  p_price numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SET LOCAL app.billing_function = 'true';

  IF p_price IS NULL THEN
    UPDATE tenants SET subscription = subscription - 'priceOverride'
    WHERE id = p_tenant_id;
  ELSE
    IF p_price < 0 THEN RAISE EXCEPTION 'Price cannot be negative'; END IF;
    UPDATE tenants SET subscription = jsonb_set(subscription, '{priceOverride}', to_jsonb(p_price))
    WHERE id = p_tenant_id;
  END IF;
END;
$$;
