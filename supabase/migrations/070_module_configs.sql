-- ═══════════════════════════════════════════════════════════════════════════════
-- module_configs: конфигурация модулей (какой план нужен, порядок, иконки)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE module_configs (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '',
  required_plan_key text NOT NULL REFERENCES plans(key),
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

-- ─── Seed ───────────────────────────────────────────────────────────────────────

INSERT INTO module_configs (key, name, description, icon, required_plan_key, sort_order) VALUES
  ('delivery',    'Доставка',          'Принимать заказы с доставкой на адрес',                                                    'bike',       'business', 0),
  ('pickup',      'Самовывоз',         'Принимать заказы на самовывоз из ресторана',                                               'cart',       'business', 1),
  ('modifiers',   'Модификаторы',      'Дополнительные опции к блюдам (температура, прожарка и т.д.)',                              'list',       'business', 2),
  ('addons',      'Добавки',           'Дополнительные товары к заказу (соусы, напитки и т.д.)',                                    'plusRound',  'business', 3),
  ('promotions',  'Акции и промокоды', 'Скидки, промокоды и специальные предложения',                                              'promotions', 'business', 4),
  ('combos',      'Комбо',            'Комбо-наборы из нескольких блюд по специальной цене',                                       'dishes',     'business', 5),
  ('kitchen',     'Кухня',            'Экран для повара: заказы в реальном времени без лишнего интерфейса',                          'chefHat',    'business', 6),
  ('branches',    'Филиалы',          'Несколько точек приготовления и доставки с отдельными зонами и настройками',                  'mapPin',     'pro',      7),
  ('customRoles', 'Кастомные роли',   'Создавайте собственные роли сотрудников (Повар, Курьер, Кассир) с гибкими правами',           'users',      'pro',      8),
  ('dineIn',      'Заказ со стола',   'QR-код на столе — клиент сканирует и делает заказ с телефона прямо в заведении',              'tableIcon',  'pro',      9);

-- ─── RLS ────────────────────────────────────────────────────────────────────────

ALTER TABLE module_configs ENABLE ROW LEVEL SECURITY;

-- Чтение для всех
CREATE POLICY "module_configs_select" ON module_configs
  FOR SELECT USING (true);

-- Запись только через service_role (нет policy для INSERT/UPDATE/DELETE → запрещено для anon/authenticated)

-- ═══════════════════════════════════════════════════════════════════════════════
-- billing_change_plan: смена тарифа тенантом (обновлённая версия)
-- Теперь использует module_configs вместо захардкоженного списка модулей
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
