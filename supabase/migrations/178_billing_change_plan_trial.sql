-- 178: billing_change_plan — на триале смена тарифа бесплатна, статус 'trial' и trialEndsAt не теряются.
-- Контракт: триал даётся один раз на первые DEFAULT_TRIAL_DAYS дней и распространяется на все тарифы.
-- В пределах триала юзер может менять тариф сколько угодно — без списаний и без увеличения trialEndsAt.

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
  v_on_trial boolean;
  v_conflicting_modules text[];
  v_actor_id uuid := COALESCE(auth.uid(), p_user_id);
BEGIN
  SELECT * INTO v_tenant FROM tenants WHERE id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tenant not found'; END IF;

  v_current_key := v_tenant.subscription->>'plan';
  v_on_trial := (v_tenant.subscription->>'status') = 'trial';

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

    IF v_price > 0 AND NOT v_on_trial THEN
      IF v_tenant.balance < v_price THEN
        RAISE EXCEPTION 'Недостаточно средств. Необходимо: %, баланс: %', v_price, v_tenant.balance;
      END IF;

      SET LOCAL app.billing_function = 'true';
      UPDATE tenants
      SET balance = balance - v_price,
          subscription = (subscription - 'priceOverride') || jsonb_build_object(
            'plan', p_new_plan_key,
            'renewsAt', to_char(now() + interval '30 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'status', 'active',
            'pastDueAt', null
          )
      WHERE id = p_tenant_id;

      INSERT INTO billing_transactions (tenant_id, type, amount, description, plan_id, created_by)
      VALUES (p_tenant_id, 'charge', -v_price, 'Смена тарифа: ' || v_current_plan.name || ' → ' || v_new_plan.name, v_new_plan.id, v_actor_id);
    ELSE
      -- Бесплатный план или триал — меняем план без списания.
      -- На триале сохраняем status='trial' (trialEndsAt не трогаем — триал не продлевается).
      SET LOCAL app.billing_function = 'true';
      UPDATE tenants
      SET subscription = (subscription - 'priceOverride') || jsonb_build_object(
            'plan', p_new_plan_key,
            'status', CASE WHEN v_on_trial THEN 'trial' ELSE 'active' END,
            'pastDueAt', null
          )
      WHERE id = p_tenant_id;
    END IF;

    RETURN 'upgraded';
  END IF;

  -- ─── Downgrade ──────────────────────────────────────────────────────────────

  -- Берём sort_order требуемого плана модуля из таблицы plans (а не магической CASE-карты).
  SELECT array_agg(mc.name)
  INTO v_conflicting_modules
  FROM module_configs mc
  LEFT JOIN plans rp ON rp.key = mc.required_plan_key
  WHERE mc.is_active = true
    AND (v_tenant.modules->>mc.key)::boolean IS TRUE
    AND COALESCE(rp.sort_order, 0) > v_new_plan.sort_order;

  IF array_length(v_conflicting_modules, 1) > 0 THEN
    RAISE EXCEPTION 'Невозможно понизить тариф. Сначала отключите модули: %', array_to_string(v_conflicting_modules, ', ');
  END IF;

  -- Понижение бесплатно. На триале сохраняем status='trial'; иначе — оставляем текущий статус.
  SET LOCAL app.billing_function = 'true';
  UPDATE tenants
  SET subscription = (subscription - 'priceOverride') || jsonb_build_object('plan', p_new_plan_key)
  WHERE id = p_tenant_id;

  RETURN 'downgraded';
END;
$function$;
