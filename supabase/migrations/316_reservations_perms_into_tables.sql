-- Migration 316: права на брони схлопываются в права модуля «Столы»
--
-- reservations.view / reservations.manage больше не существуют. Брони — часть
-- модуля «Столы» (dineIn), поэтому:
--   • данные броней (таблица reservations) — под tables.view / tables.manage;
--   • настройки броней (reservation_settings) и настройки столов (table_settings)
--     — под settings.edit, как ВСЕ остальные настройки (tenants/branches/order_statuses,
--     см. миграцию 109). Раньше table_settings сидел на tables.manage, а
--     reservation_settings — на reservations.manage; обе аномалии чиним.

-- 1. RLS: данные броней (reservations) — управление под tables.manage.
DROP POLICY IF EXISTS reservations_insert_manage ON public.reservations;
CREATE POLICY reservations_insert_manage ON public.reservations
  FOR INSERT WITH CHECK (has_permission(tenant_id, 'tables.manage'));

DROP POLICY IF EXISTS reservations_update_manage ON public.reservations;
CREATE POLICY reservations_update_manage ON public.reservations
  FOR UPDATE USING (has_permission(tenant_id, 'tables.manage'))
              WITH CHECK (has_permission(tenant_id, 'tables.manage'));

DROP POLICY IF EXISTS reservations_delete_manage ON public.reservations;
CREATE POLICY reservations_delete_manage ON public.reservations
  FOR DELETE USING (has_permission(tenant_id, 'tables.manage'));

-- 2. RLS: настройки броней (reservation_settings) — под settings.edit.
DROP POLICY IF EXISTS reservation_settings_insert_manage ON public.reservation_settings;
CREATE POLICY reservation_settings_insert_manage ON public.reservation_settings
  FOR INSERT WITH CHECK (has_permission(tenant_id, 'settings.edit'));

DROP POLICY IF EXISTS reservation_settings_update_manage ON public.reservation_settings;
CREATE POLICY reservation_settings_update_manage ON public.reservation_settings
  FOR UPDATE USING (has_permission(tenant_id, 'settings.edit'))
              WITH CHECK (has_permission(tenant_id, 'settings.edit'));

DROP POLICY IF EXISTS reservation_settings_delete_manage ON public.reservation_settings;
CREATE POLICY reservation_settings_delete_manage ON public.reservation_settings
  FOR DELETE USING (has_permission(tenant_id, 'settings.edit'));

-- 3. RLS: настройки столов (table_settings) — тоже под settings.edit (было tables.manage).
DROP POLICY IF EXISTS "table_settings: tables.manage can insert" ON public.table_settings;
DROP POLICY IF EXISTS "table_settings: settings.edit can insert" ON public.table_settings;
CREATE POLICY "table_settings: settings.edit can insert" ON public.table_settings
  FOR INSERT WITH CHECK (has_permission(tenant_id, 'settings.edit'));

DROP POLICY IF EXISTS "table_settings: tables.manage can update" ON public.table_settings;
DROP POLICY IF EXISTS "table_settings: settings.edit can update" ON public.table_settings;
CREATE POLICY "table_settings: settings.edit can update" ON public.table_settings
  FOR UPDATE USING (has_permission(tenant_id, 'settings.edit'))
              WITH CHECK (has_permission(tenant_id, 'settings.edit'));

-- 4. Дата-миграция ролей: переносим capability reservations.* в tables.*, чтобы
--    роли (в т.ч. кастомные «Хостес») не потеряли доступ к управлению бронями.
--    reservations.view → tables.view; reservations.manage → tables.view + tables.manage.
UPDATE tenant_roles
SET permissions = permissions
  || (CASE WHEN COALESCE((permissions->>'reservations.view')::boolean, false)
        THEN '{"tables.view":true}'::jsonb ELSE '{}'::jsonb END)
  || (CASE WHEN COALESCE((permissions->>'reservations.manage')::boolean, false)
        THEN '{"tables.view":true,"tables.manage":true}'::jsonb ELSE '{}'::jsonb END)
WHERE permissions ? 'reservations.view' OR permissions ? 'reservations.manage';

-- Выкидываем мёртвые ключи reservations.* из всех ролей.
UPDATE tenant_roles
SET permissions = (permissions - 'reservations.view') - 'reservations.manage'
WHERE permissions ? 'reservations.view' OR permissions ? 'reservations.manage';

-- 5. Триггер дефолт-ролей для новых тенантов — без reservations.* (брони под tables.*).
CREATE OR REPLACE FUNCTION create_default_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO tenant_roles (tenant_id, name, is_default, permissions) VALUES
    (NEW.id, 'Администратор', true, '{"menu.view":true,"menu.edit":true,"menu.delete":true,"orders.view":true,"orders.create":true,"orders.edit":true,"orders.status":true,"orders.cancel":true,"kitchen.view":true,"tables.view":true,"tables.manage":true,"appointments.view":true,"appointments.manage":true,"appointments.view_all":true,"promos.view":true,"promos.manage":true,"content.view":true,"content.edit":true,"team.view":true,"team.manage":true,"roles.manage":true,"settings.view":true,"settings.edit":true,"analytics.view":true}'),
    (NEW.id, 'Менеджер', true, '{"menu.view":true,"menu.edit":true,"menu.delete":true,"orders.view":true,"orders.create":true,"orders.edit":true,"orders.status":true,"orders.cancel":true,"kitchen.view":true,"tables.view":true,"tables.manage":true,"appointments.view":true,"appointments.manage":true,"appointments.view_all":true,"promos.view":true,"promos.manage":true,"content.view":true,"content.edit":true,"team.view":true,"settings.view":true,"analytics.view":true}'),
    (NEW.id, 'Сотрудник', true, '{"menu.view":true,"orders.view":true,"orders.create":true,"orders.edit":true,"orders.status":true,"kitchen.view":true,"tables.view":true,"appointments.view":true,"appointments.view_own":true}');
  RETURN NEW;
END;
$$;
