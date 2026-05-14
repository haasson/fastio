-- P1.3e — заменить FOR ALL `is_tenant_member` политики на split SELECT/MODIFY
-- с has_permission() guard'ом. До этого любой member тенанта (кассир, кухня)
-- мог писать/обновлять/удалять appointment_settings, reservation_settings,
-- appointments, reservations, services, resources и т.д. — permission матрица
-- из team-roles.ts не проверялась на уровне БД.
--
-- Pattern: SELECT остаётся через is_tenant_member (всем member нужно видеть),
-- INSERT/UPDATE/DELETE — через has_permission(tenant_id, '<domain>.manage').
-- Owner (tenant_members.role_id IS NULL) проходит has_permission для любого
-- permission по логике самой функции — не сломается.
--
-- Junction-таблицы (combo_branches, dish_branches, service_branches,
-- service_resources, resource_branches, resource_categories) проверяют
-- has_permission через JOIN на parent (combos/dishes/services/resources).

-- ──────────────────────────────────────────────────────────────────────────
-- Core tenant tables (имеют свой tenant_id)
-- ──────────────────────────────────────────────────────────────────────────

-- appointment_settings ────────────────────────────────────────────────────
DROP POLICY IF EXISTS appointment_settings_tenant_member ON public.appointment_settings;
CREATE POLICY appointment_settings_select_member ON public.appointment_settings
  FOR SELECT USING (is_tenant_member(tenant_id));
CREATE POLICY appointment_settings_insert_manage ON public.appointment_settings
  FOR INSERT WITH CHECK (has_permission(tenant_id, 'appointments.manage'));
CREATE POLICY appointment_settings_update_manage ON public.appointment_settings
  FOR UPDATE USING (has_permission(tenant_id, 'appointments.manage'))
              WITH CHECK (has_permission(tenant_id, 'appointments.manage'));
CREATE POLICY appointment_settings_delete_manage ON public.appointment_settings
  FOR DELETE USING (has_permission(tenant_id, 'appointments.manage'));

-- reservation_settings ────────────────────────────────────────────────────
DROP POLICY IF EXISTS reservation_settings_tenant_member ON public.reservation_settings;
CREATE POLICY reservation_settings_select_member ON public.reservation_settings
  FOR SELECT USING (is_tenant_member(tenant_id));
CREATE POLICY reservation_settings_insert_manage ON public.reservation_settings
  FOR INSERT WITH CHECK (has_permission(tenant_id, 'reservations.manage'));
CREATE POLICY reservation_settings_update_manage ON public.reservation_settings
  FOR UPDATE USING (has_permission(tenant_id, 'reservations.manage'))
              WITH CHECK (has_permission(tenant_id, 'reservations.manage'));
CREATE POLICY reservation_settings_delete_manage ON public.reservation_settings
  FOR DELETE USING (has_permission(tenant_id, 'reservations.manage'));

-- appointments ────────────────────────────────────────────────────────────
-- ВАЖНО: appointments_view_own_restrict (миграция 253) AS RESTRICTIVE — только
-- сужает permissive-политики, сама доступа не даёт. appointments_own_user_select
-- (198) пропускает только клиента-владельца записи (user_id = auth.uid()).
-- Без appointments_select_member админский /appointments в storefront-агенте
-- увидит 0 строк через свой authenticated JWT — нужна permissive SELECT для
-- tenant-member'а, на которую дальше навесится restrictive view_own.
DROP POLICY IF EXISTS appointments_tenant_member ON public.appointments;
CREATE POLICY appointments_select_member ON public.appointments
  FOR SELECT USING (is_tenant_member(tenant_id));
CREATE POLICY appointments_insert_manage ON public.appointments
  FOR INSERT WITH CHECK (has_permission(tenant_id, 'appointments.manage'));
CREATE POLICY appointments_update_manage ON public.appointments
  FOR UPDATE USING (has_permission(tenant_id, 'appointments.manage'))
              WITH CHECK (has_permission(tenant_id, 'appointments.manage'));
