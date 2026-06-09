-- Migration 320: новое право kitchen.cook — отдельная «готовка».
--
-- Доступ к кухонной очереди (kitchen.view) и готовка (брать блюдо в работу,
-- отмечать готовым) разводятся: повар получает kitchen.cook, сборщик/менеджер
-- видят нагрузку (kitchen.view), но не берут блюда. Гейтинг — на фронте
-- (gate cookKitchen), RLS кухни по правам не режет, поэтому здесь только
-- дефолт-роли. Готовку из коробки получает только «Администратор»
-- (роль «может всё»); узкая роль «Повар» собирается из пресета.

-- 1. Триггер дефолт-ролей для новых тенантов — добавляем kitchen.cook Администратору.
CREATE OR REPLACE FUNCTION create_default_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO tenant_roles (tenant_id, name, is_default, permissions) VALUES
    (NEW.id, 'Администратор', true, '{"menu.view":true,"menu.edit":true,"menu.delete":true,"orders.view":true,"orders.create":true,"orders.edit":true,"orders.status":true,"orders.cancel":true,"kitchen.view":true,"kitchen.cook":true,"tables.view":true,"tables.manage":true,"appointments.view":true,"appointments.manage":true,"appointments.view_all":true,"promos.view":true,"promos.manage":true,"content.view":true,"content.edit":true,"team.view":true,"team.manage":true,"roles.manage":true,"settings.view":true,"settings.edit":true,"analytics.view":true}'),
    (NEW.id, 'Менеджер', true, '{"menu.view":true,"menu.edit":true,"menu.delete":true,"orders.view":true,"orders.create":true,"orders.edit":true,"orders.status":true,"orders.cancel":true,"kitchen.view":true,"tables.view":true,"tables.manage":true,"appointments.view":true,"appointments.manage":true,"appointments.view_all":true,"promos.view":true,"promos.manage":true,"content.view":true,"content.edit":true,"team.view":true,"settings.view":true,"analytics.view":true}'),
    (NEW.id, 'Сотрудник', true, '{"menu.view":true,"orders.view":true,"orders.create":true,"orders.edit":true,"orders.status":true,"kitchen.view":true,"tables.view":true,"appointments.view":true,"appointments.view_own":true}');
  RETURN NEW;
END;
$$;

-- 2. Бэкфилл: дефолтная роль «Администратор» уже созданных тенантов получает
--    kitchen.cook. Узкие/кастомные роли намеренно не трогаем — готовка
--    назначается осознанно.
UPDATE tenant_roles
SET permissions = permissions || '{"kitchen.cook":true}'::jsonb
WHERE is_default = true
  AND name = 'Администратор'
  AND COALESCE((permissions->>'kitchen.cook')::boolean, false) = false;
