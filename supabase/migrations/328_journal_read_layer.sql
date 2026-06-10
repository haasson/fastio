-- Единый read-слой журнала: UNION audit_logs + order_events в нормализованную форму.
--
-- ЧТО:
--  1) audit_logs.branch_id — к какому филиалу относится событие («Всё заведение» = NULL).
--  2) fn_audit() — populate branch_id generic-способом (без замены остального тела;
--     CREATE OR REPLACE сохраняет привязку 19 триггеров).
--  3) journal_events() — read-only RPC, SECURITY DEFINER (RLS обходит → явный
--     has_permission-гард). Keyset-курсор composite (occurred_at, id): bulk audit-trigger
--     пишет всем одинаковый created_at, поэтому occurred_at-only курсор молча терял
--     строки на границе страницы.

-- ─────────────────────────────────────
-- 1. branch_id у audit_logs
-- ─────────────────────────────────────
-- ПЛОСКИЙ nullable uuid БЕЗ FK на branches(id). audit_logs — append-only forensic:
-- строки НЕ должны быть lifecycle-coupled к тому, что описывают.
--  1) FK ON DELETE SET NULL стёр бы историческую привязку к филиалу при его удалении.
--  2) FK ломал бы hard-DELETE филиала: AFTER-DELETE audit-триггер вставляет строку
--     со ссылкой на только что удалённый branch → нарушение FK → откат DELETE.
-- Без FK логировать id удалённого филиала БЕЗОПАСНО и forensically полезно.
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS branch_id uuid;

-- Фильтр журнала по филиалу (branch_id = X OR NULL) + newest-first.
CREATE INDEX IF NOT EXISTS audit_logs_branch_idx
  ON audit_logs (tenant_id, branch_id, created_at DESC);