CREATE POLICY appointments_delete_manage ON public.appointments
  FOR DELETE USING (has_permission(tenant_id, 'appointments.manage'));

-- appointment_groups ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS appointment_groups_tenant_member ON public.appointment_groups;
CREATE POLICY appointment_groups_select_member ON public.appointment_groups
  FOR SELECT USING (is_tenant_member(tenant_id));
CREATE POLICY appointment_groups_insert_manage ON public.appointment_groups
  FOR INSERT WITH CHECK (has_permission(tenant_id, 'appointments.manage'));
CREATE POLICY appointment_groups_update_manage ON public.appointment_groups
  FOR UPDATE USING (has_permission(tenant_id, 'appointments.manage'))
              WITH CHECK (has_permission(tenant_id, 'appointments.manage'));
CREATE POLICY appointment_groups_delete_manage ON public.appointment_groups
  FOR DELETE USING (has_permission(tenant_id, 'appointments.manage'));

-- reservations ────────────────────────────────────────────────────────────
-- SELECT для customer уже есть через reservations_customer_own — оставляем.
DROP POLICY IF EXISTS reservations_tenant_member ON public.reservations;
CREATE POLICY reservations_select_member ON public.reservations
  FOR SELECT USING (is_tenant_member(tenant_id));
CREATE POLICY reservations_insert_manage ON public.reservations
  FOR INSERT WITH CHECK (has_permission(tenant_id, 'reservations.manage'));
CREATE POLICY reservations_update_manage ON public.reservations
  FOR UPDATE USING (has_permission(tenant_id, 'reservations.manage'))
              WITH CHECK (has_permission(tenant_id, 'reservations.manage'));
CREATE POLICY reservations_delete_manage ON public.reservations
  FOR DELETE USING (has_permission(tenant_id, 'reservations.manage'));

-- schedule_templates ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS schedule_templates_tenant_member ON public.schedule_templates;
CREATE POLICY schedule_templates_select_member ON public.schedule_templates
  FOR SELECT USING (is_tenant_member(tenant_id));
CREATE POLICY schedule_templates_insert_manage ON public.schedule_templates
  FOR INSERT WITH CHECK (has_permission(tenant_id, 'appointments.manage'));
CREATE POLICY schedule_templates_update_manage ON public.schedule_templates
  FOR UPDATE USING (has_permission(tenant_id, 'appointments.manage'))
              WITH CHECK (has_permission(tenant_id, 'appointments.manage'));
CREATE POLICY schedule_templates_delete_manage ON public.schedule_templates
  FOR DELETE USING (has_permission(tenant_id, 'appointments.manage'));

-- services ────────────────────────────────────────────────────────────────
-- SELECT остаётся через services_public_read (анонимы видят через витрину).
DROP POLICY IF EXISTS services_tenant_member ON public.services;
CREATE POLICY services_select_member ON public.services
  FOR SELECT USING (is_tenant_member(tenant_id));
CREATE POLICY services_insert_manage ON public.services
  FOR INSERT WITH CHECK (has_permission(tenant_id, 'menu.edit'));
CREATE POLICY services_update_manage ON public.services
  FOR UPDATE USING (has_permission(tenant_id, 'menu.edit'))
              WITH CHECK (has_permission(tenant_id, 'menu.edit'));
CREATE POLICY services_delete_manage ON public.services
  FOR DELETE USING (has_permission(tenant_id, 'menu.delete'));

-- resources ───────────────────────────────────────────────────────────────
-- SELECT для public через resources_public_read.
DROP POLICY IF EXISTS resources_tenant_member ON public.resources;
CREATE POLICY resources_select_member ON public.resources
  FOR SELECT USING (is_tenant_member(tenant_id));
CREATE POLICY resources_insert_manage ON public.resources
  FOR INSERT WITH CHECK (has_permission(tenant_id, 'appointments.manage'));
CREATE POLICY resources_update_manage ON public.resources
  FOR UPDATE USING (has_permission(tenant_id, 'appointments.manage'))
              WITH CHECK (has_permission(tenant_id, 'appointments.manage'));
