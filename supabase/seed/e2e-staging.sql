-- =============================================================================
-- E2E STAGING SEED — минимальный набор фикстур для staging-окружения
-- =============================================================================
-- Один тенант с фиксированными UUID для воспроизводимости между прогонами.
-- Применяется Playwright globalSetup (setupStaging) перед каждым прогоном:
--   DELETE + psql -f e2e-staging.sql
-- Slug тенанта: "e2e" — не пересекается с локальными demo/services slug-ами.
-- Этот файл — минимальный staging seed. Только для E2E тестов (E2E-01, E2E-04).
-- =============================================================================

DO $$ DECLARE
  _owner_id  uuid := 'e2e00000-0000-0000-0000-000000000001';
  _tenant_id uuid := 'e2e00000-0000-0000-0000-000000000002';
  _branch_id uuid := 'e2e00000-0000-0000-0000-000000000003';
  _cat_id    uuid := 'e2e00000-0000-0000-0000-000000000004';
  _dish_id   uuid := 'e2e00000-0000-0000-0000-000000000005';
BEGIN

  -- ──────────────────────────────────────────────────────────────────────────
  -- auth.users: E2E owner с фиксированным паролем
  -- ON CONFLICT DO UPDATE — при повторном прогоне пересоздаёт пароль в known-good
  -- ──────────────────────────────────────────────────────────────────────────
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    aud,
    role,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    _owner_id,
    '00000000-0000-0000-0000-000000000000',
    'e2e@fastio.app',
    crypt('e2e-pass-12345', gen_salt('bf')),
    now(),
    'authenticated',
    'authenticated',
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    encrypted_password = crypt('e2e-pass-12345', gen_salt('bf')),
    email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now()),
    updated_at = now();

  -- ──────────────────────────────────────────────────────────────────────────
  -- tenants: один E2E тенант с минимально необходимыми полями
  -- onboarding_state = NULL → wizard показывается при первом входе (E2E-04)
  -- ──────────────────────────────────────────────────────────────────────────
  INSERT INTO tenants (
    id,
    owner_id,
    name,
    slug
  ) VALUES (
    _tenant_id,
    _owner_id,
    'E2E Tenant',
    'e2e'
  )
  ON CONFLICT (id) DO NOTHING;

  -- ──────────────────────────────────────────────────────────────────────────
  -- tenant_members: owner-роль для e2e пользователя
  -- ──────────────────────────────────────────────────────────────────────────
  INSERT INTO tenant_members (
    tenant_id,
    user_id,
    role
  ) VALUES (
    _tenant_id,
    _owner_id,
    'owner'
  )
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  -- ──────────────────────────────────────────────────────────────────────────
  -- branches: одна точка (нужна для order-flow E2E-01)
  -- ──────────────────────────────────────────────────────────────────────────
  INSERT INTO branches (
    id,
    tenant_id,
    name
  ) VALUES (
    _branch_id,
    _tenant_id,
    'E2E Branch'
  )
  ON CONFLICT (id) DO NOTHING;

  -- ──────────────────────────────────────────────────────────────────────────
  -- categories: одна категория (Pitfall 1 — нужна для E2E-04 шаг "настройка меню")
  -- ──────────────────────────────────────────────────────────────────────────
  INSERT INTO categories (
    id,
    tenant_id,
    name,
    sort_order,
    active
  ) VALUES (
    _cat_id,
    _tenant_id,
    'E2E Category',
    0,
    true
  )
  ON CONFLICT (id) DO NOTHING;

  -- ──────────────────────────────────────────────────────────────────────────
  -- dishes: одно блюдо (нужно для order-flow E2E-01 и онбординг E2E-04)
  -- ──────────────────────────────────────────────────────────────────────────
  INSERT INTO dishes (
    id,
    tenant_id,
    category_id,
    name,
    price
  ) VALUES (
    _dish_id,
    _tenant_id,
    _cat_id,
    'E2E Dish',
    100
  )
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'E2E staging seed applied: tenant=%, owner=%', _tenant_id, _owner_id;

END $$;
