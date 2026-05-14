-- P1.3c — индексы для 49 single-column FK + 8 tenant_id колонок.
-- Все 8 tenant_id-колонок одновременно являются FK на tenants — composite-индекс
-- (tenant_id, created_at DESC) для event-таблиц покрывает и FK-lookup, и сортировку
-- по времени в realtime/admin фидах.
--
-- На проде с большими таблицами рекомендуется пересоздать через CONCURRENTLY вручную
-- (CREATE INDEX CONCURRENTLY нельзя в transactional migration). В этой миграции —
-- обычный CREATE INDEX IF NOT EXISTS: блокировка пишущих транзакций на доли секунды,
-- для текущих объёмов приемлемо.

-- ─── event/audit таблицы — composite (tenant_id, created_at DESC) ─────────
CREATE INDEX IF NOT EXISTS idx_appointment_events_tenant_created
  ON public.appointment_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointment_events_actor
  ON public.appointment_events (actor_id);

CREATE INDEX IF NOT EXISTS idx_order_events_tenant_created
  ON public.order_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_events_order
  ON public.order_events (order_id);
CREATE INDEX IF NOT EXISTS idx_order_events_actor
  ON public.order_events (actor_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON public.audit_logs (actor_id);

-- ─── tenant_id leading-index (остальные tenant-колонки) ───────────────────
CREATE INDEX IF NOT EXISTS idx_banners_tenant
  ON public.banners (tenant_id);
CREATE INDEX IF NOT EXISTS idx_combos_tenant
  ON public.combos (tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_tenant
  ON public.customer_sessions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_pending_telegram_auths_tenant
  ON public.pending_telegram_auths (tenant_id);
CREATE INDEX IF NOT EXISTS idx_table_call_types_tenant
  ON public.table_call_types (tenant_id);
CREATE INDEX IF NOT EXISTS idx_table_calls_tenant
  ON public.table_calls (tenant_id);

-- ─── orders FK ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_table
  ON public.orders (table_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_zone
  ON public.orders (delivery_zone_id);
CREATE INDEX IF NOT EXISTS idx_orders_promotion
  ON public.orders (promotion_id);
CREATE INDEX IF NOT EXISTS idx_orders_accepted_by
  ON public.orders (accepted_by);

-- ─── reservations FK ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reservations_branch
  ON public.reservations (branch_id);
CREATE INDEX IF NOT EXISTS idx_reservations_table
  ON public.reservations (table_id);
CREATE INDEX IF NOT EXISTS idx_reservations_order
  ON public.reservations (order_id);
CREATE INDEX IF NOT EXISTS idx_reservations_confirmed_by
  ON public.reservations (confirmed_by);

-- ─── kitchen_queue FK (cascade-критичные) ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_kitchen_queue_order_item
  ON public.kitchen_queue (order_item_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_queue_assigned_to
  ON public.kitchen_queue (assigned_to);
CREATE INDEX IF NOT EXISTS idx_kitchen_queue_served_by
  ON public.kitchen_queue (served_by);

-- ─── order_items FK ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_order_items_combo
  ON public.order_items (combo_id);
CREATE INDEX IF NOT EXISTS idx_order_items_added_by
  ON public.order_items (added_by);
CREATE INDEX IF NOT EXISTS idx_order_items_confirmed_by
  ON public.order_items (confirmed_by);

-- ─── order_notes / combos / combo_items ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_order_notes_author
  ON public.order_notes (author_id);
CREATE INDEX IF NOT EXISTS idx_combos_category
  ON public.combos (category_id);
CREATE INDEX IF NOT EXISTS idx_combo_items_combo
  ON public.combo_items (combo_id);
CREATE INDEX IF NOT EXISTS idx_combo_items_dish
  ON public.combo_items (dish_id);

-- ─── menu junction / lookup FK ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_dish_addons_addon
  ON public.dish_addons (addon_id);
CREATE INDEX IF NOT EXISTS idx_dish_modifier_groups_group
  ON public.dish_modifier_groups (group_id);
CREATE INDEX IF NOT EXISTS idx_dish_modifier_options_option
  ON public.dish_modifier_options (option_id);
CREATE INDEX IF NOT EXISTS idx_addon_preset_items_addon
  ON public.addon_preset_items (addon_id);
CREATE INDEX IF NOT EXISTS idx_categories_tag
  ON public.categories (tag_id);

-- ─── appointments / schedule_templates / resources ───────────────────────
CREATE INDEX IF NOT EXISTS idx_appointments_confirmed_by
  ON public.appointments (confirmed_by);
CREATE INDEX IF NOT EXISTS idx_appointment_groups_branch
  ON public.appointment_groups (branch_id);
CREATE INDEX IF NOT EXISTS idx_schedule_templates_reference_branch
  ON public.schedule_templates (reference_branch_id);
CREATE INDEX IF NOT EXISTS idx_resources_member
  ON public.resources (member_id);

-- ─── banners промо-ссылки ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_banners_promo_code
  ON public.banners (promo_code_id);
CREATE INDEX IF NOT EXISTS idx_banners_promotion
  ON public.banners (promotion_id);

-- ─── table_calls FK ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_table_calls_table
  ON public.table_calls (table_id);
CREATE INDEX IF NOT EXISTS idx_table_calls_call_type
  ON public.table_calls (call_type_id);

-- ─── billing / tenancy ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_billing_transactions_created_by
  ON public.billing_transactions (created_by);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_plan
  ON public.billing_transactions (plan_id);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_invited_by
  ON public.tenant_invitations (invited_by);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_role
  ON public.tenant_invitations (role_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_role
  ON public.tenant_members (role_id);
CREATE INDEX IF NOT EXISTS idx_tenants_owner
  ON public.tenants (owner_id);
