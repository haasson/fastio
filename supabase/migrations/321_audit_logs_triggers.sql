-- Migration 321: generic audit logging via DB triggers.
--
-- Цель: ни одна запись в чувствительные таблицы не попадает в БД без следа
-- «кто и что изменил». Гарантия — на уровне БД, а не клиентского кода.
--
-- Расширяет существующую audit_logs (153) и навешивает одну переиспользуемую
-- trigger-функцию fn_audit() на справочники / настройки / операционные сущности.
-- Заказы и записи логируются отдельно (order_events / appointment_events) и сюда
-- НЕ дублируются.

-- ─────────────────────────────────────
-- 1. Расширения и колонки
-- ─────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS changed_fields text[] DEFAULT '{}';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS search_text   text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS parent_type   text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS parent_id     text;

-- Нечёткий поиск по русским подстрокам (имена, акторы, изменённые значения).
CREATE INDEX IF NOT EXISTS audit_logs_search_trgm_idx
  ON audit_logs USING gin (search_text gin_trgm_ops);

-- Фильтр «по полю» (changed_fields @> '{price}').
CREATE INDEX IF NOT EXISTS audit_logs_changed_fields_idx
  ON audit_logs USING gin (changed_fields);

-- Связка дочерней записи с родителем (панель родителя показывает дочерние события).
CREATE INDEX IF NOT EXISTS audit_logs_parent_idx
  ON audit_logs (tenant_id, parent_type, parent_id);

-- Фильтрация по типу/действию на глобальной странице.
CREATE INDEX IF NOT EXISTS audit_logs_entity_action_idx
  ON audit_logs (tenant_id, entity_type, action, created_at DESC);

-- ─────────────────────────────────────
-- 2. Generic trigger-функция
-- ─────────────────────────────────────
-- TG_ARGV[0] = entity_type            (например 'dish')
-- TG_ARGV[1] = name_column | '-'      (колонка отображаемого имени; '-' если нет)
-- TG_ARGV[2] = parent_spec | ''       'parentType:fkColumn:parentTable'
--                                     используется для (а) резолва tenant_id у
--                                     дочек без своего tenant_id и (б) parent-связки
-- TG_ARGV[3] = actor_fallback_col | '' колонка с актором, если auth.uid() IS NULL
--                                     (мутации через service-role/edge-function,
--                                     напр. invitations.invited_by — иначе актор теряется)
-- TG_ARGV[4] = tenant_id_col           колонка тенанта (дефолт 'tenant_id'); для самой
--                                     таблицы tenants — 'id' (нет своей tenant_id)
--
-- Функция generic за счёт to_jsonb(строка) — не гадает колонки, работает с любой
-- таблицей, где есть id (+ tenant_id у себя или у родителя).

CREATE OR REPLACE FUNCTION fn_audit() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_entity_type    text := TG_ARGV[0];
  v_name_col       text := TG_ARGV[1];
  v_parent_spec    text := COALESCE(TG_ARGV[2], '');
  v_actor_fallback text := COALESCE(TG_ARGV[3], '');
  v_tenant_col     text := COALESCE(NULLIF(TG_ARGV[4], ''), 'tenant_id');

  v_new jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  v_old jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  v_row jsonb := COALESCE(v_new, v_old);

  -- Поля, которые никогда не должны порождать событие сами по себе.
  -- id/служебные временные метки/sort_order (reorder) + СЕКРЕТЫ (не пускать в payload/search_text).
  -- Биллинг/система тенанта (balance/subscription/suspend/onboarding/...) — даже если такой
  -- столбец попал в один UPDATE с настройкой, он не должен утечь в дифф. Эти имена есть только
  -- у tenants, для прочих таблиц запись в ignore безвредна.
  v_ignore text[] := ARRAY[
    'id', 'created_at', 'updated_at', 'sort_order',
    'token', 'guest_token', 'idempotency_key',
    'balance', 'subscription', 'suspend',
    'onboarding_state', 'onboarding_completed',
    'self_registered', 'notify_private_alpha', 'external_id', 'owner_id'
  ];

  v_action        text;
  v_tenant_id     uuid;
  v_entity_id     text := v_row->>'id';
  v_entity_name   text;
  v_actor_id      uuid := auth.uid();
  v_actor_name    text;
  v_actor_role    text;
  v_changed       text[] := '{}';
  v_payload       jsonb  := '{}'::jsonb;
  v_search_parts  text[] := '{}';

  v_parent_type   text;
  v_parent_fk     text;
  v_parent_table  text;
  v_parent_id     text;

  v_key   text;
  v_oldv  text;
  v_newv  text;