CREATE POLICY resources_delete_manage ON public.resources
  FOR DELETE USING (has_permission(tenant_id, 'appointments.manage'));

-- ──────────────────────────────────────────────────────────────────────────
-- Junction tables (tenant через parent)
-- Утечка анонимного чтения junction-таблиц (combo_branches/dish_branches *_public_read)
-- закрыта одновременно с заменой FOR ALL — SELECT только для tenant-member'а.
-- ──────────────────────────────────────────────────────────────────────────

-- combo_branches (combos.tenant_id) ──────────────────────────────────────
DROP POLICY IF EXISTS combo_branches_tenant_member ON public.combo_branches;
DROP POLICY IF EXISTS combo_branches_public_read ON public.combo_branches;
CREATE POLICY combo_branches_select_member ON public.combo_branches
  FOR SELECT USING (EXISTS (SELECT 1 FROM combos c WHERE c.id = combo_branches.combo_id AND is_tenant_member(c.tenant_id)));
CREATE POLICY combo_branches_insert_manage ON public.combo_branches
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM combos c WHERE c.id = combo_branches.combo_id AND has_permission(c.tenant_id, 'menu.edit')));
CREATE POLICY combo_branches_update_manage ON public.combo_branches
  FOR UPDATE USING (EXISTS (SELECT 1 FROM combos c WHERE c.id = combo_branches.combo_id AND has_permission(c.tenant_id, 'menu.edit')))
              WITH CHECK (EXISTS (SELECT 1 FROM combos c WHERE c.id = combo_branches.combo_id AND has_permission(c.tenant_id, 'menu.edit')));
CREATE POLICY combo_branches_delete_manage ON public.combo_branches
  FOR DELETE USING (EXISTS (SELECT 1 FROM combos c WHERE c.id = combo_branches.combo_id AND has_permission(c.tenant_id, 'menu.edit')));

-- dish_branches (dishes.tenant_id) ───────────────────────────────────────
DROP POLICY IF EXISTS dish_branches_tenant_member ON public.dish_branches;
DROP POLICY IF EXISTS dish_branches_public_read ON public.dish_branches;
CREATE POLICY dish_branches_select_member ON public.dish_branches
  FOR SELECT USING (EXISTS (SELECT 1 FROM dishes d WHERE d.id = dish_branches.dish_id AND is_tenant_member(d.tenant_id)));
CREATE POLICY dish_branches_insert_manage ON public.dish_branches
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM dishes d WHERE d.id = dish_branches.dish_id AND has_permission(d.tenant_id, 'menu.edit')));
CREATE POLICY dish_branches_update_manage ON public.dish_branches
  FOR UPDATE USING (EXISTS (SELECT 1 FROM dishes d WHERE d.id = dish_branches.dish_id AND has_permission(d.tenant_id, 'menu.edit')))
              WITH CHECK (EXISTS (SELECT 1 FROM dishes d WHERE d.id = dish_branches.dish_id AND has_permission(d.tenant_id, 'menu.edit')));
CREATE POLICY dish_branches_delete_manage ON public.dish_branches
  FOR DELETE USING (EXISTS (SELECT 1 FROM dishes d WHERE d.id = dish_branches.dish_id AND has_permission(d.tenant_id, 'menu.edit')));

-- service_branches (services.tenant_id) ─────────────────────────────────
-- SELECT уже есть через service_branches_tenant_read.
DROP POLICY IF EXISTS service_branches_tenant_member ON public.service_branches;
CREATE POLICY service_branches_insert_manage ON public.service_branches
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM services s WHERE s.id = service_branches.service_id AND has_permission(s.tenant_id, 'menu.edit')));
CREATE POLICY service_branches_update_manage ON public.service_branches
  FOR UPDATE USING (EXISTS (SELECT 1 FROM services s WHERE s.id = service_branches.service_id AND has_permission(s.tenant_id, 'menu.edit')))
              WITH CHECK (EXISTS (SELECT 1 FROM services s WHERE s.id = service_branches.service_id AND has_permission(s.tenant_id, 'menu.edit')));
