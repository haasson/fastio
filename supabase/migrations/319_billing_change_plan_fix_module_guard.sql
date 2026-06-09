-- ═══════════════════════════════════════════════════════════════════════════════
-- 319: Чиним мёртвый guard модульных конфликтов при даунгрейде в billing_change_plan.
--
-- Баг: ветка downgrade джойнила `plans rp ON rp.key = mc.required_plan_key`, но
-- module_configs.required_plan_key хранит КОРОТКИЙ тир (pro/start), а plans.key —
-- полный ({business_type}-{tier}, напр. retail-pro). JOIN не матчился →
-- rp.sort_order всегда NULL → COALESCE(...,0) > v_new_plan.sort_order никогда не
-- истинно → guard НИКОГДА не срабатывал. Тенант мог понизить тариф, сохранив
-- премиум-модули (по факту useGate их всё равно гейтил в рантайме, но DB-проверка
-- была театром). См. TECHDEBT.
--
-- Фикс: матчим тир через business_type тенанта —
--   rp.key = v_tenant.business_type || '-' || mc.required_plan_key.
--
-- Тело функции — копия из 266_billing_rpc_lockdown.sql; единственное отличие —
-- строка JOIN в downgrade-ветке. Caller-guard и остальная логика сохранены.
-- Тот же фикс применён в billing_activate_plan (318).
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
  v_on_trial boolean;
  v_conflicting_modules text[];
  v_actor_id uuid := COALESCE(auth.uid(), p_user_id);
BEGIN
  -- ─── Caller authorization ─────────────────────────────────────────────────
  -- IS DISTINCT FROM критично: auth.role() = NULL при отсутствии JWT, а
  -- `NULL <> 'service_role'` даёт NULL (не TRUE) → guard молча пропускал бы.
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NOT has_permission(p_tenant_id, 'billing.manage') THEN
    RAISE EXCEPTION 'forbidden: billing.manage permission required';
  END IF;

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

  -- required_plan_key хранит короткий тир (pro/start), а plans.key — полный
  -- ({business_type}-{tier}), поэтому матчим через business_type тенанта.
  SELECT array_agg(mc.name)
  INTO v_conflicting_modules
  FROM module_configs mc
  LEFT JOIN plans rp ON rp.key = v_tenant.business_type || '-' || mc.required_plan_key
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

REVOKE ALL ON FUNCTION billing_change_plan(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION billing_change_plan(uuid, text, uuid) TO authenticated, service_role;