-- ─────────────────────────────────────
-- 2. fn_audit() — populate branch_id (тело 321 ВЕРБАТИМ + v_branch_id)
-- ─────────────────────────────────────
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
  v_branch_id     uuid;

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

  -- ── branch_id ──
  -- Таблицы со своей колонкой branch_id (tables, reservations) → этот филиал.
  -- Сама таблица branches не имеет branch_id, НО является филиалом → берём её id.
  -- branch_id — плоский uuid без FK (см. п.1), поэтому даже на hard-DELETE филиала
  -- логируем его собственный id: forensic-строка фиксирует, КАКОЙ филиал удалили.
  -- Tenant-wide таблицы (dishes, settings, roles…) не имеют ключа branch_id в jsonb →
  -- ->>'branch_id' = NULL → остаётся NULL → «Всё заведение». Generic и корректно.
  v_branch_id := COALESCE(
    (v_row->>'branch_id')::uuid,
    CASE WHEN v_entity_type = 'branch' THEN (v_row->>'id')::uuid END
  );

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
    tenant_id, branch_id, actor_id, actor_name, actor_role,
    action, entity_type, entity_id, entity_name,
    payload, changed_fields, search_text, parent_type, parent_id
  ) VALUES (
    v_tenant_id, v_branch_id, v_actor_id, v_actor_name, v_actor_role,
    v_action, v_entity_type, v_entity_id, v_entity_name,
    v_payload, v_changed, array_to_string(v_search_parts, ' '), v_parent_type, v_parent_id
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ─────────────────────────────────────
-- 3. journal_events()
-- ─────────────────────────────────────
-- Дропаем промежуточные dev-сигнатуры явно (если есть в локальной базе),
-- иначе CREATE OR REPLACE оставил бы их рядом как отдельные перегрузки.
DROP FUNCTION IF EXISTS public.journal_events(uuid,uuid,timestamptz,text[],text[],text,int);
DROP FUNCTION IF EXISTS public.journal_events(uuid,uuid,timestamptz,text,text[],text[],text,int);

CREATE OR REPLACE FUNCTION public.journal_events(
  p_tenant_id    uuid,
  p_branch_id    uuid         DEFAULT NULL,  -- NULL = все; иначе филиал + общие (branch IS NULL)
  p_before       timestamptz  DEFAULT NULL,  -- keyset-курсор: occurred_at <
  p_before_id    text         DEFAULT NULL,  -- keyset-курсор: tiebreaker id < при равном occurred_at
  p_sources      text[]       DEFAULT NULL,  -- ['audit','order']
  p_entity_types text[]       DEFAULT NULL,
  p_event_types  text[]       DEFAULT NULL,  -- фильтр по действию: ['created','updated','deleted',...]
  p_search       text         DEFAULT NULL,
  p_limit        int          DEFAULT 50
)
RETURNS TABLE (
  id text, source text, event_type text, occurred_at timestamptz,
  branch_id uuid, actor_id uuid, actor_name text,
  entity_type text, entity_id text, entity_name text,
  payload jsonb, changed_fields text[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  -- LIKE-спецсимволы юзерского поиска экранируем: «50%» ищет литеральные «50%»,
  -- а не «50<что угодно>».
  v_search text := CASE
    WHEN p_search IS NULL THEN NULL
    ELSE '%' || replace(replace(replace(p_search, '\', '\\'), '%', '\%'), '_', '\_') || '%'
  END;
  -- Кламп лимита: страница журнала просит 50, руками через RPC можно было бы
  -- заказать миллион — не даём согреть базу.
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
BEGIN
  IF NOT has_permission(p_tenant_id, 'audit_log.view') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH unified AS (
    SELECT
      a.id::text, 'audit'::text AS source, a.action AS event_type,
      a.created_at AS occurred_at, a.branch_id,
      a.actor_id, a.actor_name, a.entity_type, a.entity_id::text, a.entity_name,
      a.payload, a.changed_fields
    FROM audit_logs a
    WHERE a.tenant_id = p_tenant_id

    UNION ALL

    SELECT
      e.id::text, 'order'::text,
      -- «Действие»-тег + action-фильтр едины: order_created → created, всё прочее → updated
      -- (order-удалений в наборе событий нет). Сырой тип события сташится в payload ниже.
      (CASE WHEN e.event_type = 'order_created' THEN 'created' ELSE 'updated' END)::text,
      e.created_at, o.branch_id,
      e.actor_id, e.actor_name,
      -- dine-in (table_id IS NOT NULL) → объект = СТОЛ; иначе = ЗАКАЗ.
      (CASE WHEN o.table_id IS NOT NULL THEN 'table' ELSE 'order' END)::text,
      e.order_id::text,
      (CASE WHEN o.table_id IS NOT NULL THEN tb.name ELSE o.order_number::text END),
      -- сташим СЫРОЙ тип order-события: фронт строит из него человекочитаемую сводку.
      e.meta || jsonb_build_object('_order_event', e.event_type),
      ARRAY[]::text[]
    FROM order_events e
    JOIN orders o ON o.id = e.order_id
    LEFT JOIN tables tb ON tb.id = o.table_id
    WHERE e.tenant_id = p_tenant_id
  )
  SELECT u.id, u.source, u.event_type, u.occurred_at, u.branch_id,
         u.actor_id, u.actor_name, u.entity_type, u.entity_id, u.entity_name,
         u.payload, u.changed_fields
  FROM unified u
  WHERE (p_before IS NULL
         OR u.occurred_at < p_before
         OR (u.occurred_at = p_before AND u.id < p_before_id))
    AND (p_branch_id IS NULL OR u.branch_id = p_branch_id OR u.branch_id IS NULL)
    AND (p_sources IS NULL OR u.source = ANY(p_sources))
    AND (p_entity_types IS NULL OR u.entity_type = ANY(p_entity_types))
    AND (p_event_types IS NULL OR u.event_type = ANY(p_event_types))
    AND (v_search IS NULL OR u.entity_name ILIKE v_search OR u.actor_name ILIKE v_search)
  ORDER BY u.occurred_at DESC, u.id DESC
  LIMIT v_limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.journal_events(uuid,uuid,timestamptz,text,text[],text[],text[],text,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.journal_events(uuid,uuid,timestamptz,text,text[],text[],text[],text,int) TO authenticated;
