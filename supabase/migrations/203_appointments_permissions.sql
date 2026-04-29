-- Migration 203: Separate appointments.* permission keys
--
-- До этого `useGate.viewAppointments`/`manageAppointments` использовали ключи
-- `reservations.view` / `reservations.manage` — семантическое смешение
-- бронирования столиков (reservations) и записи на услуги (appointments):
-- хостес со `reservations.manage` автоматически получал доступ к Appointments.
--
-- Вводим отдельные `appointments.view` / `appointments.manage`. Существующим
-- ролям копируем значения из `reservations.*` — миграция консервативная,
-- никто не теряет доступ. Дальше тенант сам сможет разграничить роли.

-- ─── Backfill для всех существующих ролей ─────────────────

UPDATE tenant_roles
SET permissions = permissions
  || jsonb_build_object(
    'appointments.view',
      COALESCE((permissions->>'reservations.view')::boolean, false),
    'appointments.manage',
      COALESCE((permissions->>'reservations.manage')::boolean, false)
  )
WHERE NOT (permissions ? 'appointments.view')
   OR NOT (permissions ? 'appointments.manage');

-- ─── Обновляем триггер для новых тенантов ────────────────
-- Скопировано из 112; добавляем appointments.* там же где reservations.*.

CREATE OR REPLACE FUNCTION create_default_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO tenant_roles (tenant_id, name, is_default, permissions) VALUES
    (NEW.id, 'Администратор', true, '{"menu.view":true,"menu.edit":true,"menu.delete":true,"orders.view":true,"orders.create":true,"orders.edit":true,"orders.status":true,"orders.cancel":true,"kitchen.view":true,"tables.view":true,"tables.manage":true,"reservations.view":true,"reservations.manage":true,"appointments.view":true,"appointments.manage":true,"promos.view":true,"promos.manage":true,"content.view":true,"content.edit":true,"team.view":true,"team.manage":true,"roles.manage":true,"settings.view":true,"settings.edit":true,"analytics.view":true}'),
    (NEW.id, 'Менеджер', true, '{"menu.view":true,"menu.edit":true,"menu.delete":true,"orders.view":true,"orders.create":true,"orders.edit":true,"orders.status":true,"orders.cancel":true,"kitchen.view":true,"tables.view":true,"tables.manage":true,"reservations.view":true,"reservations.manage":true,"appointments.view":true,"appointments.manage":true,"promos.view":true,"promos.manage":true,"content.view":true,"content.edit":true,"team.view":true,"settings.view":true,"analytics.view":true}'),
    (NEW.id, 'Сотрудник', true, '{"menu.view":true,"orders.view":true,"orders.create":true,"orders.edit":true,"orders.status":true,"kitchen.view":true,"tables.view":true,"reservations.view":true,"appointments.view":true}');
  RETURN NEW;
END;
$$;
