-- ═══════════════════════════════════════════════════════════════════════════════
-- 318: billing_activate_plan — tenant-инициированная реактивация/выбор тарифа
--      из баланса для заблокированного тенанта.
--
-- Контекст: попав в status='suspended', тенант оказывался в тупике без выхода:
--   • billing_topup только плюсует баланс, не перепроверяет подписку;
--   • дневной крон billing-daily-charge и ручной триггер фильтруют
--     status IN ('active','past_due','trial') — suspended ИСКЛЮЧ�ён, поэтому
--     такой тенант больше никогда не списывается даже с достаточным балансом;
--   • billing_change_plan на тот же план кидает 'Already on this plan', а
--     даунгрейд не меняет статус → не разблокирует.
--
-- Решение: отдельный tenant-инициированный RPC — двойник кронового
-- billing_charge_subscription, но с caller-guard и явным выбором плана.
-- Семантика «оплати выбранный тариф с баланса и активируйся сейчас»:
-- работает для своего плана (реактивация) и для любого другого (смена),
-- из любого статуса.
--
-- Решения (зафиксированы в docs/plans/2026-06-09-billing-self-activate-design.md):
--   1. priceOverride: свой план → COALESCE(priceOverride, price) (договорённость
--      сохраняем, override не трогаем); другой план → price, override сбрасываем.
--   2. Даунгрейд ради разблокировки разрешён, но с тем же guard модульных
--      конфликтов, что в billing_change_plan (иначе уход на дешёвый план с
--      сохранением премиум-модулей).
--   3. Защита от двойного списания: status='active' + renewsAt в будущем →
--      'already_active' без списания (дабл-клик / лаг реалтайма).
--
-- Caller-guard — копия из billing_change_plan (266_billing_rpc_lockdown.sql):
-- service_role ИЛИ has_permission(_, 'billing.manage'). При правках сохранять.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.billing_activate_plan(p_tenant_id uuid, p_plan_key text, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant tenants;
  v_plan plans;
  v_current_key text;
  v_status text;
  v_price numeric;
  v_is_same boolean;
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
  v_status := v_tenant.subscription->>'status';
  v_is_same := (p_plan_key = v_current_key);

  SELECT * INTO v_plan FROM plans WHERE key = p_plan_key AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found or inactive: %', p_plan_key; END IF;

  -- ─── Только для заблокированных (Решение 3 + идемпотентность) ─────────────────
  -- Реактивация осмысленна лишь из suspended/past_due. Для active/trial/cancelled
  -- НЕ списываем: active продлевает крон, trial бесплатен (списание оборвало бы
  -- триал), смена тарифа — billing_change_plan. Заодно это защита от двойного
  -- списания: после первой активации status='active' → повторный/дабл-клик no-op.
  IF v_status NOT IN ('suspended', 'past_due') THEN
    RETURN 'already_active';
  END IF;

  -- ─── Решение 1: цена ─────────────────────────────────────────────────────────
  IF v_is_same THEN
    -- Свой план — сохраняем кастомную договорённость (priceOverride).
    v_price := COALESCE((v_tenant.subscription->>'priceOverride')::numeric, v_plan.price);
  ELSE
    -- Другой план — прайс плана, override сбросим при UPDATE.
    v_price := v_plan.price;
  END IF;

  -- ─── Решение 2: при смене плана не оставляем включёнными модули, требующие тир
  -- выше целевого плана. Проверку гоним ВСЕГДА при смене (не только на явном
  -- даунгрейде) — на апгрейде ни один модуль не требует тир выше целевого, так что
  -- условие просто не сработает; зато не зависим от резолва текущего плана.
  -- required_plan_key — короткий тир (pro/start), plans.key — полный
  -- ({business_type}-{tier}), поэтому матчим через business_type тенанта.
  IF NOT v_is_same THEN
    SELECT array_agg(mc.name)
    INTO v_conflicting_modules
    FROM module_configs mc
    LEFT JOIN plans rp ON rp.key = v_tenant.business_type || '-' || mc.required_plan_key
    WHERE mc.is_active = true
      AND (v_tenant.modules->>mc.key)::boolean IS TRUE
      AND COALESCE(rp.sort_order, 0) > v_plan.sort_order;

    IF array_length(v_conflicting_modules, 1) > 0 THEN
      RAISE EXCEPTION 'Невозможно перейти на тариф ниже. Сначала отключите модули: %', array_to_string(v_conflicting_modules, ', ');
    END IF;
  END IF;

  -- ─── Списание ────────────────────────────────────────────────────────────────
  IF v_tenant.balance < v_price THEN
    RAISE EXCEPTION 'Недостаточно средств. Необходимо: %, баланс: %', v_price, v_tenant.balance;
  END IF;

  SET LOCAL app.billing_function = 'true';
  UPDATE tenants
  SET balance = balance - v_price,
      subscription = (CASE WHEN v_is_same THEN subscription ELSE subscription - 'priceOverride' END)
        || jsonb_build_object(
          'plan', p_plan_key,
          'renewsAt', to_char(now() + interval '30 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'status', 'active',
          'pastDueAt', null
        )
  WHERE id = p_tenant_id;

  -- Бесплатный план (Витрина) — активируем без транзакции списания.
  IF v_price > 0 THEN
    INSERT INTO billing_transactions (tenant_id, type, amount, description, plan_id, created_by)
    VALUES (p_tenant_id, 'charge', -v_price, 'Активация тарифа: ' || v_plan.name, v_plan.id, v_actor_id);
  END IF;

  RETURN 'activated';
END;
$function$;

REVOKE ALL ON FUNCTION billing_activate_plan(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION billing_activate_plan(uuid, text, uuid) TO authenticated, service_role;
