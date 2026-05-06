-- Migration 253: appointments view_own — RLS-enforced + default-роли
--
-- Что: вводим серверное ограничение «мастер видит только свои записи» через
-- RESTRICTIVE SELECT-policy на `appointments`. До этого `useAppointmentViewScope`
-- фильтровал записи только клиентски — мастер с DevTools мог запросить
-- `from('appointments').select('*')` и получить чужие записи (с телефонами
-- клиентов). RPC `update_appointment` тоже без серверного ограничения позволял
-- бы мастеру тыкать в чужие appointment_id, но это уже за нами не следит — там
-- статус-чек и бизнес-логика.
--
-- Логика SELECT-доступа для tenant-member (не service_role, не own_user):
--   1. Owner (role_id IS NULL) → видит всё.
--   2. Роль с `appointments.view_all=true` → видит всё.
--   3. Роль БЕЗ `appointments.view_own=true` → видит всё (backwards-compat
--      для legacy-ролей, у которых ни одного из view_*-ключей нет).
--   4. Роль с `appointments.view_own=true` И `view_all` !== true → только записи
--      на ресурсах, привязанных к собственному membership через `resources.member_id`.
--
-- Реализация: основная permissive policy `appointments_tenant_member` остаётся
-- (FOR ALL → разрешает member'у читать/писать). Ограничение для view_own
-- накладывается отдельной RESTRICTIVE policy `appointments_view_own_restrict`
-- (применяется через AND поверх остальных). service_role и own_user исключены
-- через явные ветки в USING.
--
-- Дополнительно: дефолтные роли (Администратор/Менеджер получают
-- `appointments.view_all=true`, Сотрудник — `appointments.view_own=true`).
-- Триггер `create_default_roles` обновлён для новых тенантов.

-- ─── 1. RLS RESTRICTIVE policy ────────────────────────────────────────

CREATE POLICY "appointments_view_own_restrict"
  ON appointments
  AS RESTRICTIVE
  FOR SELECT
  USING (
    -- Не tenant-member (включая anon) → restrictive не действует, остальные
    -- policies решают доступ. Также пропускаем service_role и own_user.
    auth.role() = 'service_role'
    OR user_id = auth.uid()
    OR NOT is_tenant_member(tenant_id)
    -- Tenant-member: разрешено ИЛИ через view_all/owner, ИЛИ если у роли нет
    -- view_own (backwards-compat), ИЛИ ресурс привязан к моему мемберу.
    OR has_permission(tenant_id, 'appointments.view_all')
    OR NOT has_permission(tenant_id, 'appointments.view_own')
    OR EXISTS (
      SELECT 1
      FROM resources r
      JOIN tenant_members tm ON tm.id = r.member_id
      WHERE r.id = appointments.resource_id
        AND tm.user_id = auth.uid()
        AND tm.tenant_id = appointments.tenant_id
    )
  );

-- ─── 2. Backfill дефолтных ролей ──────────────────────────────────────
-- Администратор/Менеджер получают view_all=true (полный доступ к таймлайну
-- и списку визитов). Сотрудник получает view_own=true (только свой ресурс).
-- Кастомные роли НЕ трогаем (как в миграции 208) — тенант сам разбирается.

UPDATE tenant_roles
   SET permissions = permissions
     || jsonb_build_object('appointments.view_all', true)
 WHERE is_default = true
   AND name IN ('Администратор', 'Менеджер');

UPDATE tenant_roles
   SET permissions = permissions
     || jsonb_build_object('appointments.view_own', true)
 WHERE is_default = true
   AND name = 'Сотрудник';

-- ─── 3. Триггер для новых тенантов ────────────────────────────────────
-- Обновляем create_default_roles: добавляем view_all/view_own в дефолты.

CREATE OR REPLACE FUNCTION create_default_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO tenant_roles (tenant_id, name, is_default, permissions) VALUES
    (NEW.id, 'Администратор', true, '{"menu.view":true,"menu.edit":true,"menu.delete":true,"orders.view":true,"orders.create":true,"orders.edit":true,"orders.status":true,"orders.cancel":true,"kitchen.view":true,"tables.view":true,"tables.manage":true,"reservations.view":true,"reservations.manage":true,"appointments.view":true,"appointments.manage":true,"appointments.view_all":true,"promos.view":true,"promos.manage":true,"content.view":true,"content.edit":true,"team.view":true,"team.manage":true,"roles.manage":true,"settings.view":true,"settings.edit":true,"analytics.view":true}'),
    (NEW.id, 'Менеджер', true, '{"menu.view":true,"menu.edit":true,"menu.delete":true,"orders.view":true,"orders.create":true,"orders.edit":true,"orders.status":true,"orders.cancel":true,"kitchen.view":true,"tables.view":true,"tables.manage":true,"reservations.view":true,"reservations.manage":true,"appointments.view":true,"appointments.manage":true,"appointments.view_all":true,"promos.view":true,"promos.manage":true,"content.view":true,"content.edit":true,"team.view":true,"settings.view":true,"analytics.view":true}'),
    (NEW.id, 'Сотрудник', true, '{"menu.view":true,"orders.view":true,"orders.create":true,"orders.edit":true,"orders.status":true,"kitchen.view":true,"tables.view":true,"reservations.view":true,"appointments.view":true,"appointments.view_own":true}');
  RETURN NEW;
END;
$$;
