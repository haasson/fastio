-- ─────────────────────────────────────────────────────────────────────────────
-- SQL-level тест read-слоя журнала: journal_events() + branch-aware audit
-- из 328_journal_read_layer.sql.
-- Покрывает: UNION audit_logs + order_events + newest-first ordering (S1),
-- has_permission-гард (42501 для чужака, S2), source-фильтр (S3),
-- composite keyset / tiebreaker (S4), branch_id read из audit_logs (S5),
-- branch-фильтр p_branch_id (S6), event-type (action) фильтр p_event_types (S7),
-- fn_audit branch_id integration (S8),
-- hard-DELETE филиала delete-safe (нет FK) + forensic branch_id = id удалённого (S9),
-- LIKE-экранирование p_search (S10).
--
-- Запуск:
--   docker exec -i supabase_db_fastio psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     < supabase/tests/journal_events.test.sql
--
-- ВСЁ обёрнуто в один BEGIN … ROLLBACK — сид НЕ мутируется. Внутри транзакции
-- через `set local request.jwt.claims` имперсонируем владельца тенанта (auth.uid()
-- читает 'sub' из claims → has_permission видит owner-membership role_id IS NULL).
--
-- Фикстура (демо-сид):
--   tenant  = 00000000-0000-0000-0000-000000000002 (retail)
--   owner   = 00000000-0000-0000-0000-000000000001 (role_id IS NULL → все права)
--   stranger= 99999999-9999-9999-9999-999999999999 (НЕ член тенанта → нет прав)
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

BEGIN;

-- Фикстурные id в temp-таблицу (psql \set не доживает до DO-блоков).
CREATE TEMP TABLE _fx ON COMMIT DROP AS
SELECT
  '00000000-0000-0000-0000-000000000002'::uuid AS tenant_id,
  '00000000-0000-0000-0000-000000000001'::uuid AS owner_id,
  '99999999-9999-9999-9999-999999999999'::uuid AS stranger_id;

-- Имперсонируем владельца на всю транзакцию.
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001"}';

-- ── Seed: 2 order'а (delivery + dine-in за столом) + по order_event + 1 audit_log.
--          Метим уникальными entity_name/event_type/meta для надёжного выцепливания
--          из общего журнала тенанта.
--   delivery → order_number авто-генерится (entity_type='order', entity_name=номер).
--   dine-in (table_id) → НЕТ order_number (set_order_number пропускает dine_in);
--                        в журнале entity_type='table', entity_name=имя стола. ──────
DO $seed$
DECLARE
  r           record;
  v_order     uuid;
  v_order_num text;
  v_branch    uuid;
  v_table     uuid;
  v_dinein    uuid;
