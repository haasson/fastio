-- ═══════════════════════════════════════════════════════════════════════════════
-- 165: Fix billing_change_plan — remove max_branches reference (column removed)
-- Branch limits are now enforced via the branches module in plan features
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.billing_change_plan(p_tenant_id uuid, p_new_plan_key text, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant tenants;
  v_current_plan plans;
  v_new_plan plans;
  v_current_key text;
  v_price numeric;
  v_conflicting_modules text[];
  v_actor_id uuid := COALESCE(auth.uid(), p_user_id);
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
    v_price := v_new_plan.price;

    IF v_price > 0 THEN
      IF v_tenant.balance < v_price THEN
        RAISE EXCEPTION 'Недостаточно средств. Необходимо: %, баланс: %', v_price, v_tenant.balance;
      END IF;

      SET LOCAL app.billing_function = 'true';
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
      VALUES (p_tenant_id, 'charge', -v_price, 'Смена тарифа: ' || v_current_plan.name || ' → ' || v_new_plan.name, v_new_plan.id, v_actor_id);
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

  -- Module conflict check: if tenant has modules enabled that require a higher plan
  SELECT array_agg(mc.name)
  INTO v_conflicting_modules
  FROM module_configs mc
  JOIN plans p ON p.key = mc.required_plan_key
  WHERE mc.is_active = true
    AND (v_tenant.modules->>mc.key)::boolean IS TRUE
    AND p.sort_order > v_new_plan.sort_order;

  IF array_length(v_conflicting_modules, 1) > 0 THEN
    RAISE EXCEPTION 'Невозможно понизить тариф. Сначала отключите модули: %', array_to_string(v_conflicting_modules, ', ');
  END IF;

  SET LOCAL app.billing_function = 'true';
  UPDATE tenants SET subscription = jsonb_set(subscription - 'priceOverride', '{plan}', to_jsonb(p_new_plan_key))
  WHERE id = p_tenant_id;

  RETURN 'downgraded';
END;
$function$;