CREATE POLICY service_branches_delete_manage ON public.service_branches
  FOR DELETE USING (EXISTS (SELECT 1 FROM services s WHERE s.id = service_branches.service_id AND has_permission(s.tenant_id, 'menu.edit')));

-- service_resources (services.tenant_id) ────────────────────────────────
-- Управление связкой услуга↔ресурс — это appointments.manage домен.
DROP POLICY IF EXISTS service_resources_tenant_member ON public.service_resources;
CREATE POLICY service_resources_insert_manage ON public.service_resources
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM services s WHERE s.id = service_resources.service_id AND has_permission(s.tenant_id, 'appointments.manage')));
CREATE POLICY service_resources_update_manage ON public.service_resources
  FOR UPDATE USING (EXISTS (SELECT 1 FROM services s WHERE s.id = service_resources.service_id AND has_permission(s.tenant_id, 'appointments.manage')))
              WITH CHECK (EXISTS (SELECT 1 FROM services s WHERE s.id = service_resources.service_id AND has_permission(s.tenant_id, 'appointments.manage')));
CREATE POLICY service_resources_delete_manage ON public.service_resources
  FOR DELETE USING (EXISTS (SELECT 1 FROM services s WHERE s.id = service_resources.service_id AND has_permission(s.tenant_id, 'appointments.manage')));

-- resource_branches (resources.tenant_id) ───────────────────────────────
DROP POLICY IF EXISTS resource_branches_tenant_member ON public.resource_branches;
CREATE POLICY resource_branches_insert_manage ON public.resource_branches
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM resources r WHERE r.id = resource_branches.resource_id AND has_permission(r.tenant_id, 'appointments.manage')));
CREATE POLICY resource_branches_update_manage ON public.resource_branches
  FOR UPDATE USING (EXISTS (SELECT 1 FROM resources r WHERE r.id = resource_branches.resource_id AND has_permission(r.tenant_id, 'appointments.manage')))
              WITH CHECK (EXISTS (SELECT 1 FROM resources r WHERE r.id = resource_branches.resource_id AND has_permission(r.tenant_id, 'appointments.manage')));
CREATE POLICY resource_branches_delete_manage ON public.resource_branches
  FOR DELETE USING (EXISTS (SELECT 1 FROM resources r WHERE r.id = resource_branches.resource_id AND has_permission(r.tenant_id, 'appointments.manage')));

-- resource_categories (resources.tenant_id) ─────────────────────────────
DROP POLICY IF EXISTS resource_categories_tenant_member ON public.resource_categories;
CREATE POLICY resource_categories_insert_manage ON public.resource_categories
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM resources r WHERE r.id = resource_categories.resource_id AND has_permission(r.tenant_id, 'appointments.manage')));
CREATE POLICY resource_categories_update_manage ON public.resource_categories
  FOR UPDATE USING (EXISTS (SELECT 1 FROM resources r WHERE r.id = resource_categories.resource_id AND has_permission(r.tenant_id, 'appointments.manage')))
              WITH CHECK (EXISTS (SELECT 1 FROM resources r WHERE r.id = resource_categories.resource_id AND has_permission(r.tenant_id, 'appointments.manage')));
CREATE POLICY resource_categories_delete_manage ON public.resource_categories
  FOR DELETE USING (EXISTS (SELECT 1 FROM resources r WHERE r.id = resource_categories.resource_id AND has_permission(r.tenant_id, 'appointments.manage')));

-- ──────────────────────────────────────────────────────────────────────────
-- telegram_link_codes остаётся под is_tenant_member: это auth-flow таблица
-- для привязки Telegram-аккаунтов; permission'ов для неё в team-roles.ts нет
-- и админ-UI её не редактирует напрямую (только storefront-flow через RPC).
-- ──────────────────────────────────────────────────────────────────────────