BEGIN
  SELECT * INTO r FROM _fx;
  SELECT id INTO v_branch FROM branches WHERE tenant_id = r.tenant_id LIMIT 1;

  -- delivery-заказ: check_status NULL, минимальный набор NOT NULL колонок.
  -- Триггер order_created_trigger сам положит order_event 'order_created'.
  -- set_order_number проставит order_number (delivery → номер генерится).
  INSERT INTO orders (tenant_id, delivery_type, subtotal, total, payment_type, status)
  VALUES (r.tenant_id, 'delivery', 100, 100, 'cash', 'new')
  RETURNING id, order_number INTO v_order, v_order_num;

  -- Сохраним сгенерированный номер для S1-ассерта (entity_name delivery-заказа).
  CREATE TEMP TABLE _seed_ctx ON COMMIT DROP AS
  SELECT v_order AS delivery_order, v_order_num AS delivery_order_number;

  -- Явный order_event ПОЗЖЕ audit_log по времени → должен идти первым (newest-first).
  -- created_at задаём руками, чтобы порядок был детерминирован.
  INSERT INTO order_events (order_id, tenant_id, actor_id, actor_name, event_type, meta, created_at)
  VALUES (v_order, r.tenant_id, r.owner_id, 'Тестовый Овнер',
          'status_changed', '{"__marker":"__test_status_changed","to":"cooking"}'::jsonb,
          now() - interval '1 minute');

  -- dine-in заказ за столом: order_number остаётся NULL, table_id указывает на стол.
  INSERT INTO tables (tenant_id, branch_id, name)
  VALUES (r.tenant_id, v_branch, '__test_table_5')
  RETURNING id INTO v_table;

  INSERT INTO orders (tenant_id, branch_id, table_id, delivery_type, subtotal, total, payment_type, status)
  VALUES (r.tenant_id, v_branch, v_table, 'dine_in', 200, 200, 'cash', 'new')
  RETURNING id INTO v_dinein;

  -- order_created у dine-in мог уже создаться триггером; добавим явный с маркером
  -- (created_at позже audit'а, но раньше delivery order_event — порядок не критичен).
  INSERT INTO order_events (order_id, tenant_id, actor_id, actor_name, event_type, meta, created_at)
  VALUES (v_dinein, r.tenant_id, r.owner_id, 'Тестовый Овнер',
          'order_created', '{"__marker":"__test_dinein_created","source":"admin"}'::jsonb,
          now() - interval '90 seconds');

  -- audit_log РАНЬШЕ order_event по времени → должен идти вторым.
  INSERT INTO audit_logs (tenant_id, actor_id, actor_name, actor_role, action,
                          entity_type, entity_id, entity_name, payload, changed_fields,
                          created_at)
  VALUES (r.tenant_id, r.owner_id, 'Тестовый Овнер', 'owner', 'update',
          'dish', '__test_dish_id', '__test_dish_name',
          '{"price":{"old":100,"new":120}}'::jsonb, ARRAY['price']::text[],
          now() - interval '2 minutes');

  RAISE NOTICE 'SEED OK: delivery=% (№%) + dine-in=% (table %) + order_events + 1 audit_log',
    v_order, v_order_num, v_dinein, v_table;
END
$seed$;

-- ── Scenario 1: journal_events возвращает обе записи, newest-first ────────────
DO $s1$
DECLARE
  r         record;
  rows      jsonb;
  v_first   record;
  v_second  record;
  v_audit   record;
  v_order   record;
BEGIN
  SELECT * INTO r FROM _fx;

  -- Выцепляем наши две тестовые записи из общего журнала тенанта по уникальным
  -- маркерам, сохраняя порядок, который вернула функция.
  CREATE TEMP TABLE _je ON COMMIT DROP AS
  SELECT * FROM journal_events(p_tenant_id := r.tenant_id, p_limit := 500);

  -- (a) обе записи присутствуют. order-событие выцепляем по marker в payload
  -- (event_type теперь нормализован → 'updated', не годится как уникальный маркер).
  SELECT * INTO v_order FROM _je
    WHERE source = 'order' AND payload->>'__marker' = '__test_status_changed';
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'FAIL S1: order_event не найден в журнале'; END IF;

  SELECT * INTO v_audit FROM _je
    WHERE source = 'audit' AND entity_name = '__test_dish_name';
  IF v_audit.id IS NULL THEN RAISE EXCEPTION 'FAIL S1: audit_log не найден в журнале'; END IF;

  -- (b) нормализация полей order-ветки (delivery → entity_type='order', entity_name=номер).
  IF v_order.entity_type <> 'order' THEN
    RAISE EXCEPTION 'FAIL S1: order.entity_type=% expected order', v_order.entity_type;
  END IF;
  IF v_order.entity_name IS DISTINCT FROM (SELECT delivery_order_number FROM _seed_ctx) THEN
    RAISE EXCEPTION 'FAIL S1: order.entity_name=% ожидали номер заказа %',
      v_order.entity_name, (SELECT delivery_order_number FROM _seed_ctx);
  END IF;
  -- event_type нормализован: status_changed → 'updated' (для «Действие»-тега + action-фильтра).
  IF v_order.event_type <> 'updated' THEN
    RAISE EXCEPTION 'FAIL S1: order.event_type=% expected updated (нормализация)', v_order.event_type;
  END IF;
  -- сырой тип события сташен в payload._order_event для фронта.
  IF v_order.payload->>'_order_event' <> 'status_changed' THEN
    RAISE EXCEPTION 'FAIL S1: order.payload._order_event=% expected status_changed', v_order.payload->>'_order_event';
  END IF;
  IF v_order.actor_name <> 'Тестовый Овнер' THEN
    RAISE EXCEPTION 'FAIL S1: order.actor_name=%', v_order.actor_name;
  END IF;
  IF v_order.payload->>'to' <> 'cooking' THEN
    RAISE EXCEPTION 'FAIL S1: order.payload meta не прокинут: %', v_order.payload;
  END IF;
  IF v_order.changed_fields <> ARRAY[]::text[] THEN
    RAISE EXCEPTION 'FAIL S1: order.changed_fields ожидали пустой массив, got %', v_order.changed_fields;
  END IF;

  -- (b2) dine-in order_created → entity_type='table', entity_name=имя стола, event_type='created'.
  DECLARE v_dinein record;
  BEGIN
    SELECT * INTO v_dinein FROM _je
      WHERE source = 'order' AND payload->>'__marker' = '__test_dinein_created';
    IF v_dinein.id IS NULL THEN RAISE EXCEPTION 'FAIL S1: dine-in order_event не найден'; END IF;
    IF v_dinein.entity_type <> 'table' THEN
      RAISE EXCEPTION 'FAIL S1: dine-in entity_type=% expected table', v_dinein.entity_type;
    END IF;
    IF v_dinein.entity_name <> '__test_table_5' THEN
      RAISE EXCEPTION 'FAIL S1: dine-in entity_name=% expected __test_table_5', v_dinein.entity_name;
    END IF;
    IF v_dinein.event_type <> 'created' THEN
      RAISE EXCEPTION 'FAIL S1: dine-in event_type=% expected created (order_created→created)', v_dinein.event_type;
    END IF;
    IF v_dinein.payload->>'_order_event' <> 'order_created' THEN
      RAISE EXCEPTION 'FAIL S1: dine-in payload._order_event=% expected order_created', v_dinein.payload->>'_order_event';
    END IF;
  END;

  -- (c) нормализация полей audit-ветки
  IF v_audit.event_type <> 'update' THEN
    RAISE EXCEPTION 'FAIL S1: audit.event_type=% expected update', v_audit.event_type;
  END IF;
  IF v_audit.entity_type <> 'dish' THEN
    RAISE EXCEPTION 'FAIL S1: audit.entity_type=% expected dish', v_audit.entity_type;
  END IF;
  IF v_audit.changed_fields <> ARRAY['price']::text[] THEN
    RAISE EXCEPTION 'FAIL S1: audit.changed_fields=% expected {price}', v_audit.changed_fields;
  END IF;

  -- (d) newest-first: order_event (-1 min) идёт РАНЬШЕ audit_log (-2 min).
  IF v_order.occurred_at <= v_audit.occurred_at THEN
    RAISE EXCEPTION 'FAIL S1: ожидали order_event новее audit_log';
  END IF;

  -- проверяем что в выдаче order действительно стоит на меньшей позиции (раньше).
  -- WITH ORDINALITY поверх ВЫЗОВА функции → порядок берётся из её собственного
  -- ORDER BY, а не из heap-скана temp-таблицы (который недетерминирован).
  DECLARE
    v_order_ord int;
    v_audit_ord int;
  BEGIN
    SELECT ord INTO v_order_ord
      FROM journal_events(p_tenant_id := r.tenant_id, p_limit := 500)
             WITH ORDINALITY AS t(id, source, event_type, occurred_at, branch_id,
                                  actor_id, actor_name, entity_type, entity_id,
                                  entity_name, payload, changed_fields, ord)
      WHERE t.id = v_order.id;
    SELECT ord INTO v_audit_ord
      FROM journal_events(p_tenant_id := r.tenant_id, p_limit := 500)
             WITH ORDINALITY AS t(id, source, event_type, occurred_at, branch_id,
                                  actor_id, actor_name, entity_type, entity_id,
                                  entity_name, payload, changed_fields, ord)
      WHERE t.id = v_audit.id;

    IF v_order_ord IS NULL OR v_audit_ord IS NULL THEN
      RAISE EXCEPTION 'FAIL S1: не нашли ord для order=% / audit=%', v_order_ord, v_audit_ord;
    END IF;
    IF v_order_ord >= v_audit_ord THEN
      RAISE EXCEPTION 'FAIL S1: order_event должен идти раньше audit_log в выдаче (newest-first): order ord=%, audit ord=%', v_order_ord, v_audit_ord;
    END IF;
  END;

  DROP TABLE _je;

  RAISE NOTICE 'OK S1: journal_events вернул обе записи, нормализованы, order_event первым (newest-first)';
END
$s1$;

-- ── Scenario 2: permission denied — чужак (НЕ член тенанта) → 42501 ───────────
DO $s2$
DECLARE
  r        record;
  v_raised boolean := false;
BEGIN
  SELECT * INTO r FROM _fx;

  PERFORM set_config('request.jwt.claims',
                     '{"sub":"99999999-9999-9999-9999-999999999999"}', true);

  BEGIN
    PERFORM * FROM journal_events(p_tenant_id := r.tenant_id);
  EXCEPTION WHEN sqlstate '42501' THEN v_raised := true;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'FAIL S2: чужак не получил 42501'; END IF;

  PERFORM set_config('request.jwt.claims',
                     '{"sub":"00000000-0000-0000-0000-000000000001"}', true);

  RAISE NOTICE 'OK S2: journal_events чужаком → 42501 (permission denied)';
END
$s2$;

-- ── Scenario 3: source-фильтр — только audit ─────────────────────────────────
DO $s3$
DECLARE
  r       record;
  v_cnt   int;
BEGIN
  SELECT * INTO r FROM _fx;

  SELECT count(*) INTO v_cnt
    FROM journal_events(p_tenant_id := r.tenant_id, p_sources := ARRAY['audit'], p_limit := 500)
    WHERE source <> 'audit';
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'FAIL S3: p_sources=audit вернул % не-audit строк', v_cnt; END IF;

  RAISE NOTICE 'OK S3: source-фильтр audit отдаёт только audit-записи';
END
$s3$;

-- ── Scenario 4: composite keyset — две строки с ОДИНАКОВЫМ occurred_at не теряются ─
-- Регресс-гард на тот самый баг: курсор только по occurred_at молча выкидывал
-- строку-близнеца на границе страницы. Сеем два audit_log с идентичным created_at,
-- листаем по 1 → вторая строка должна вернуться, а не быть пропущена.
DO $s4$
DECLARE
  r          record;
  v_ts       timestamptz;
  v_id1      text;
  v_id2      text;
  v_first    text;
  v_second   text;
  v_page1_ts timestamptz;
BEGIN
  SELECT * INTO r FROM _fx;

  -- Фиксированный «прошлый» момент, чтобы наши близнецы гарантированно были
  -- свежее всего остального шумного журнала тенанта НЕ требуется — мы листаем
  -- курсором именно от них. Берём заведомо уникальное будущее-смещённое время,
  -- чтобы две строки точно оказались на вершине newest-first выдачи.
  v_ts := now() + interval '10 minutes';

  INSERT INTO audit_logs (tenant_id, actor_id, actor_name, actor_role, action,
                          entity_type, entity_id, entity_name, payload, changed_fields,
                          created_at)
  VALUES (r.tenant_id, r.owner_id, 'Тестовый Овнер', 'owner', 'update',
          'dish', '__s4_a', '__s4_tie_name', '{}'::jsonb, ARRAY[]::text[], v_ts)
  RETURNING id::text INTO v_id1;

  INSERT INTO audit_logs (tenant_id, actor_id, actor_name, actor_role, action,
                          entity_type, entity_id, entity_name, payload, changed_fields,
                          created_at)
  VALUES (r.tenant_id, r.owner_id, 'Тестовый Овнер', 'owner', 'update',
          'dish', '__s4_b', '__s4_tie_name', '{}'::jsonb, ARRAY[]::text[], v_ts)
  RETURNING id::text INTO v_id2;

  -- Страница 1: лимит 1, без курсора → самая верхняя из близнецов
  -- (фильтруем по уникальному entity_name, чтобы не словить посторонний шум).
  SELECT je.id, je.occurred_at INTO v_first, v_page1_ts
    FROM journal_events(p_tenant_id := r.tenant_id, p_limit := 500) je
    WHERE je.entity_name = '__s4_tie_name'
    ORDER BY je.occurred_at DESC, je.id DESC
    LIMIT 1;

  IF v_first IS NULL THEN
    RAISE EXCEPTION 'FAIL S4: страница 1 не вернула ни одного близнеца';
  END IF;

  -- Страница 2: курсор по (occurred_at, id) первой строки → ДОЛЖЕН вернуться ВТОРОЙ
  -- близнец с тем же occurred_at, а не пропуститься.
  SELECT je.id INTO v_second
    FROM journal_events(p_tenant_id    := r.tenant_id,
                        p_before       := v_page1_ts,
                        p_before_id    := v_first,
                        p_limit        := 500) je
    WHERE je.entity_name = '__s4_tie_name'
    ORDER BY je.occurred_at DESC, je.id DESC
    LIMIT 1;

  IF v_second IS NULL THEN
    RAISE EXCEPTION 'FAIL S4: composite-курсор ПОТЕРЯЛ второго близнеца с тем же occurred_at (тот самый баг)';
  END IF;
  IF v_second = v_first THEN
    RAISE EXCEPTION 'FAIL S4: курсор вернул ту же строку (% = %), tiebreaker не сработал', v_second, v_first;
  END IF;
  IF v_second NOT IN (v_id1, v_id2) OR v_first NOT IN (v_id1, v_id2) THEN
    RAISE EXCEPTION 'FAIL S4: вернулись не наши близнецы: first=%, second=% (ждали % / %)',
      v_first, v_second, v_id1, v_id2;
  END IF;

  RAISE NOTICE 'OK S4: composite keyset (occurred_at,id) листает оба близнеца — строка на границе НЕ теряется';
END
$s4$;

-- ── Scenario 5: branch-aware audit read — branch_id из audit_logs.branch_id ──
-- Сеем два audit_log: один с branch_id = реальный филиал, один tenant-wide (NULL).
-- journal_events должен вернуть branch_id филиала у первого и NULL у второго.
DO $s5$
DECLARE
  r          record;
  v_branch   uuid;
  v_je_br    uuid;
  v_je_null  uuid;
  v_found    boolean;
BEGIN
  SELECT * INTO r FROM _fx;

  SELECT id INTO v_branch FROM branches WHERE tenant_id = r.tenant_id LIMIT 1;
  IF v_branch IS NULL THEN RAISE EXCEPTION 'FAIL S5: нет seeded филиала у тенанта'; END IF;

  -- audit-строка С филиалом
  INSERT INTO audit_logs (tenant_id, branch_id, actor_id, actor_name, actor_role, action,
                          entity_type, entity_id, entity_name, payload, changed_fields, created_at)
  VALUES (r.tenant_id, v_branch, r.owner_id, 'Тестовый Овнер', 'owner', 'updated',
          'table', '__s5_branch', '__s5_branch_name', '{}'::jsonb, ARRAY[]::text[],
          now() + interval '20 minutes');

  -- tenant-wide audit-строка (branch_id NULL)
  INSERT INTO audit_logs (tenant_id, actor_id, actor_name, actor_role, action,
                          entity_type, entity_id, entity_name, payload, changed_fields, created_at)
  VALUES (r.tenant_id, r.owner_id, 'Тестовый Овнер', 'owner', 'updated',
          'dish', '__s5_tenant', '__s5_tenant_name', '{}'::jsonb, ARRAY[]::text[],
          now() + interval '21 minutes');

  -- branch-строка → branch_id = филиал
  SELECT je.branch_id, true INTO v_je_br, v_found
    FROM journal_events(p_tenant_id := r.tenant_id, p_limit := 500) je
    WHERE je.entity_name = '__s5_branch_name';
  IF NOT v_found THEN RAISE EXCEPTION 'FAIL S5: branch-audit строка не найдена'; END IF;
  IF v_je_br IS DISTINCT FROM v_branch THEN
    RAISE EXCEPTION 'FAIL S5: ожидали branch_id=% got %', v_branch, v_je_br;
  END IF;

  -- tenant-wide строка → branch_id NULL
  v_found := false;
  SELECT je.branch_id, true INTO v_je_null, v_found
    FROM journal_events(p_tenant_id := r.tenant_id, p_limit := 500) je
    WHERE je.entity_name = '__s5_tenant_name';
  IF NOT v_found THEN RAISE EXCEPTION 'FAIL S5: tenant-wide audit строка не найдена'; END IF;
  IF v_je_null IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL S5: ожидали branch_id NULL (Всё заведение) got %', v_je_null;
  END IF;

  RAISE NOTICE 'OK S5: audit branch_id читается из audit_logs.branch_id (филиал / NULL)';
END
$s5$;

-- ── Scenario 6: branch-фильтр — p_branch_id возвращает И филиал И tenant-wide ──
-- Предикат: branch_id = p_branch_id OR branch_id IS NULL. Используем строки из S5.
DO $s6$
DECLARE
  r          record;
  v_branch   uuid;
  v_has_br   int;
  v_has_null int;
  v_has_other int;
BEGIN
  SELECT * INTO r FROM _fx;
  SELECT id INTO v_branch FROM branches WHERE tenant_id = r.tenant_id LIMIT 1;

  SELECT
    count(*) FILTER (WHERE je.entity_name = '__s5_branch_name'),
    count(*) FILTER (WHERE je.entity_name = '__s5_tenant_name')
  INTO v_has_br, v_has_null
  FROM journal_events(p_tenant_id := r.tenant_id, p_branch_id := v_branch, p_limit := 500) je;

  IF v_has_br <> 1 THEN
    RAISE EXCEPTION 'FAIL S6: branch-строка не вернулась при p_branch_id=% (got %)', v_branch, v_has_br;
  END IF;
  IF v_has_null <> 1 THEN
    RAISE EXCEPTION 'FAIL S6: tenant-wide строка должна вернуться при p_branch_id (общие), got %', v_has_null;
  END IF;

  -- строка ДРУГОГО филиала не должна попасть. Берём второй филиал, если есть.
  DECLARE v_branch2 uuid;
  BEGIN
    SELECT id INTO v_branch2 FROM branches WHERE tenant_id = r.tenant_id AND id <> v_branch LIMIT 1;
    IF v_branch2 IS NOT NULL THEN
      INSERT INTO audit_logs (tenant_id, branch_id, actor_id, actor_name, actor_role, action,
                              entity_type, entity_id, entity_name, payload, changed_fields, created_at)
      VALUES (r.tenant_id, v_branch2, r.owner_id, 'Тестовый Овнер', 'owner', 'updated',
              'table', '__s6_other', '__s6_other_name', '{}'::jsonb, ARRAY[]::text[],
              now() + interval '22 minutes');

      SELECT count(*) INTO v_has_other
        FROM journal_events(p_tenant_id := r.tenant_id, p_branch_id := v_branch, p_limit := 500) je
        WHERE je.entity_name = '__s6_other_name';
      IF v_has_other <> 0 THEN
        RAISE EXCEPTION 'FAIL S6: строка чужого филиала просочилась при p_branch_id=%', v_branch;
      END IF;
    END IF;
  END;

  RAISE NOTICE 'OK S6: branch-фильтр возвращает филиал + tenant-wide, чужой филиал отсекается';
END
$s6$;

-- ── Scenario 7: action-фильтр — p_event_types := ARRAY['deleted'] ────────────
DO $s7$
DECLARE
  r        record;
  v_del    int;
  v_other  int;
BEGIN
  SELECT * INTO r FROM _fx;

  INSERT INTO audit_logs (tenant_id, actor_id, actor_name, actor_role, action,
                          entity_type, entity_id, entity_name, payload, changed_fields, created_at)
  VALUES (r.tenant_id, r.owner_id, 'Тестовый Овнер', 'owner', 'created',
          'dish', '__s7_created', '__s7_created_name', '{}'::jsonb, ARRAY[]::text[],
          now() + interval '30 minutes');

  INSERT INTO audit_logs (tenant_id, actor_id, actor_name, actor_role, action,
                          entity_type, entity_id, entity_name, payload, changed_fields, created_at)
  VALUES (r.tenant_id, r.owner_id, 'Тестовый Овнер', 'owner', 'deleted',
          'dish', '__s7_deleted', '__s7_deleted_name', '{}'::jsonb, ARRAY[]::text[],
          now() + interval '31 minutes');

  -- только 'deleted' должен прийти; не-deleted строк быть не должно
  SELECT
    count(*) FILTER (WHERE je.entity_name = '__s7_deleted_name'),
    count(*) FILTER (WHERE je.event_type <> 'deleted')
  INTO v_del, v_other
  FROM journal_events(p_tenant_id := r.tenant_id, p_event_types := ARRAY['deleted'], p_limit := 500) je;

  IF v_del <> 1 THEN RAISE EXCEPTION 'FAIL S7: deleted-строка не вернулась (got %)', v_del; END IF;
  IF v_other <> 0 THEN
    RAISE EXCEPTION 'FAIL S7: action-фильтр deleted пропустил % не-deleted строк', v_other;
  END IF;

  RAISE NOTICE 'OK S7: action-фильтр p_event_types=deleted отдаёт только deleted';
END
$s7$;

-- ── Scenario 8: fn_audit populates branch_id (integration) ───────────────────
-- INSERT в реальную branch-scoped таблицу (tables, есть branch_id + триггер audit_tables)
-- → audit_logs.branch_id = branch_id строки. INSERT в tenant-wide dishes (нет branch_id)
-- → audit_logs.branch_id NULL. Доказывает что CREATE OR REPLACE не отвязал триггеры.
DO $s8$
DECLARE
  r          record;
  v_branch   uuid;
  v_table    uuid;
  v_dish     uuid;
  v_tbr      uuid;
  v_dbr      uuid;
  v_dtype    text;
BEGIN
  SELECT * INTO r FROM _fx;
  SELECT id INTO v_branch FROM branches WHERE tenant_id = r.tenant_id LIMIT 1;

  -- branch-scoped insert → tables (минимальный валидный набор)
  INSERT INTO tables (tenant_id, branch_id, name)
  VALUES (r.tenant_id, v_branch, '__s8_table')
  RETURNING id INTO v_table;

  SELECT a.branch_id INTO v_tbr
    FROM audit_logs a
    WHERE a.tenant_id = r.tenant_id AND a.entity_type = 'table'
      AND a.entity_id = v_table::text AND a.action = 'created'
    ORDER BY a.created_at DESC LIMIT 1;

  IF v_tbr IS NULL THEN
    RAISE EXCEPTION 'FAIL S8: audit-строки для tables-insert нет, или branch_id NULL (триггер отвязан?)';
  END IF;
  IF v_tbr <> v_branch THEN
    RAISE EXCEPTION 'FAIL S8: branch-scoped audit branch_id=% ожидали %', v_tbr, v_branch;
  END IF;

  -- tenant-wide insert → dishes (нет branch_id колонки) → branch_id NULL
  -- weight_unit берём дефолтным значением домена; задаём явно валидное.
  INSERT INTO dishes (tenant_id, name, description, price, photos, ingredients,
                      active, sort_order, requires_kitchen, weight_unit)
  VALUES (r.tenant_id, '__s8_dish', '', 100, '{}'::text[], '{}'::jsonb,
          true, 0, true, 'g')
  RETURNING id INTO v_dish;

  SELECT a.branch_id INTO v_dbr
    FROM audit_logs a
    WHERE a.tenant_id = r.tenant_id AND a.entity_type = 'dish'
      AND a.entity_id = v_dish::text AND a.action = 'created'
    ORDER BY a.created_at DESC LIMIT 1;

  -- строка должна существовать (нашли её — entity_id не NULL гарантирует), branch_id NULL
  IF NOT EXISTS (
    SELECT 1 FROM audit_logs a
    WHERE a.tenant_id = r.tenant_id AND a.entity_type = 'dish' AND a.entity_id = v_dish::text
  ) THEN
    RAISE EXCEPTION 'FAIL S8: audit-строки для dishes-insert нет (триггер отвязан?)';
  END IF;
  IF v_dbr IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL S8: tenant-wide dishes audit branch_id ожидали NULL got %', v_dbr;
  END IF;

  RAISE NOTICE 'OK S8: fn_audit пишет branch_id для branch-scoped (tables) и NULL для tenant-wide (dishes)';
END
$s8$;

-- ── Scenario 9: hard-DELETE филиала — delete-safe (нет FK) + forensic branch_id ──
-- Регресс: под FK audit_logs.branch_id → branches(id) AFTER-DELETE триггер вставлял
-- audit-строку со ссылкой на только что удалённый филиал → нарушение FK → DELETE
-- откатывался. FK убран → DELETE проходит. Особый случай fn_audit (entity_type=
-- 'branch' → v_row->>'id') теперь БЕЗОПАСЕН и forensically полезен: branch_id audit-
-- строки = id удалённого филиала (а не NULL), фиксируя КАКОЙ филиал удалили.
DO $s9$
DECLARE
  r            record;
  v_branch     uuid;
  v_del_ok     boolean := false;
  v_action     text;
  v_etype      text;
  v_eid        text;
  v_branch_id  uuid;
BEGIN
  SELECT * INTO r FROM _fx;

  -- одноразовый филиал (минимальный валидный набор NOT NULL колонок)
  INSERT INTO branches (tenant_id, name, address, address_data)
  VALUES (r.tenant_id, '__s9_branch', '__s9_addr', '{}'::jsonb)
  RETURNING id INTO v_branch;

  -- (a) hard-DELETE ДОЛЖЕН пройти без ошибки (раньше падал на FK).
  BEGIN
    DELETE FROM branches WHERE id = v_branch;
    v_del_ok := true;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL S9: hard-DELETE филиала упал (%, %) — FK не убран?', SQLSTATE, SQLERRM;
  END;
  IF NOT v_del_ok THEN
    RAISE EXCEPTION 'FAIL S9: DELETE филиала не выполнился';
  END IF;

  -- (b) forensic audit-строка delete: action/entity_type/entity_id + branch_id = id удалённого.
  SELECT a.action, a.entity_type, a.entity_id, a.branch_id
    INTO v_action, v_etype, v_eid, v_branch_id
    FROM audit_logs a
    WHERE a.tenant_id = r.tenant_id AND a.entity_type = 'branch'
      AND a.entity_id = v_branch::text AND a.action = 'deleted'
    ORDER BY a.created_at DESC LIMIT 1;

  IF v_eid IS NULL THEN
    RAISE EXCEPTION 'FAIL S9: нет audit-строки deleted для удалённого филиала';
  END IF;
  IF v_action <> 'deleted' THEN
    RAISE EXCEPTION 'FAIL S9: action=% ожидали deleted', v_action;
  END IF;
  IF v_etype <> 'branch' THEN
    RAISE EXCEPTION 'FAIL S9: entity_type=% ожидали branch', v_etype;
  END IF;
  IF v_eid <> v_branch::text THEN
    RAISE EXCEPTION 'FAIL S9: entity_id=% ожидали % (id удалённого филиала)', v_eid, v_branch;
  END IF;
  IF v_branch_id IS DISTINCT FROM v_branch THEN
    RAISE EXCEPTION 'FAIL S9: branch_id=% ожидали % (forensic retention id удалённого филиала, НЕ NULL)', v_branch_id, v_branch;
  END IF;

  RAISE NOTICE 'OK S9: hard-DELETE филиала прошёл (нет FK) + audit branch_id = id удалённого (forensic)';
END
$s9$;

-- ── Scenario 10: p_search экранирует LIKE-спецсимволы (% и _) ─────────────────
-- «50%» должен искаться как литерал, а не как «50<что угодно>».
DO $s10$
DECLARE
  r       record;
  v_lit   int;
  v_wild  int;
BEGIN
  SELECT * INTO r FROM _fx;

  INSERT INTO audit_logs (tenant_id, actor_id, actor_name, actor_role, action,
                          entity_type, entity_id, entity_name, payload, changed_fields, created_at)
  VALUES (r.tenant_id, r.owner_id, 'Тестовый Овнер', 'owner', 'updated',
          'promo_code', '__s10_lit', 'Скидка 50% на всё', '{}'::jsonb, ARRAY[]::text[],
          now() + interval '40 minutes');

  INSERT INTO audit_logs (tenant_id, actor_id, actor_name, actor_role, action,
                          entity_type, entity_id, entity_name, payload, changed_fields, created_at)
  VALUES (r.tenant_id, r.owner_id, 'Тестовый Овнер', 'owner', 'updated',
          'promo_code', '__s10_wild', 'Скидка 50х рублей', '{}'::jsonb, ARRAY[]::text[],
          now() + interval '41 minutes');

  SELECT
    count(*) FILTER (WHERE je.entity_id = '__s10_lit'),
    count(*) FILTER (WHERE je.entity_id = '__s10_wild')
  INTO v_lit, v_wild
  FROM journal_events(p_tenant_id := r.tenant_id, p_search := '50%', p_limit := 200) je;

  IF v_lit <> 1 THEN
    RAISE EXCEPTION 'FAIL S10: литеральный «50%%» не нашёлся поиском 50%% (got %)', v_lit;
  END IF;
  IF v_wild <> 0 THEN
    RAISE EXCEPTION 'FAIL S10: %% не экранирован — поиск «50%%» сматчил «50х…» как wildcard';
  END IF;

  RAISE NOTICE 'OK S10: p_search экранирует LIKE-спецсимволы (50%% ищется литерально)';
END
$s10$;

DO $$ BEGIN RAISE NOTICE '── ВСЕ СЦЕНАРИИ ПРОЙДЕНЫ ──'; END $$;

ROLLBACK;
