-- Фильтр периода в журнале действий: journal_events() получает p_from / p_to.
--
-- ЧТО: пересоздание journal_events() с двумя новыми параметрами
--   p_from timestamptz DEFAULT NULL — нижняя граница (включительно, occurred_at >= p_from)
--   p_to   timestamptz DEFAULT NULL — верхняя граница (ЭКСКЛЮЗИВНО, occurred_at < p_to;
--          фронт передаёт начало дня ПОСЛЕ выбранного «до» — день входит целиком)
--
-- ЗАЧЕМ: датапикер «от–до» в тулбаре /audit-log должен резать выдачу на сервере —
-- иначе keyset-пагинация листала бы весь журнал ради пары дней.
--
-- ⚠️ Другой список параметров = ПЕРЕГРУЗКА в Postgres, не замена: сначала DROP
-- старой сигнатуры из 328, потом CREATE. Новые параметры — В КОНЦЕ списка,
-- чтобы позиционные вызовы не поехали. Тело — копия 328 + два условия в общем WHERE.

DROP FUNCTION IF EXISTS public.journal_events(uuid,uuid,timestamptz,text,text[],text[],text[],text,int);

CREATE OR REPLACE FUNCTION public.journal_events(
  p_tenant_id    uuid,
  p_branch_id    uuid         DEFAULT NULL,  -- NULL = все; иначе филиал + общие (branch IS NULL)
  p_before       timestamptz  DEFAULT NULL,  -- keyset-курсор: occurred_at <
  p_before_id    text         DEFAULT NULL,  -- keyset-курсор: tiebreaker id < при равном occurred_at
  p_sources      text[]       DEFAULT NULL,  -- ['audit','order']
  p_entity_types text[]       DEFAULT NULL,
  p_event_types  text[]       DEFAULT NULL,  -- фильтр по действию: ['created','updated','deleted',...]
  p_search       text         DEFAULT NULL,
  p_limit        int          DEFAULT 50,
  p_from         timestamptz  DEFAULT NULL,  -- период: occurred_at >= p_from (включительно)
  p_to           timestamptz  DEFAULT NULL   -- период: occurred_at < p_to (ЭКСКЛЮЗИВНО)
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
    AND (p_from IS NULL OR u.occurred_at >= p_from)
    AND (p_to IS NULL OR u.occurred_at < p_to)
    AND (p_branch_id IS NULL OR u.branch_id = p_branch_id OR u.branch_id IS NULL)
    AND (p_sources IS NULL OR u.source = ANY(p_sources))
    AND (p_entity_types IS NULL OR u.entity_type = ANY(p_entity_types))
    AND (p_event_types IS NULL OR u.event_type = ANY(p_event_types))
    AND (v_search IS NULL OR u.entity_name ILIKE v_search OR u.actor_name ILIKE v_search)
  ORDER BY u.occurred_at DESC, u.id DESC
  LIMIT v_limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.journal_events(uuid,uuid,timestamptz,text,text[],text[],text[],text,int,timestamptz,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.journal_events(uuid,uuid,timestamptz,text,text[],text[],text[],text,int,timestamptz,timestamptz) TO authenticated;
