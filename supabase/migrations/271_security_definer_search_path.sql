-- P1.3b — SET search_path = public, pg_temp для 22 SECURITY DEFINER функций,
-- у которых proconfig IS NULL. Закрывает search-path-hijack: если у привилегированного
-- юзера есть CREATE на public, он мог бы зашедуить `now()` / `auth.uid()` / etc.
-- через свой temp/own схему. Supabase default search_path "$user, public" частично
-- защищает, но явный SET — пояс с подтяжками.
--
-- Миграция 205 уже сделала это для части функций — здесь догоняем оставшиеся 22.
-- Используем ALTER FUNCTION (без перезаписи тела) чтобы не дублировать определения.
--
-- ⚠️ search_path хранится в pg_proc.proconfig, не в теле функции. CREATE OR REPLACE
-- FUNCTION без явного `SET search_path = ...` в DDL сбрасывает proconfig обратно в NULL.
-- При следующем редактировании любой из 22 функций ОБЯЗАТЕЛЬНО добавлять `SET search_path
-- = public, pg_temp` прямо в CREATE OR REPLACE — иначе эффект этой миграции испарится.
-- Долгосрочно стоит перенести SET внутрь определения каждой функции (тогда оно будет
-- жить в исходниках миграций), но без переписывания тел сейчас удобнее ALTER'ом догнать.

ALTER FUNCTION public._kitchen_queue_insert_item(p_tenant_id uuid, p_order_id uuid, p_item record, p_delivery_type text)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.auto_close_stale_support_tickets()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.auto_create_owner_membership()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.create_default_order_statuses()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.ensure_scheduled_holding_status(p_tenant_id uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.extend_appointment(p_id uuid, p_minutes integer)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_order_number(p_tenant_id uuid, p_config jsonb, p_branch_id uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.get_tenant_unread_support_count(p_tenant_id uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_module_toggle()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.has_permission(_tenant_id uuid, _permission text)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.is_tenant_member(_tenant_id uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.is_tenant_owner(_tenant_id uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.kitchen_queue_check_cooking_started()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.kitchen_queue_on_dine_in_item_insert()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.kitchen_queue_on_item_confirmed()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.kitchen_queue_on_order_status()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.kitchen_queue_populate(p_order_id uuid, p_tenant_id uuid, p_delivery_type text)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.log_order_created()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.on_support_message_insert()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.orders_init_visited_status()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.orders_track_visited_status()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.set_order_number()
  SET search_path = public, pg_temp;
