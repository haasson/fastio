-- ═══════════════════════════════════════════════════════════════════════════════
-- Always-on branches: убираем branches из модулей, добавляем лимит в plans
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Добавляем колонку лимита филиалов в plans
ALTER TABLE plans ADD COLUMN max_branches int NOT NULL DEFAULT 0;
-- 0 = unlimited

-- start = 1 филиал, business/pro = unlimited
UPDATE plans SET max_branches = 1 WHERE key = 'start';
UPDATE plans SET max_branches = 0 WHERE key IN ('business', 'pro');

-- 2. Удаляем branches из module_configs (больше не модуль)
DELETE FROM module_configs WHERE key = 'branches';

-- 3. Убираем branches из modules у всех тенантов (чистим JSONB)
UPDATE tenants SET modules = modules - 'branches';

-- 4. Обновляем billing_change_plan — добавляем проверку лимита филиалов при даунгрейде
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
  v_actor_id uuid := COALESCE(auth.uid(), p_user_id);
  v_branch_count int;
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

  -- Проверка лимита филиалов при даунгрейде
  IF v_new_plan.max_branches > 0 THEN
    SELECT count(*) INTO v_branch_count
    FROM branches
    WHERE tenant_id = p_tenant_id AND archived_at IS NULL;

    IF v_branch_count > v_new_plan.max_branches THEN
      RAISE EXCEPTION 'Невозможно понизить тариф. У вас % активных филиалов, а на тарифе «%» доступно %. Архивируйте лишние филиалы.',
        v_branch_count, v_new_plan.name, v_new_plan.max_branches;
    END IF;
  END IF;

  -- Проверка конфликтующих модулей
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
  -- On downgrade, clear priceOverride
  UPDATE tenants SET subscription = jsonb_set(subscription - 'priceOverride', '{plan}', to_jsonb(p_new_plan_key))
  WHERE id = p_tenant_id;

  RETURN 'downgraded';
END;
$$;