BEGIN
  -- ── parent_spec ──
  IF v_parent_spec <> '' THEN
    v_parent_type  := split_part(v_parent_spec, ':', 1);
    v_parent_fk    := split_part(v_parent_spec, ':', 2);
    v_parent_table := split_part(v_parent_spec, ':', 3);
    v_parent_id    := v_row->>v_parent_fk;
  END IF;

  -- ── tenant_id (своя колонка или резолв через родителя) ──
  -- Берётся из NEW (COALESCE(v_new,v_old)). Если tenant_id когда-нибудь станет mutable
  -- (перенос сущности между тенантами — сейчас невозможен, retail XOR services), событие
  -- «ушло из A» легло бы под тенант B. Тогда нужно логировать обе стороны отдельно.
  v_tenant_id := (v_row->>v_tenant_col)::uuid;
  IF v_tenant_id IS NULL AND v_parent_table <> '' AND v_parent_id IS NOT NULL THEN
    EXECUTE format('SELECT tenant_id FROM %I WHERE id = $1', v_parent_table)
      INTO v_tenant_id USING v_parent_id::uuid;
  END IF;

  -- Без существующего тенанта логировать нельзя: audit_logs.tenant_id ссылается на
  -- tenants по FK. Orphan-строки (tenant_id не в tenants) пропускаем — иначе INSERT в
  -- audit_logs упал бы и заблокировал саму бизнес-мутацию. Для нормальных данных лог гарантирован.
  IF v_tenant_id IS NULL OR NOT EXISTS (SELECT 1 FROM tenants WHERE id = v_tenant_id) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- ── action + diff ──
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
  ELSE
    -- UPDATE: soft-delete / restore по deleted_at|archived_at, иначе update
    IF (v_old->>'deleted_at') IS NULL AND (v_new->>'deleted_at') IS NOT NULL THEN
      v_action := 'deleted';
    ELSIF (v_old->>'deleted_at') IS NOT NULL AND (v_new->>'deleted_at') IS NULL THEN
      v_action := 'restored';
    ELSIF (v_old->>'archived_at') IS NULL AND (v_new->>'archived_at') IS NOT NULL THEN
      v_action := 'deleted';
    ELSIF (v_old->>'archived_at') IS NOT NULL AND (v_new->>'archived_at') IS NULL THEN
      v_action := 'restored';
    ELSE
      v_action := 'updated';
    END IF;

    -- собираем дифф по изменившимся полям
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      CONTINUE WHEN v_key = ANY (v_ignore);
      v_oldv := v_old->>v_key;
      v_newv := v_new->>v_key;
      IF v_oldv IS DISTINCT FROM v_newv THEN
        v_changed := array_append(v_changed, v_key);
        v_payload := v_payload || jsonb_build_object(
          v_key, jsonb_build_object('old', v_old->v_key, 'new', v_new->v_key)
        );
        v_search_parts := array_append(v_search_parts, left(COALESCE(v_oldv, ''), 100));
        v_search_parts := array_append(v_search_parts, left(COALESCE(v_newv, ''), 100));
      END IF;
    END LOOP;

    -- UPDATE без значимых изменений (только ignore-поля, напр. reorder) — пропускаем
    IF array_length(v_changed, 1) IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  -- ── entity_name ──
  -- name_col = '-'            → имени нет
  -- name_col = 'user:<col>'   → резолв ФИО из auth.users по uuid в колонке <col>
  -- иначе                     → значение колонки как есть
  IF v_name_col = '-' THEN
    v_entity_name := NULL;
  ELSIF left(v_name_col, 5) = 'user:' THEN
    SELECT COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), u.email)
      INTO v_entity_name
      FROM auth.users u
      WHERE u.id = (v_row->>substring(v_name_col FROM 6))::uuid;
  ELSE
    v_entity_name := v_row->>v_name_col;
  END IF;

  -- ── actor (snapshot имени и роли на момент действия) ──
  -- Мутации через service-role/edge-function не имеют auth.uid() — для таких таблиц
  -- актора берём из доменной колонки (actor_fallback_col, напр. invitations.invited_by).
  IF v_actor_id IS NULL AND v_actor_fallback <> '' THEN
    v_actor_id := (v_row->>v_actor_fallback)::uuid;
  END IF;

  IF v_actor_id IS NOT NULL THEN
    SELECT COALESCE(
             NULLIF(u.raw_user_meta_data->>'full_name', ''),
             NULLIF(u.raw_user_meta_data->>'name', ''),
             u.email
           )
      INTO v_actor_name
      FROM auth.users u
      WHERE u.id = v_actor_id;

    -- role_id IS NULL → владелец (has_permission даёт ему все права)
    SELECT COALESCE(tr.name, 'Владелец')
      INTO v_actor_role
      FROM tenant_members tm
      LEFT JOIN tenant_roles tr ON tr.id = tm.role_id
      WHERE tm.tenant_id = v_tenant_id AND tm.user_id = v_actor_id;
  ELSE
    v_actor_role := 'system';
  END IF;

  -- ── search_text ──
  v_search_parts := array_append(v_search_parts, COALESCE(v_actor_name, ''));
  v_search_parts := array_append(v_search_parts, COALESCE(v_entity_name, ''));
  v_search_parts := array_append(v_search_parts, v_entity_type);

  INSERT INTO audit_logs (
    tenant_id, actor_id, actor_name, actor_role,
    action, entity_type, entity_id, entity_name,
    payload, changed_fields, search_text, parent_type, parent_id
  ) VALUES (
    v_tenant_id, v_actor_id, v_actor_name, v_actor_role,
    v_action, v_entity_type, v_entity_id, v_entity_name,
    v_payload, v_changed, array_to_string(v_search_parts, ' '), v_parent_type, v_parent_id
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ─────────────────────────────────────
-- 3. Триггеры на целевые таблицы
-- ─────────────────────────────────────
-- Главные сущности (tenant_id свой, name = 'name')
CREATE TRIGGER audit_dishes          AFTER INSERT OR UPDATE OR DELETE ON dishes          FOR EACH ROW EXECUTE FUNCTION fn_audit('dish', 'name', '');
CREATE TRIGGER audit_categories      AFTER INSERT OR UPDATE OR DELETE ON categories      FOR EACH ROW EXECUTE FUNCTION fn_audit('category', 'name', '');
CREATE TRIGGER audit_modifier_groups AFTER INSERT OR UPDATE OR DELETE ON modifier_groups FOR EACH ROW EXECUTE FUNCTION fn_audit('modifier_group', 'name', '');
CREATE TRIGGER audit_addons          AFTER INSERT OR UPDATE OR DELETE ON addons          FOR EACH ROW EXECUTE FUNCTION fn_audit('addon', 'name', '');
CREATE TRIGGER audit_addon_presets   AFTER INSERT OR UPDATE OR DELETE ON addon_presets   FOR EACH ROW EXECUTE FUNCTION fn_audit('addon_preset', 'name', '');
CREATE TRIGGER audit_combos          AFTER INSERT OR UPDATE OR DELETE ON combos          FOR EACH ROW EXECUTE FUNCTION fn_audit('combo', 'name', '');
CREATE TRIGGER audit_dish_tags       AFTER INSERT OR UPDATE OR DELETE ON dish_tags       FOR EACH ROW EXECUTE FUNCTION fn_audit('dish_tag', 'name', '');
CREATE TRIGGER audit_branches        AFTER INSERT OR UPDATE OR DELETE ON branches        FOR EACH ROW EXECUTE FUNCTION fn_audit('branch', 'name', '');
CREATE TRIGGER audit_tenant_roles    AFTER INSERT OR UPDATE OR DELETE ON tenant_roles    FOR EACH ROW EXECUTE FUNCTION fn_audit('role', 'name', '');
CREATE TRIGGER audit_tables          AFTER INSERT OR UPDATE OR DELETE ON tables          FOR EACH ROW EXECUTE FUNCTION fn_audit('table', 'name', '');
CREATE TRIGGER audit_reservations    AFTER INSERT OR UPDATE OR DELETE ON reservations    FOR EACH ROW EXECUTE FUNCTION fn_audit('reservation', 'guest_name', '');
CREATE TRIGGER audit_services        AFTER INSERT OR UPDATE OR DELETE ON services        FOR EACH ROW EXECUTE FUNCTION fn_audit('service', 'name', '');
CREATE TRIGGER audit_promo_codes      AFTER INSERT OR UPDATE OR DELETE ON promo_codes     FOR EACH ROW EXECUTE FUNCTION fn_audit('promo_code', 'code', '');
CREATE TRIGGER audit_promotions       AFTER INSERT OR UPDATE OR DELETE ON promotions      FOR EACH ROW EXECUTE FUNCTION fn_audit('promotion', 'title', '');

-- Настройки на уровне тенанта (entity_type='settings'). Только UPDATE: создание/удаление
-- тенанта — lifecycle, не настройки. WHEN-allow-list — триггер срабатывает ТОЛЬКО когда
-- меняется настроечная колонка; billing/subscription/balance/onboarding/system НЕ аудируются
-- (их крутит крон/система — иначе журнал засорялся бы шумом).
CREATE TRIGGER audit_tenants AFTER UPDATE ON tenants FOR EACH ROW
WHEN (
  OLD.name IS DISTINCT FROM NEW.name
  OR OLD.custom_domain IS DISTINCT FROM NEW.custom_domain
  OR OLD.currency IS DISTINCT FROM NEW.currency
  OR OLD.timezone IS DISTINCT FROM NEW.timezone
  OR OLD.menu_style IS DISTINCT FROM NEW.menu_style
  OR OLD.branch_selection_mode IS DISTINCT FROM NEW.branch_selection_mode
  OR OLD.delivery_fee IS DISTINCT FROM NEW.delivery_fee
  OR OLD.delivery_min_order IS DISTINCT FROM NEW.delivery_min_order
  OR OLD.delivery_description IS DISTINCT FROM NEW.delivery_description
  OR OLD.delivery_mode IS DISTINCT FROM NEW.delivery_mode
  OR OLD.free_delivery_from IS DISTINCT FROM NEW.free_delivery_from
  OR OLD.working_hours_schedule IS DISTINCT FROM NEW.working_hours_schedule
  OR OLD.contacts IS DISTINCT FROM NEW.contacts
  OR OLD.legal_info IS DISTINCT FROM NEW.legal_info
  OR OLD.payment_methods IS DISTINCT FROM NEW.payment_methods
  OR OLD.kitchen_urgency_minutes IS DISTINCT FROM NEW.kitchen_urgency_minutes
  OR OLD.kitchen_config IS DISTINCT FROM NEW.kitchen_config
  OR OLD.order_number_config IS DISTINCT FROM NEW.order_number_config
  OR OLD.order_scheduling_config IS DISTINCT FROM NEW.order_scheduling_config
  OR OLD.max_addons_default IS DISTINCT FROM NEW.max_addons_default
  OR OLD.modules IS DISTINCT FROM NEW.modules
  OR OLD.notifications IS DISTINCT FROM NEW.notifications
  OR OLD.theme IS DISTINCT FROM NEW.theme
  OR OLD.seo IS DISTINCT FROM NEW.seo
  OR OLD.site_layout IS DISTINCT FROM NEW.site_layout
  OR OLD.site_content IS DISTINCT FROM NEW.site_content
  OR OLD.color_palettes IS DISTINCT FROM NEW.color_palettes
  OR OLD.orders_tile_size IS DISTINCT FROM NEW.orders_tile_size
)
EXECUTE FUNCTION fn_audit('settings', 'name', '', '', 'id');

-- tenant_members: имя участника резолвим из auth.users по user_id
CREATE TRIGGER audit_tenant_members     AFTER INSERT OR UPDATE OR DELETE ON tenant_members     FOR EACH ROW EXECUTE FUNCTION fn_audit('member', 'user:user_id', '');
-- tenant_invitations: приглашения (invite / cancel / resend)
CREATE TRIGGER audit_tenant_invitations AFTER INSERT OR UPDATE OR DELETE ON tenant_invitations FOR EACH ROW EXECUTE FUNCTION fn_audit('invitation', 'email', '', 'invited_by');

-- Ценовые дочки (tenant_id резолвится через родителя + parent-связка)
CREATE TRIGGER audit_modifier_options AFTER INSERT OR UPDATE OR DELETE ON modifier_options FOR EACH ROW EXECUTE FUNCTION fn_audit('modifier_option', 'name', 'modifier_group:group_id:modifier_groups');
CREATE TRIGGER audit_combo_items      AFTER INSERT OR UPDATE OR DELETE ON combo_items      FOR EACH ROW EXECUTE FUNCTION fn_audit('combo_item', '-', 'combo:combo_id:combos');
